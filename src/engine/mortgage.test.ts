import { describe, expect, it } from 'vitest'
import { defaultPlan } from './defaults'
import { balanceAfter, monthsToPayOff, mortgageOutflows, paymentToClear, type Mortgage } from './mortgage'
import { runDeterministic } from './montecarlo'

const m: Mortgage = { balance: 200_000, rate: 0.05, monthly: 1_300, strategy: 'atRetirement' }

describe('mortgage maths', () => {
  it('amortises consistently', () => {
    const n = monthsToPayOff(m)
    expect(n).toBeGreaterThan(200)
    expect(n).toBeLessThan(260)
    expect(balanceAfter(m, n)).toBe(0)
    expect(balanceAfter(m, n - 2)).toBeGreaterThan(0)
  })

  it('finds the payment that clears it in a given time', () => {
    const p = paymentToClear(m, 120)
    expect(balanceAfter({ ...m, monthly: p }, 120)).toBeLessThan(1)
    expect(balanceAfter({ ...m, monthly: p - 10 }, 120)).toBeGreaterThan(100)
  })

  it('flags a payment that never covers the interest', () => {
    expect(monthsToPayOff({ ...m, monthly: 500 })).toBe(Infinity)
  })

  it('only touches savings after retirement, per strategy', () => {
    const T = 40
    const at = mortgageOutflows(m, T, 10, 12)
    expect(at.slice(0, 10).every((x) => x === 0)).toBe(true)
    expect(at[10]).toBeCloseTo(balanceAfter(m, 120), 6)
    expect(at.reduce((a, b) => a + b, 0)).toBeCloseTo(at[10], 6)

    expect(mortgageOutflows({ ...m, strategy: 'overpay' }, T, 10, 12).every((x) => x === 0)).toBe(true)

    const acc = mortgageOutflows({ ...m, strategy: 'atAccess' }, T, 10, 12)
    expect(acc[10]).toBeCloseTo(m.monthly * 12, 6)
    expect(acc[11]).toBeCloseTo(m.monthly * 12, 6)
    expect(acc[12]).toBeCloseTo(balanceAfter(m, 144), 6)
    expect(acc[13]).toBe(0)

    const term = mortgageOutflows({ ...m, strategy: 'term' }, T, 10, 12)
    const total = term.reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(m.monthly * (monthsToPayOff(m) - 120), 0)
  })

  it('a payoff at retirement shrinks what is left vs no mortgage', () => {
    const plan = defaultPlan()
    const base = runDeterministic(plan)
    plan.mortgage = { ...m }
    const withMortgage = runDeterministic(plan)
    const idx = base.P.drawStart + 1
    expect(withMortgage.rows![idx].total).toBeLessThan(base.rows![idx].total - 50_000)
    expect(withMortgage.rows![base.P.drawStart].mortgage).toBeGreaterThan(50_000)
  })
})

describe('other (family) loan', () => {
  it('is repaid once, in actual pounds, only when chosen', async () => {
    const { loanOutflows } = await import('./mortgage')
    const loan = { label: 'Family loan', amount: 120_000, repay: 'none' as const }
    expect(loanOutflows(loan, 40, 15, 17).every((x) => x === 0)).toBe(true)
    const atRet = loanOutflows({ ...loan, repay: 'atRetirement' }, 40, 15, 17)
    expect(atRet[15]).toBe(120_000)
    expect(atRet.reduce((a, b) => a + b, 0)).toBe(120_000)
    const atAcc = loanOutflows({ ...loan, repay: 'atAccess' }, 40, 15, 17)
    expect(atAcc[17]).toBe(120_000)
  })

  it('repaying it lowers what is left; writing it off does not', () => {
    const plan = defaultPlan()
    plan.otherLoan = { label: 'Family loan', amount: 120_000, repay: 'none' }
    const off = runDeterministic(plan)
    plan.otherLoan.repay = 'atRetirement'
    const on = runDeterministic(plan)
    const t = off.P.drawStart + 1
    expect(on.rows![t].total).toBeLessThan(off.rows![t].total - 100_000)
  })
})
