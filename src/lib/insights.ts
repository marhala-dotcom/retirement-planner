// Plain-English observations about the plan, ranked by how much they matter.
import type { MCResult } from '../engine/montecarlo'
import type { Prepared } from '../engine/prepare'
import { PENSION, PLSA, STATE_PENSION } from '../engine/rules'
import type { SweepPoint } from '../engine/worker'
import type { YearRow } from '../engine/types'
import { compact, money, pct } from './format'
import { showsGia } from './pots'
import { balanceAfter, monthsToPayOff, paymentToClear } from '../engine/mortgage'

export type Tone = 'bad' | 'warn' | 'info' | 'good'
export interface Insight {
  id: string
  tone: Tone
  title: string
  body: string
}

interface Ctx {
  P: Prepared
  rows: YearRow[]
  depletedAt: number
  potAtRet: number
  mc: MCResult | null
  solve: { maxSteady: number; max90: number; max75: number; altSuccess: number } | null
  sweep: SweepPoint[] | null
}

export function buildInsights({ P, rows, depletedAt, potAtRet, mc, solve, sweep }: Ctx): Insight[] {
  const plan = P.plan
  const out: Insight[] = []
  const names = plan.people.map((p, i) => p.name || (i ? 'Partner' : 'You'))
  const real = (r: YearRow, x: number) => x / r.deflator
  const target = plan.spending.monthly
  const people = P.n === 2 ? [0, 1] : [0]
  const startRow = rows[P.drawStart]

  // 1. Running out in steady markets
  if (depletedAt >= 0) {
    const age = rows[depletedAt].ages[0]
    const better = sweep?.find((s) => s.retireAge > plan.people[0].retireAge && s.maxSpend >= target)
    out.push({
      id: 'runout',
      tone: 'bad',
      title: `Money runs out at ${age}, even in steady markets`,
      body:
        `To last to ${plan.planToAge}, you could spend about ${money(solve?.maxSteady ?? 0)}/month instead of ${money(target)}` +
        (better ? `, or retire at ${better.retireAge}` : '') +
        `, or save more before retiring.`,
    })
  }

  // 2. Bridge to pension access
  const firstAccessIdx = Math.min(...people.map((p) => Math.max(0, P.accessAge[p] - P.age0[p])))
  if (P.drawStart < firstAccessIdx && startRow) {
    const bridgeRows = rows.slice(P.drawStart, firstAccessIdx)
    const need = bridgeRows.reduce((s, r) => s + real(r, r.target), 0)
    const b = startRow.balances
    const have = real(startRow, b.isa + b.gia + b.cash + (startRow.ages[0] >= 60 ? b.lisa : 0))
    const years = firstAccessIdx - P.drawStart
    const ok = have >= need * 1.05
    out.push({
      id: 'bridge',
      tone: ok ? 'good' : 'bad',
      title: ok
        ? `Your ISAs and cash cover the ${years}-year bridge to pension access`
        : `Not enough outside pensions to bridge ${years} years until ${P.accessAge[0]}`,
      body: `Pensions stay locked until ${P.accessAge[0]} (the minimum age rises to 57 in April 2028). You need about ${compact(need)} from ISAs${showsGia(plan) ? ', GIA' : ''} and cash to get there, and you'd have ${compact(have)}.${
        ok ? '' : ' Consider paying more into ISAs instead of pensions in the years before you retire.'
      }`,
    })
  }

  // 3. Initial withdrawal rate
  if (startRow && potAtRet > 0) {
    const w = startRow.income
    const drawn = real(startRow, w.pension + w.isa + w.gia + w.cash + w.lisa - startRow.surplusSaved)
    const rate = drawn / potAtRet
    const years = plan.planToAge - plan.people[0].retireAge
    const tone: Tone = rate <= 0.033 ? 'good' : rate <= 0.045 ? 'warn' : 'bad'
    out.push({
      id: 'wr',
      tone,
      title: `You'd start by drawing ${pct(rate, 1)} of your pot a year`,
      body: `For a ${years}-year retirement with fixed spending, research points to about 3% (Morningstar 2025; Pfau's UK history), or 3.5–4% if you're willing to trim spending in bad years. Higher early rates can work while you wait for State Pensions, as long as the pot survives the first decade.`,
    })
  }

  // 4. Flexible spending
  if (solve && mc) {
    if (plan.strategy.type === 'fixed' && solve.altSuccess > mc.successRate + 0.05) {
      out.push({
        id: 'flex',
        tone: 'info',
        title: `Being flexible lifts your chance from ${pct(mc.successRate)} to ${pct(solve.altSuccess)}`,
        body: 'Switch the spending rule to "Flexible (guardrails)". It trims spending by 10% when markets knock you off track and restores it when they recover. Most retirees naturally do this.',
      })
    }
    if (plan.strategy.type === 'guardrails' && mc.bigCutRate > 0) {
      out.push({
        id: 'cuts',
        tone: mc.p10MinFactor < plan.spending.essentialPct + 0.01 ? 'warn' : 'info',
        title: `${pct(mc.bigCutRate)} chance of cutting spending by more than 10%`,
        body: `In a bad 1-in-10 market history, spending would dip to about ${money(target * mc.p10MinFactor)}/month at its lowest (today's money).`,
      })
    }
  }

  // 5. State Pension gap
  const spa = Math.ceil(P.spa[0])
  const gap = spa - plan.people[0].retireAge
  if (gap > 0 && plan.people[0].statePension.weekly > 0) {
    const spAnnual = people.reduce((s, p) => s + plan.people[p].statePension.weekly * 52, 0)
    out.push({
      id: 'spgap',
      tone: 'info',
      title: `${gap} years of drawdown before the State Pension at ${spa}`,
      body: `Your State Pension${P.n === 2 ? 's' : ''} will be worth about ${money(spAnnual)} a year in today's money (${pct(spAnnual / (target * 12))} of your target). Until then savings do all the work, which is why the early years draw hardest. Check your forecast and fill any National Insurance gaps — each extra year adds about £${(STATE_PENSION.fullWeekly / 35 * 52).toFixed(0)} a year for life.`,
    })
  }

  // 6. Tax
  const retiredRows = rows.filter((r) => r.phase === 'retired')
  if (retiredRows.length) {
    const taxReal = retiredRows.reduce((s, r) => s + real(r, r.income.tax), 0)
    const grossReal = retiredRows.reduce((s, r) => {
      const i = r.income
      return s + real(r, i.statePension + i.other + i.pension + i.isa + i.gia + i.cash + i.lisa)
    }, 0)
    const highYears = retiredRows.filter((r) => r.higherRate[0] || r.higherRate[1]).length
    out.push({
      id: 'tax',
      tone: highYears > 0 ? 'warn' : 'good',
      title: `About ${money(taxReal / retiredRows.length)} a year in tax, ${pct(grossReal > 0 ? taxReal / grossReal : 0)} of what you draw`,
      body:
        (highYears > 0
          ? `In ${highYears} year${highYears > 1 ? 's' : ''} someone pays higher-rate tax. Spreading withdrawals across you both, or drawing more from ISAs in those years, could save money. `
          : 'Withdrawals mostly stay within personal allowances and the basic-rate band. ') +
        (P.n === 2 ? 'Each of you has your own £12,570 personal allowance — using both every year is one of the biggest tax wins for couples.' : ''),
    })
  }

  // 7. Unequal pensions
  if (P.n === 2) {
    const [a, b] = [plan.people[0].pots.pension, plan.people[1].pots.pension]
    const smaller = a < b ? 0 : 1
    if (Math.min(a, b) > 0 && Math.max(a, b) / Math.min(a, b) >= 2) {
      const emptyRow = rows.find((r) => r.phase === 'retired' && r.balancesByPerson[smaller].pension < 1 && r.balancesByPerson[1 - smaller].pension > 1)
      out.push({
        id: 'unequal',
        tone: 'info',
        title: `${names[smaller]}'s pension is much smaller`,
        body: `${compact(Math.min(a, b))} vs ${compact(Math.max(a, b))}.${
          emptyRow ? ` It runs dry around ${names[smaller] === 'You' ? 'your' : names[smaller] + "'s"} age ${emptyRow.ages[smaller]}, wasting a tax-free personal allowance after that.` : ''
        } Directing more future pension contributions to ${names[smaller]} helps balance taxable income in retirement.`,
      })
    }
  }

  // 7b. Mortgage
  const mg = plan.mortgage
  if (mg.balance > 0) {
    const left = balanceAfter(mg, 12 * P.drawStart)
    const ends = monthsToPayOff(mg)
    const endYear = Number.isFinite(ends) ? 2026 + Math.ceil(ends / 12) : null
    const retireAge = P.age0[0] + P.drawStart
    const fromSavings = rows.reduce((s, r) => s + r.mortgage / r.deflator, 0)
    if (left > 1) {
      const need = paymentToClear(mg, 12 * P.drawStart)
      const body: Record<string, string> = {
        overpay: `At ${money(mg.monthly)}/month about ${money(left)} would still be owed at ${retireAge}${endYear ? ` (it runs to ${endYear})` : ''}. This plan assumes you pay ${money(need)}/month from salary (${money(need - mg.monthly)} more) so retirement savings aren't touched.`,
        atRetirement: `About ${money(left)} is paid off from savings at ${retireAge}. Before pensions unlock that comes from ISAs and cash, so check the bridge. Overpaying ${money(need - mg.monthly)}/month now would avoid it.`,
        atAccess: `Monthly payments come from savings until pensions unlock, then the rest is cleared — about ${compact(fromSavings)} in today's money in total.`,
        term: `Payments of about ${money(mg.monthly * 12)} a year come out of savings until ${endYear ?? 'the end of the term'} — about ${compact(fromSavings)} in today's money in total.`,
      }
      out.push({
        id: 'mortgage',
        tone: mg.strategy === 'atRetirement' ? 'warn' : 'info',
        title:
          mg.strategy === 'overpay'
            ? `Overpay ${money(need - mg.monthly)}/month to be mortgage-free at ${retireAge}`
            : `Your mortgage costs about ${compact(fromSavings)} from savings`,
        body: body[mg.strategy],
      })
    } else {
      out.push({
        id: 'mortgage',
        tone: 'good',
        title: `Mortgage-free before you retire${endYear ? ` (${endYear})` : ''}`,
        body: 'Your current payments clear it while you are still working, so it never touches your retirement savings.',
      })
    }
  }

  // 7c. Other (family) loan
  const loan = plan.otherLoan
  if (loan.amount > 0) {
    const name = loan.label || 'loan'
    if (loan.repay === 'none') {
      out.push({
        id: 'loan',
        tone: 'info',
        title: `The ${money(loan.amount)} ${name.toLowerCase()} is assumed written off`,
        body: 'It is not taken from your savings. If it does need repaying, choose when under Home & mortgage to see the effect.',
      })
    } else {
      const row = rows.find((r) => r.mortgage >= loan.amount - 1)
      out.push({
        id: 'loan',
        tone: 'warn',
        title: `Repaying the ${name.toLowerCase()} takes ${money(loan.amount)} from savings${row ? ` at ${row.ages[0]}` : ''}`,
        body: `That's about ${compact(row ? loan.amount / row.deflator : loan.amount)} in today's money. If it's written off instead, set it to "won't be repaid" — or keep both versions as scenarios and compare them.`,
      })
    }
  }

  // 8. Benchmarks
  const bench = P.n === 2 ? PLSA.couple : PLSA.single
  const yr = target * 12
  const level = yr < bench.minimum ? 'below the Minimum' : yr < bench.moderate ? 'between Minimum and Moderate' : yr < bench.comfortable ? 'between Moderate and Comfortable' : 'above Comfortable'
  out.push({
    id: 'bench',
    tone: 'info',
    title: `Your target is ${level} on the Retirement Living Standards`,
    body: `${money(yr)} a year vs ${compact(bench.minimum)} / ${compact(bench.moderate)} / ${compact(bench.comfortable)} for a ${P.n === 2 ? 'couple' : 'single person'} (Pensions UK, 2026, after tax, outside London, mortgage-free).`,
  })

  // 9. Spending smile
  if (!plan.spending.smile) {
    out.push({
      id: 'smile',
      tone: 'info',
      title: 'Most people spend less as they get older',
      body: 'Real spending typically drifts down through the late 70s and 80s. Turn on "Spend less in later life" for a more realistic (and less pessimistic) picture.',
    })
  }

  // 10. IHT & LSA
  const finalReal = rows.length ? real(rows[rows.length - 1], rows[rows.length - 1].balances.pension) : 0
  if (finalReal > 50_000 || (mc && mc.medianFinalReal > 300_000)) {
    out.push({
      id: 'iht',
      tone: 'info',
      title: 'Unused pensions count for inheritance tax from April 2027',
      body: 'Pensions left on death will be part of your estate (spouses are exempt). If you expect to leave a lot, drawing pensions within the basic-rate band rather than saving them for last can reduce the total tax paid.',
    })
  }
  const bigPot = people.some((p) => rows[Math.min(rows.length - 1, Math.max(0, P.accessAge[p] - P.age0[p]))]?.balancesByPerson[p].pension * PENSION.taxFreeShare > PENSION.lumpSumAllowance)
  if (bigPot) {
    out.push({
      id: 'lsa',
      tone: 'info',
      title: 'Tax-free cash is capped at £268,275 each',
      body: 'Your pension is large enough that 25% would exceed the Lump Sum Allowance. Withdrawals beyond the cap are fully taxable — the model applies this.',
    })
  }

  // 11. Good news
  if (mc && mc.successRate >= 0.85 && depletedAt < 0) {
    out.push({
      id: 'good',
      tone: 'good',
      title: 'Your plan holds up in most market conditions',
      body: `Money lasted to ${plan.planToAge} in ${pct(mc.successRate)} of simulated futures.${
        solve && solve.max90 > target ? ` You could spend up to ${money(solve.max90)}/month and still be 90% confident.` : ''
      }`,
    })
  }

  const rank: Record<Tone, number> = { bad: 0, warn: 1, info: 2, good: 3 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone])
}
