import { describe, expect, it } from 'vitest'
import { defaultPlan } from './defaults'
import { generateMarkets, maxSpendSteady, runDeterministic, runMonteCarlo } from './montecarlo'
import { prepare } from './prepare'
import { pensionAccessAge, statePensionAge } from './rules'
import { simulate } from './simulate'
import { personTax, type TaxInput } from './tax'
import type { Plan } from './types'

const ctx = { region: 'rUK' as const, year: 2026, idx: 1 }
const inp = (o: Partial<TaxInput>): TaxInput => ({
  nonSavings: 0,
  earnings: 0,
  savings: 0,
  dividends: 0,
  gains: 0,
  overSpa: true,
  ...o,
})

describe('income tax 2026/27 (England, Wales, NI)', () => {
  it.each([
    [12_570, 0],
    [30_000, 3_486],
    [60_000, 11_432],
    [110_000, 33_432],
    [150_000, 53_703],
  ])('£%i of pension income → £%i tax', (income, tax) => {
    expect(personTax(inp({ nonSavings: income }), ctx).incomeTax).toBeCloseTo(tax, 0)
  })

  it('savings within allowance + starting rate are tax free', () => {
    expect(personTax(inp({ nonSavings: 10_000, savings: 5_000 }), ctx).incomeTax).toBe(0)
  })

  it('personal savings allowance then 20%', () => {
    expect(personTax(inp({ nonSavings: 20_000, savings: 3_000 }), ctx).incomeTax).toBeCloseTo(1_486 + 400, 0)
  })

  it('savings rates rise 2 points from 2027/28', () => {
    const t = personTax(inp({ nonSavings: 20_000, savings: 3_000 }), { ...ctx, year: 2027 })
    expect(t.incomeTax).toBeCloseTo(1_486 + 440, 0)
  })

  it('dividends: £500 allowance, higher rate above the band', () => {
    const t = personTax(inp({ nonSavings: 50_000, dividends: 5_000 }), ctx)
    expect(t.incomeTax).toBeCloseTo(7_486 + 4_500 * 0.3575, 1)
  })

  it('CGT at 18% inside the basic band after £3k exemption', () => {
    expect(personTax(inp({ nonSavings: 20_000, gains: 13_000 }), ctx).cgt).toBeCloseTo(1_800, 0)
  })

  it('employee NI below State Pension age only', () => {
    expect(personTax(inp({ nonSavings: 30_000, earnings: 30_000, overSpa: false }), ctx).ni).toBeCloseTo(1_394.4, 1)
    expect(personTax(inp({ nonSavings: 30_000, earnings: 30_000, overSpa: true }), ctx).ni).toBe(0)
  })

  it('Scottish rates on non-savings income', () => {
    const t = personTax(inp({ nonSavings: 30_000 }), { ...ctx, region: 'scotland' })
    expect(t.incomeTax).toBeGreaterThan(3_400)
    expect(t.incomeTax).toBeLessThan(3_500)
  })
})

describe('ages', () => {
  it('pension access moves to 57 for anyone turning 55 after April 2028', () => {
    expect(pensionAccessAge(40, false)).toBe(57)
    expect(pensionAccessAge(40, true)).toBe(55)
    expect(pensionAccessAge(56, false)).toBe(55)
  })
  it('State Pension age 68 for those born after April 1978', () => {
    expect(statePensionAge(1986)).toBe(68)
    expect(statePensionAge(1970)).toBe(67)
  })
})

function flatPlan(): Plan {
  const p = defaultPlan()
  p.couple = false
  p.people[0] = {
    ...p.people[0],
    age: 60,
    retireAge: 60,
    pots: { pension: 0, isa: 100_000, gia: 0, cash: 0, lisa: 0 },
    statePension: { weekly: 0, ageOverride: null },
  }
  p.planToAge = 79 // 20 years
  p.spending.monthly = 500 // £6,000 a year
  p.assumptions = { ...p.assumptions, inflation: 0, fees: 0, cashRate: 0, dividendYield: 0, bondReturn: 0 }
  return p
}

describe('simulation', () => {
  it('ISA-only pot with zero growth lasts exactly pot / spending years', () => {
    const P = prepare(flatPlan())
    const zeros = new Float64Array(P.T)
    const s = simulate(P, zeros, zeros, { record: true })
    // £100k / £6k = 16.67 years → first shortfall in year 16 (index), i.e. age 76
    expect(s.depletedAtIndex).toBe(16)
    expect(s.rows![0].income.isa).toBeCloseTo(6_000, 0)
    expect(s.rows![0].income.tax).toBe(0)
  })

  it('pension income uses the personal allowance tax-free and pays 20% above it', () => {
    const plan = flatPlan()
    plan.people[0].pots = { pension: 500_000, isa: 0, gia: 0, cash: 0, lisa: 0 }
    plan.spending.monthly = 2_000 // £24k net
    const P = prepare(plan)
    const zeros = new Float64Array(P.T)
    const row = simulate(P, zeros, zeros, { record: true }).rows![0]
    const net = row.income.pension - row.income.tax
    expect(net).toBeCloseTo(24_000, -1)
    // UFPLS: 25% tax-free, so taxable = 0.75 × gross; tax = 20% of (taxable − PA)
    const expectedTax = (0.75 * row.income.pension - 12_570) * 0.2
    expect(row.income.tax).toBeCloseTo(expectedTax, 0)
  })

  it('pension is locked until 57: bridge years draw from ISA/cash first', () => {
    const d = runDeterministic(defaultPlan())
    const at55 = d.rows!.find((r) => r.ages[0] === 55)!
    const at57 = d.rows!.find((r) => r.ages[0] === 57)!
    expect(at55.income.pension).toBe(0)
    expect(at57.income.pension).toBeGreaterThan(0)
  })

  it('Monte Carlo runs 1,000 paths quickly and gives sensible percentiles', () => {
    const plan = defaultPlan()
    const P = prepare(plan)
    const t0 = performance.now()
    const M = generateMarkets(P, 1000)
    const mc = runMonteCarlo(P, M)
    const ms = performance.now() - t0
    console.log(`MC 1000 runs × ${P.T} years: ${ms.toFixed(0)} ms, success ${(mc.successRate * 100).toFixed(1)}%`)
    expect(mc.percentiles.p10[20]).toBeLessThan(mc.percentiles.p90[20])
    expect(ms).toBeLessThan(5000)
  })

  it('solver finds a sustainable spend that the deterministic plan can just afford', () => {
    const plan = defaultPlan()
    const m = maxSpendSteady(plan)
    const ok = runDeterministic({ ...plan, spending: { ...plan.spending, monthly: m } }, false)
    const tooMuch = runDeterministic({ ...plan, spending: { ...plan.spending, monthly: m + 100 } }, false)
    console.log('max steady spend £/month', m)
    expect(ok.depletedAtIndex).toBe(-1)
    expect(tooMuch.depletedAtIndex).toBeGreaterThanOrEqual(0)
  })
})

describe('robustness across options', () => {
  const variants: [string, (p: Plan) => void][] = [
    ['guardrails', (p) => void (p.strategy.type = 'guardrails')],
    ['upfront tax-free cash', (p) => void (p.strategy.tfc = 'upfront')],
    ['pensions first', (p) => void (p.strategy.order = 'pensionFirst')],
    ['ISAs first', (p) => void (p.strategy.order = 'preservePension')],
    ['Scotland', (p) => void (p.region = 'scotland')],
    ['single', (p) => void (p.couple = false)],
    ['spending smile + events', (p) => {
      p.spending.smile = true
      p.events = [
        { id: 'a', label: 'Car', age: 50, amount: -20_000, every: 8, untilAge: 80 },
        { id: 'b', label: 'Inheritance', age: 62, amount: 100_000, every: 0, untilAge: 62 },
      ]
    }],
    ['big rich plan with GIA, LISA, DB, work', (p) => {
      p.people[0].pots = { pension: 1_500_000, isa: 300_000, gia: 400_000, cash: 50_000, lisa: 30_000 }
      p.people[0].contrib = { pension: 2_000, isa: 1_666, gia: 500, cash: 100, lisa: 333 }
      p.people[1].db = { annual: 15_000, startAge: 60 }
      p.people[1].work = { annual: 20_000, untilAge: 60 }
      p.spending.monthly = 8_000
    }],
    ['retire after the plan horizon', (p) => {
      p.people[0].retireAge = 85
      p.people[1].retireAge = 85
      p.planToAge = 85
    }],
    ['different ages, both retired', (p) => {
      p.people[0].age = 58
      p.people[0].retireAge = 58
      p.people[1].age = 52
      p.people[1].retireAge = 55
      p.spending.start = 'both'
    }],
  ]
  it.each(variants)('%s: finite numbers, no money created', (_name, mutate) => {
    const plan = defaultPlan()
    mutate(plan)
    const d = runDeterministic(plan)
    for (const r of d.rows!) {
      for (const v of [r.total, r.income.tax, r.spent, r.shortfall, ...Object.values(r.balances)]) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(-1e-6)
      }
      expect(r.spent).toBeLessThanOrEqual(r.target + 1)
    }
    const P = prepare(plan)
    const mc = runMonteCarlo(P, generateMarkets(P, 200))
    expect(mc.successRate).toBeGreaterThanOrEqual(0)
    expect(mc.successRate).toBeLessThanOrEqual(1)
  })

  it('guardrails never succeed less often than fixed spending', () => {
    const fixed = defaultPlan()
    const flex = defaultPlan()
    flex.strategy.type = 'guardrails'
    const P1 = prepare(fixed)
    const P2 = prepare(flex)
    const s1 = runMonteCarlo(P1, generateMarkets(P1, 500)).successRate
    const s2 = runMonteCarlo(P2, generateMarkets(P2, 500)).successRate
    expect(s2).toBeGreaterThanOrEqual(s1)
  })

  it('Scottish taxpayers pay more on £40k of pension income', () => {
    const r = personTax(inp({ nonSavings: 40_000 }), ctx).incomeTax
    const s = personTax(inp({ nonSavings: 40_000 }), { ...ctx, region: 'scotland' }).incomeTax
    expect(s).toBeGreaterThan(r)
  })
})

describe('extra pots switch', () => {
  it('never creates a GIA when GIA/LISA are switched off (overflow goes to cash)', () => {
    const plan = defaultPlan()
    plan.events = [{ id: 'w', label: 'Inheritance', age: 45, amount: 500_000, every: 0, untilAge: 45 }]
    plan.people[0].contrib.isa = 3_000 // £36k a year: over the £20k allowance
    const off = runDeterministic(plan)
    expect(Math.max(...off.rows!.map((r) => r.balances.gia))).toBe(0)
    plan.extraPots = true
    const on = runDeterministic(plan)
    expect(Math.max(...on.rows!.map((r) => r.balances.gia))).toBeGreaterThan(0)
  })
})

describe('tax breakdown per person', () => {
  it('pension withdrawals are 25% tax-free and the household nets exactly the target', () => {
    const plan = defaultPlan()
    const d = runDeterministic(plan)
    const rows = d.rows!.filter((r) => r.phase === 'retired' && r.income.pension > 0 && r.shortfall === 0)
    expect(rows.length).toBeGreaterThan(3)
    for (const r of rows) {
      for (const p of [0, 1]) {
        const x = r.detail[p]
        if (x.pension > 0) expect(x.pensionTaxFree).toBeCloseTo(x.pension * 0.25, 0)
        expect(x.taxableIncome).toBeCloseTo(x.pension - x.pensionTaxFree + x.statePension + x.other + x.savingsIncome, 0)
        expect(x.incomeTax).toBeCloseTo(r.taxByPerson[p], 6)
      }
      const i = r.income
      const gross = i.statePension + i.other + i.pension + i.isa + i.gia + i.cash + i.lisa
      expect(gross - i.tax - r.surplusSaved).toBeCloseTo(r.spent, -1)
    }
  })
})
