// Turns a Plan into flat per-year arrays so the simulation loop (run thousands
// of times for Monte Carlo) does no date maths or allocation.

import {
  BASE_YEAR,
  ISA_ALLOWANCE,
  birthYearFromAge,
  pensionAccessAge,
  statePensionAge,
  thresholdIndex,
} from './rules'
import { loanOutflows, mortgageOutflows } from './mortgage'
import { personTax } from './tax'
import type { Plan, WrapperKey } from './types'

export interface Prepared {
  plan: Plan
  T: number // number of simulated years
  n: number // people (1 or 2)
  age0: [number, number]
  accessAge: [number, number]
  spa: [number, number]
  retireIdx: [number, number]
  drawStart: number
  deflator: Float64Array
  idx: Float64Array // tax threshold multiplier
  isaAllowance: Float64Array
  baseTarget: Float64Array // nominal household net spending target (before guardrails)
  baseTargetReal: Float64Array
  eventsIn: Float64Array
  eventsOut: Float64Array // includes mortgage money paid from savings
  mortgageOut: Float64Array
  sp: [Float64Array, Float64Array]
  db: [Float64Array, Float64Array]
  work: [Float64Array, Float64Array]
  contrib: [Record<WrapperKey, Float64Array>, Record<WrapperKey, Float64Array>]
  eqShare: Float64Array
  pvGuaranteed: Float64Array // real PV of guaranteed income from year t onwards
  annuityFactor: Float64Array // real annuity factor for remaining years
  guaranteedReal: Float64Array // State Pension + DB + work each year after income tax, today's money
  realRate: number // median real return of the retirement portfolio (guardrail discount rate)
  // lognormal market parameters
  mu: { eq: number; bd: number }
  sigma: { eq: number; bd: number }
  rho: number
}

/** Lognormal parameters from a compound (median) annual return and a volatility. */
export function lognormalParams(median: number, vol: number) {
  const mu = Math.log(1 + median)
  // Volatility of simple returns → sigma of log returns (iterate once for the arithmetic mean).
  let s2 = Math.log(1 + (vol * vol) / ((1 + median) * (1 + median)))
  const arith = Math.exp(mu + s2 / 2)
  s2 = Math.log(1 + (vol * vol) / (arith * arith))
  return { mu, sigma: Math.sqrt(s2) }
}

export function horizon(plan: Plan): number {
  const [a, b] = plan.people
  const years = plan.couple ? Math.max(plan.planToAge - a.age, plan.planToAge - b.age) : plan.planToAge - a.age
  return Math.max(1, years + 1)
}

export function prepare(plan: Plan): Prepared {
  const A = plan.assumptions
  const n = plan.couple ? 2 : 1
  const T = horizon(plan)
  const people = plan.people
  const age0: [number, number] = [people[0].age, people[1].age]
  const accessAge: [number, number] = [
    pensionAccessAge(people[0].age, people[0].protectedPensionAge),
    pensionAccessAge(people[1].age, people[1].protectedPensionAge),
  ]
  const spa: [number, number] = [0, 1].map((i) => {
    const p = people[i]
    return p.statePension.ageOverride ?? statePensionAge(birthYearFromAge(p.age))
  }) as [number, number]
  const retireIdx: [number, number] = [
    Math.max(0, people[0].retireAge - people[0].age),
    Math.max(0, people[1].retireAge - people[1].age),
  ]
  const drawStart = n === 1 ? retireIdx[0] : plan.spending.start === 'both' ? Math.max(...retireIdx) : Math.min(...retireIdx)

  const deflator = new Float64Array(T)
  const idx = new Float64Array(T)
  const isaAllowance = new Float64Array(T)
  const baseTarget = new Float64Array(T)
  const baseTargetReal = new Float64Array(T)
  const eventsIn = new Float64Array(T)
  const eventsOut = new Float64Array(T)
  const eqShare = new Float64Array(T)
  const mk = () => new Float64Array(T)
  const sp: [Float64Array, Float64Array] = [mk(), mk()]
  const db: [Float64Array, Float64Array] = [mk(), mk()]
  const work: [Float64Array, Float64Array] = [mk(), mk()]
  const mkPots = (): Record<WrapperKey, Float64Array> => ({ pension: mk(), isa: mk(), gia: mk(), cash: mk(), lisa: mk() })
  const contrib: [Record<WrapperKey, Float64Array>, Record<WrapperKey, Float64Array>] = [mkPots(), mkPots()]

  const S = plan.spending
  for (let t = 0; t < T; t++) {
    const year = BASE_YEAR + t
    const d = Math.pow(1 + A.inflation, t)
    deflator[t] = d
    idx[t] = thresholdIndex(year, A.inflation, A.thresholdsAfterFreeze)
    isaAllowance[t] = ISA_ALLOWANCE * idx[t]
    eqShare[t] = t >= drawStart ? A.equityPost : A.equityPre

    const a1 = age0[0] + t
    if (t >= drawStart) {
      let f = 1
      if (S.smile) {
        if (a1 >= S.lateAge) f = 1 + S.latePct
        else if (a1 >= S.slowAge) f = 1 + S.slowPct
      }
      baseTargetReal[t] = S.monthly * 12 * f
      baseTarget[t] = baseTargetReal[t] * d
    }

    for (const ev of plan.events) {
      const hits =
        a1 === ev.age ||
        (ev.every > 0 && a1 > ev.age && a1 <= ev.untilAge && (a1 - ev.age) % ev.every === 0)
      if (!hits) continue
      if (ev.amount >= 0) eventsIn[t] += ev.amount * d
      else eventsOut[t] += -ev.amount * d
    }

    for (let p = 0; p < n; p++) {
      const person = people[p]
      const age = age0[p] + t
      // State Pension: CPI plus any assumed real (triple-lock) uplift. Part year if SPA is fractional.
      const spShare = Math.min(1, Math.max(0, age + 1 - spa[p]))
      sp[p][t] = person.statePension.weekly * 52 * spShare * d * Math.pow(1 + A.statePensionReal, t)
      if (person.db.annual > 0 && age >= person.db.startAge) db[p][t] = person.db.annual * d
      if (person.work.annual > 0 && age >= person.retireAge && age < person.work.untilAge) work[p][t] = person.work.annual * d
      if (t < retireIdx[p]) {
        const g = d * Math.pow(1 + A.contribGrowthReal, t) * 12
        contrib[p].pension[t] = person.contrib.pension * g
        contrib[p].isa[t] = person.contrib.isa * g
        contrib[p].gia[t] = person.contrib.gia * g
        contrib[p].cash[t] = person.contrib.cash * g
        contrib[p].lisa[t] = person.contrib.lisa * g
      }
    }
  }

  // Mortgage payments/payoff that come out of savings (actual £, not inflated).
  const firstAccess = Math.min(...[0, 1].slice(0, n).map((p) => Math.max(0, accessAge[p] - age0[p])))
  const mortgageOut = mortgageOutflows(plan.mortgage, T, drawStart, firstAccess)
  const loanOut = loanOutflows(plan.otherLoan, T, drawStart, firstAccess)
  for (let t = 0; t < T; t++) {
    mortgageOut[t] += loanOut[t]
    eventsOut[t] += mortgageOut[t]
  }

  const eq = lognormalParams(A.equityReturn - A.fees, A.equityVol)
  const bd = lognormalParams(A.bondReturn - A.fees, A.bondVol)

  // Real discount rate for guardrail checks: median real return of the retirement portfolio.
  const e = A.equityPost
  const nominalMedian = e * (Math.exp(eq.mu) - 1) + (1 - e) * (Math.exp(bd.mu) - 1)
  const r = Math.max(0.005, (1 + nominalMedian) / (1 + A.inflation) - 1)
  const pvGuaranteed = new Float64Array(T)
  const annuityFactor = new Float64Array(T)
  const guaranteedReal = new Float64Array(T)
  let pv = 0
  let af = 0
  for (let t = T - 1; t >= 0; t--) {
    let g = 0
    let gNet = 0
    for (let p = 0; p < n; p++) {
      const gross = sp[p][t] + db[p][t] + work[p][t]
      g += gross
      if (gross > 0) {
        const tax = personTax(
          { nonSavings: gross, earnings: work[p][t], savings: 0, dividends: 0, gains: 0, overSpa: people[p].age + t >= spa[p] },
          { region: plan.region, year: BASE_YEAR + t, idx: idx[t] },
        ).total
        gNet += gross - tax
      }
    }
    guaranteedReal[t] = gNet / deflator[t]
    pv = g / deflator[t] + pv / (1 + r)
    af = 1 + af / (1 + r)
    pvGuaranteed[t] = pv
    annuityFactor[t] = af
  }

  return {
    plan,
    T,
    n,
    age0,
    accessAge,
    spa,
    retireIdx,
    drawStart,
    deflator,
    idx,
    isaAllowance,
    baseTarget,
    baseTargetReal,
    eventsIn,
    eventsOut,
    mortgageOut,
    sp,
    db,
    work,
    contrib,
    eqShare,
    pvGuaranteed,
    annuityFactor,
    guaranteedReal,
    realRate: r,
    mu: { eq: eq.mu, bd: bd.mu },
    sigma: { eq: eq.sigma, bd: bd.sigma },
    rho: A.correlation,
  }
}
