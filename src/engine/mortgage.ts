// Repayment mortgage (or home purchase plan) maths. Balances and payments are in
// actual pounds — a mortgage doesn't rise with inflation.

export type MortgageStrategy = 'overpay' | 'atRetirement' | 'atAccess' | 'term'

export interface Mortgage {
  balance: number // outstanding today
  rate: number // annual interest / rental rate, e.g. 0.0494
  monthly: number // current monthly payment
  strategy: MortgageStrategy
}

const monthlyRate = (rate: number) => Math.pow(1 + rate, 1 / 12) - 1

/** Balance left after `months` monthly payments (never below zero). */
export function balanceAfter(m: Pick<Mortgage, 'balance' | 'rate' | 'monthly'>, months: number): number {
  if (m.balance <= 0 || months <= 0) return Math.max(0, m.balance)
  const i = monthlyRate(m.rate)
  if (i === 0) return Math.max(0, m.balance - m.monthly * months)
  const g = Math.pow(1 + i, months)
  return Math.max(0, m.balance * g - (m.monthly * (g - 1)) / i)
}

/** Months until paid off at the current payment (Infinity if the payment doesn't cover interest). */
export function monthsToPayOff(m: Pick<Mortgage, 'balance' | 'rate' | 'monthly'>): number {
  if (m.balance <= 0) return 0
  if (m.monthly <= 0) return Infinity
  const i = monthlyRate(m.rate)
  if (i === 0) return Math.ceil(m.balance / m.monthly)
  const x = 1 - (m.balance * i) / m.monthly
  if (x <= 0) return Infinity
  return Math.ceil(-Math.log(x) / Math.log(1 + i))
}

/** Monthly payment that clears the balance in exactly `months`. */
export function paymentToClear(m: Pick<Mortgage, 'balance' | 'rate'>, months: number): number {
  if (m.balance <= 0) return 0
  if (months <= 0) return Infinity
  const i = monthlyRate(m.rate)
  if (i === 0) return m.balance / months
  return (m.balance * i) / (1 - Math.pow(1 + i, -months))
}

/**
 * Mortgage money that has to come out of savings in each simulated year (actual £).
 * Before retirement payments come from salary, so they never touch the pots.
 * - overpay:      you clear it from salary before retiring → nothing from savings
 * - atRetirement: whatever is left is paid off in the first year of retirement
 * - atAccess:     keep paying monthly from savings until pensions unlock, then clear the rest
 * - term:         keep paying monthly from savings until it ends naturally
 */
export function mortgageOutflows(m: Mortgage, T: number, drawStart: number, accessIdx: number): Float64Array {
  const out = new Float64Array(T)
  if (m.balance <= 0 || m.strategy === 'overpay' || drawStart >= T) return out
  const payoffAt = (t: number) => {
    if (t < T) out[t] += balanceAfter(m, 12 * t)
  }
  if (m.strategy === 'atRetirement') {
    payoffAt(drawStart)
    return out
  }
  const end = m.strategy === 'atAccess' ? Math.max(drawStart, accessIdx) : T
  const total = monthsToPayOff(m)
  for (let t = drawStart; t < Math.min(end, T); t++) {
    const monthsLeft = Math.max(0, Math.min(12, total - 12 * t))
    out[t] += m.monthly * monthsLeft
  }
  if (m.strategy === 'atAccess') payoffAt(end)
  return out
}
