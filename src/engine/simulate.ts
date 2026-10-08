// One pass through the plan, year by year, for a given sequence of market returns.
//
// Each tax year:
//   1. contributions (while working), ISA/LISA allowances respected
//   2. tax-free cash taken up front (if chosen) once retired and the pension is accessible
//   3. windfalls invested
//   4. guaranteed income (State Pension, DB, part-time work) and taxable investment income
//   5. guardrail check (flexible spending)
//   6. fill each person's personal allowance with pension withdrawals (tax-free income)
//   7. fund the rest of the spending target from each source in the chosen order,
//      grossing up for income tax / CGT with each person's own allowances and bands
//   8. any surplus reinvested (ISA first), then Bed & ISA within the CGT exemption
//   9. markets move

import { CGT, LISA, PENSION, BASE_YEAR } from './rules'
import { higherRateStart, personTax, personalAllowance, type TaxContext } from './tax'
import type { Prepared } from './prepare'
import type { IncomeBreakdown, Pots, SimResult, WrapperKey, YearRow } from './types'

type Source = 'cash' | 'gia' | 'isa' | 'lisa' | 'pensionBasic' | 'pensionAny'

const ORDERS: Record<string, Source[]> = {
  taxSmart: ['cash', 'gia', 'pensionBasic', 'lisa', 'isa', 'pensionAny'],
  preservePension: ['cash', 'gia', 'lisa', 'isa', 'pensionBasic', 'pensionAny'],
  pensionFirst: ['pensionBasic', 'pensionAny', 'cash', 'gia', 'lisa', 'isa'],
}

interface PState {
  bal: Pots
  basis: number // GIA cost basis
  lsaLeft: number
  crystallised: boolean
  // per-year accumulators
  ns: number
  earn: number
  sav: number
  div: number
  gains: number
  wd: Pots
  isaUsed: number
  overSpa: boolean
}

const zeroPots = (): Pots => ({ pension: 0, isa: 0, gia: 0, cash: 0, lisa: 0 })

export interface SimOptions {
  /** Fill with start-of-year real wealth for each year (length T). */
  wealthReal?: Float64Array
  /** Record full year rows (slower; used for charts and the table). */
  record?: boolean
}

export interface SimSummary {
  depletedAtIndex: number
  potAtRetirementReal: number
  finalReal: number
  minSpendingFactor: number
  cutYears: number
  totalTaxReal: number
  rows: YearRow[] | null
}

export function simulate(P: Prepared, eqR: ArrayLike<number>, bdR: ArrayLike<number>, opt: SimOptions = {}): SimSummary {
  const plan = P.plan
  const A = plan.assumptions
  const strat = plan.strategy
  const n = P.n
  const order = ORDERS[strat.order]
  const ufpls = strat.tfc === 'ufpls'
  const rows: YearRow[] | null = opt.record ? [] : null

  const st: PState[] = []
  for (let p = 0; p < 2; p++) {
    const person = plan.people[p]
    const active = p < n
    const bal = active ? { ...person.pots } : zeroPots()
    st.push({
      bal,
      basis: bal.gia * Math.min(1, Math.max(0, person.giaBasisPct)),
      lsaLeft: PENSION.lumpSumAllowance,
      crystallised: false,
      ns: 0,
      earn: 0,
      sav: 0,
      div: 0,
      gains: 0,
      wd: zeroPots(),
      isaUsed: 0,
      overSpa: false,
    })
  }

  let factor = 1
  let depleted = -1
  let minFactor = 1
  let cutYears = 0
  let totalTaxReal = 0
  let potAtRet = 0
  let ctx: TaxContext = { region: plan.region, year: BASE_YEAR, idx: 1 }

  const age = (p: number, t: number) => P.age0[p] + t
  const accessible = (p: number, t: number) => age(p, t) >= P.accessAge[p]
  const retired = (p: number, t: number) => t >= P.retireIdx[p]

  const taxOf = (s: PState, dNs = 0, dGains = 0) =>
    personTax(
      { nonSavings: s.ns + dNs, earnings: s.earn, savings: s.sav, dividends: s.div, gains: s.gains + dGains, overSpa: s.overSpa },
      ctx,
    ).total

  /** Taxable part of a gross pension withdrawal, respecting the Lump Sum Allowance. */
  const pensionTaxable = (s: PState, g: number) => {
    if (!ufpls || s.crystallised) return g
    const tf = Math.min(g * PENSION.taxFreeShare, s.lsaLeft)
    return g - tf
  }

  const withdrawPension = (s: PState, g: number) => {
    g = Math.min(g, s.bal.pension)
    if (g <= 0) return
    const taxable = pensionTaxable(s, g)
    s.lsaLeft -= g - taxable
    s.ns += taxable
    s.bal.pension -= g
    s.wd.pension += g
  }

  const withdrawGia = (s: PState, g: number) => {
    g = Math.min(g, s.bal.gia)
    if (g <= 0) return
    const basisShare = s.bal.gia > 0 ? s.basis / s.bal.gia : 1
    s.gains += g * Math.max(0, 1 - basisShare)
    s.basis -= g * Math.min(1, basisShare)
    s.bal.gia -= g
    s.wd.gia += g
  }

  /** Put money into a person's ISA (within allowance) and the rest into their GIA
   *  (or cash, if the plan doesn't use a GIA). */
  const deposit = (s: PState, t: number, amt: number) => {
    if (amt <= 0) return
    const room = Math.max(0, P.isaAllowance[t] - s.isaUsed)
    const toIsa = Math.min(room, amt)
    s.bal.isa += toIsa
    s.isaUsed += toIsa
    const rest = amt - toIsa
    if (A.equityPost <= 0 || !plan.extraPots) s.bal.cash += rest
    else {
      s.bal.gia += rest
      s.basis += rest
    }
  }

  const totalIncome = (s: PState) => s.ns + s.sav + s.div

  // Gross amount each person can contribute to a given source this year.
  const capacity = (src: Source, p: number, t: number, hrs: number): number => {
    const s = st[p]
    switch (src) {
      case 'cash':
        return s.bal.cash
      case 'gia':
        return s.bal.gia
      case 'isa':
        return s.bal.isa
      case 'lisa':
        return age(p, t) >= LISA.accessAge ? s.bal.lisa : 0
      case 'pensionBasic': {
        if (!accessible(p, t) || !retired(p, t)) return 0
        const room = Math.max(0, hrs - totalIncome(s))
        const share = !ufpls || s.crystallised || s.lsaLeft <= 0 ? 1 : 1 - PENSION.taxFreeShare
        return Math.min(s.bal.pension, room / share)
      }
      case 'pensionAny':
        return accessible(p, t) && retired(p, t) ? s.bal.pension : 0
    }
  }

  const caps = [0, 0]

  const applySource = (src: Source, p: number, g: number) => {
    const s = st[p]
    if (g <= 0) return
    switch (src) {
      case 'cash':
      case 'isa':
      case 'lisa': {
        const k = src as WrapperKey
        const x = Math.min(g, s.bal[k])
        s.bal[k] -= x
        s.wd[k] += x
        break
      }
      case 'gia':
        withdrawGia(s, g)
        break
      default:
        withdrawPension(s, g)
    }
  }

  // Extra tax if `g` were taken from `src` for person p.
  const extraTax = (src: Source, p: number, g: number, base: number) => {
    const s = st[p]
    if (src === 'gia') {
      const basisShare = s.bal.gia > 0 ? s.basis / s.bal.gia : 1
      return taxOf(s, 0, g * Math.max(0, 1 - basisShare)) - base
    }
    if (src === 'pensionBasic' || src === 'pensionAny') return taxOf(s, pensionTaxable(s, g)) - base
    return 0
  }

  for (let t = 0; t < P.T; t++) {
    const year = BASE_YEAR + t
    const defl = P.deflator[t]
    const e = P.eqShare[t]
    const drawing = t >= P.drawStart
    ctx = { region: plan.region, year, idx: P.idx[t] }
    const hrs = higherRateStart(plan.region, P.idx[t])

    const startBal: [Pots, Pots] = [{ ...st[0].bal }, { ...st[1].bal }]
    let startTotal = 0
    for (let p = 0; p < n; p++) {
      const b = st[p].bal
      startTotal += b.pension + b.isa + b.gia + b.cash + b.lisa
    }
    if (opt.wealthReal) opt.wealthReal[t] = startTotal / defl
    if (t === P.drawStart) potAtRet = startTotal / defl

    let contributions = 0
    let spIncome = 0
    let otherIncome = 0
    for (let p = 0; p < n; p++) {
      const s = st[p]
      s.ns = s.earn = s.sav = s.div = s.gains = 0
      s.wd = zeroPots()
      s.isaUsed = 0
      s.overSpa = age(p, t) >= P.spa[p]
    }

    // 1. Contributions while working.
    for (let p = 0; p < n; p++) {
      if (retired(p, t)) continue
      const s = st[p]
      const c = P.contrib[p]
      s.bal.pension += c.pension[t]
      let isaIn = c.isa[t]
      if (c.lisa[t] > 0) {
        const lc = age(p, t) <= LISA.lastContribAge ? Math.min(c.lisa[t], LISA.maxContribution) : 0
        s.bal.lisa += lc * (1 + LISA.bonus)
        s.isaUsed += lc
        isaIn += c.lisa[t] - lc
      }
      const room = Math.max(0, P.isaAllowance[t] - s.isaUsed)
      const toIsa = Math.min(room, isaIn)
      s.bal.isa += toIsa
      s.isaUsed += toIsa
      const overflow = isaIn - toIsa
      if (plan.extraPots) {
        s.bal.gia += overflow
        s.basis += overflow
      } else s.bal.cash += overflow
      s.bal.gia += c.gia[t]
      s.basis += c.gia[t]
      s.bal.cash += c.cash[t]
      contributions += c.pension[t] + c.isa[t] + c.gia[t] + c.cash[t] + c.lisa[t]
    }

    // 2. Tax-free cash up front: crystallise the whole pot when first drawing.
    if (!ufpls) {
      for (let p = 0; p < n; p++) {
        const s = st[p]
        if (s.crystallised || !accessible(p, t) || !retired(p, t)) continue
        const tfc = Math.min(s.bal.pension * PENSION.taxFreeShare, s.lsaLeft)
        s.bal.pension -= tfc
        s.lsaLeft -= tfc
        s.crystallised = true
        deposit(s, t, tfc)
      }
    }

    // 3. Windfalls (inheritance, downsizing...) are invested.
    if (P.eventsIn[t] > 0) {
      if (n === 2) {
        deposit(st[0], t, P.eventsIn[t] / 2)
        deposit(st[1], t, P.eventsIn[t] / 2)
      } else deposit(st[0], t, P.eventsIn[t])
    }

    // 4. Guaranteed income and taxable investment income.
    let guaranteed = 0
    for (let p = 0; p < n; p++) {
      const s = st[p]
      const sp = P.sp[p][t]
      const db = P.db[p][t]
      const wk = P.work[p][t]
      s.ns += sp + db + wk
      s.earn += wk
      guaranteed += sp + db + wk
      spIncome += sp
      otherIncome += db + wk
      if (retired(p, t)) {
        // Interest/dividends are only taxed in the model once the person has stopped
        // working (salary isn't modelled, so earlier-year tax on them is ignored).
        s.sav += s.bal.cash * A.cashRate + s.bal.gia * (1 - e) * A.bondReturn
        s.div += s.bal.gia * e * A.dividendYield
      }
    }

    // 5. Flexible spending guardrails (Guyton–Klinger-style, anchored to a funded ratio):
    //    compare savings with the present value of what they still need to provide
    //    (spending minus guaranteed income, year by year, so the gap before State Pension
    //    counts in full). Under 90% funded → cut 10% (never below the essential floor);
    //    comfortably funded again → restore 10%, back up to the full target. Spending
    //    never goes above target, so flexibility can only help.
    if (drawing && strat.type === 'guardrails') {
      let port = 0
      for (let p = 0; p < n; p++) {
        const b = st[p].bal
        port += b.pension + b.isa + b.gia + b.cash + b.lisa
      }
      const real = port / defl
      const funded = (f: number) => {
        let pv = 0
        let disc = 1
        for (let s = t; s < P.T; s++) {
          pv += Math.max(0, P.baseTargetReal[s] * f - P.guaranteedReal[s]) * disc
          disc /= 1 + P.realRate
        }
        return pv > 0 ? real / pv : Infinity
      }
      if (funded(factor) < 0.9) factor = Math.max(plan.spending.essentialPct, factor * 0.9)
      else if (factor < 1 && funded(Math.min(1, factor / 0.9)) > 1) factor = Math.min(1, factor / 0.9)
    }
    const target = drawing ? P.baseTarget[t] * factor : 0
    const need = target + P.eventsOut[t]

    // 6. Use each retired person's personal allowance with pension income (it's tax-free).
    if (drawing && strat.usePersonalAllowance) {
      for (let p = 0; p < n; p++) {
        const s = st[p]
        if (!accessible(p, t) || !retired(p, t) || s.bal.pension <= 0) continue
        const pa = personalAllowance(totalIncome(s), P.idx[t])
        const room = pa - s.ns
        if (room <= 1) continue
        const share = !ufpls || s.crystallised || s.lsaLeft <= 0 ? 1 : 1 - PENSION.taxFreeShare
        withdrawPension(s, room / share)
      }
    }

    // 7. Fund the remaining need, source by source, grossing up for tax.
    const cashIn = () => {
      let x = guaranteed
      for (let p = 0; p < n; p++) {
        const w = st[p].wd
        x += w.pension + w.isa + w.gia + w.cash + w.lisa
      }
      return x
    }
    const householdTax = () => {
      let x = 0
      for (let p = 0; p < n; p++) x += taxOf(st[p])
      return x
    }

    let shortfall = 0
    let tax = householdTax()
    let net = cashIn() - tax
    for (const src of order) {
      for (let iter = 0; iter < 6; iter++) {
        const short = need - net
        if (short <= 0.5) break
        let capTotal = 0
        for (let p = 0; p < n; p++) {
          caps[p] = capacity(src, p, t, hrs)
          capTotal += caps[p]
        }
        if (capTotal <= 0.5) break
        // Estimate the net yield per £ from this source (marginal tax), then gross up.
        const trial = Math.min(capTotal, short)
        let dTax = 0
        for (let p = 0; p < n; p++) {
          if (caps[p] <= 0) continue
          dTax += extraTax(src, p, (trial * caps[p]) / capTotal, taxOf(st[p]))
        }
        const yieldPerPound = Math.max(0.05, 1 - dTax / trial)
        const gross = Math.min(capTotal, short / yieldPerPound)
        for (let p = 0; p < n; p++) if (caps[p] > 0) applySource(src, p, (gross * caps[p]) / capTotal)
        tax = householdTax()
        net = cashIn() - tax
      }
      if (need - net <= 0.5) break
    }
    if (need - net > Math.max(50, need * 0.005)) {
      shortfall = need - net
      if (drawing && depleted < 0) depleted = t
    }

    // 8. Surplus (e.g. tax-free pension income not needed this year) is reinvested.
    const surplus = Math.max(0, net - need)
    if (surplus > 0) {
      if (n === 2) {
        // Give it to whoever has more ISA room left.
        const r0 = P.isaAllowance[t] - st[0].isaUsed
        const r1 = P.isaAllowance[t] - st[1].isaUsed
        const half = surplus / 2
        if (r0 >= half && r1 >= half) {
          deposit(st[0], t, half)
          deposit(st[1], t, half)
        } else deposit(st[r0 >= r1 ? 0 : 1], t, surplus)
      } else deposit(st[0], t, surplus)
    }

    if (strat.bedAndIsa) {
      for (let p = 0; p < n; p++) {
        const s = st[p]
        const room = P.isaAllowance[t] - s.isaUsed
        if (room <= 1 || s.bal.gia <= 1) continue
        const gainFrac = Math.max(0, 1 - s.basis / s.bal.gia)
        const aeaLeft = Math.max(0, CGT.annualExempt * P.idx[t] - s.gains)
        const maxByGain = gainFrac > 1e-9 ? aeaLeft / gainFrac : Infinity
        const move = Math.min(room, s.bal.gia, maxByGain)
        if (move <= 1) continue
        const basisShare = s.basis / s.bal.gia
        s.gains += move * gainFrac
        s.basis -= move * basisShare
        s.bal.gia -= move
        s.bal.isa += move
        s.isaUsed += move
      }
    }

    // 9. Markets move (fees are already netted off the expected returns).
    const rInv = e * eqR[t] + (1 - e) * bdR[t]
    for (let p = 0; p < n; p++) {
      const b = st[p].bal
      st[p].basis += b.gia * (e * A.dividendYield + (1 - e) * A.bondReturn) // reinvested income
      b.pension = Math.max(0, b.pension * (1 + rInv))
      b.isa = Math.max(0, b.isa * (1 + rInv))
      b.lisa = Math.max(0, b.lisa * (1 + rInv))
      b.gia = Math.max(0, b.gia * (1 + rInv))
      b.cash = Math.max(0, b.cash * (1 + A.cashRate))
      st[p].basis = Math.min(st[p].basis, b.gia)
    }

    totalTaxReal += tax / defl
    if (drawing) {
      minFactor = Math.min(minFactor, factor)
      if (factor < 0.999) cutYears++
    }

    if (rows) {
      const income: IncomeBreakdown = {
        statePension: spIncome,
        other: otherIncome,
        pension: 0,
        isa: 0,
        gia: 0,
        cash: 0,
        lisa: 0,
        tax,
      }
      const taxByPerson: [number, number] = [0, 0]
      for (let p = 0; p < n; p++) {
        const w = st[p].wd
        income.pension += w.pension
        income.isa += w.isa
        income.gia += w.gia
        income.cash += w.cash
        income.lisa += w.lisa
        taxByPerson[p] = taxOf(st[p])
      }
      const balances = {
        pension: startBal[0].pension + startBal[1].pension,
        isa: startBal[0].isa + startBal[1].isa,
        gia: startBal[0].gia + startBal[1].gia,
        cash: startBal[0].cash + startBal[1].cash,
        lisa: startBal[0].lisa + startBal[1].lisa,
      }
      rows.push({
        year,
        ages: [age(0, t), age(1, t)],
        phase: drawing ? 'retired' : 'saving',
        deflator: defl,
        balances,
        balancesByPerson: startBal,
        total: startTotal,
        target: need,
        spent: Math.min(need, net),
        shortfall,
        income,
        taxByPerson,
        higherRate: [totalIncome(st[0]) > hrs + 1 && retired(0, t), n > 1 && totalIncome(st[1]) > hrs + 1 && retired(1, t)],
        contributions,
        surplusSaved: surplus,
        spendingFactor: factor,
        pensionAccess: [accessible(0, t), accessible(1, t)],
        marketReturn: eqR[t],
      })
    }
  }

  let finalTotal = 0
  for (let p = 0; p < n; p++) {
    const b = st[p].bal
    finalTotal += b.pension + b.isa + b.gia + b.cash + b.lisa
  }

  return {
    depletedAtIndex: depleted,
    potAtRetirementReal: potAtRet,
    finalReal: finalTotal / P.deflator[P.T - 1] / (1 + A.inflation),
    minSpendingFactor: minFactor,
    cutYears,
    totalTaxReal,
    rows,
  }
}

export type { SimResult }
