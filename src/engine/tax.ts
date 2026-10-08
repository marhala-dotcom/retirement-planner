import { CGT, DIVIDENDS, INCOME_TAX, NI, SAVINGS, SCOTTISH_BANDS } from './rules'
import type { Region } from './types'

export interface TaxInput {
  nonSavings: number // pensions, State Pension, DB, earnings (taxable part only)
  earnings: number // part of nonSavings that is earned income (for National Insurance)
  savings: number // interest
  dividends: number
  gains: number // realised capital gains before the annual exempt amount
  overSpa: boolean // no NI above State Pension age
}

export interface TaxContext {
  region: Region
  year: number
  idx: number // threshold multiplier (1 while frozen)
}

export interface TaxResult {
  incomeTax: number
  cgt: number
  ni: number
  total: number
  personalAllowance: number
}

/** Personal allowance after the £100k taper. */
export function personalAllowance(totalIncome: number, idx: number): number {
  const pa = INCOME_TAX.personalAllowance * idx
  const over = Math.max(0, totalIncome - INCOME_TAX.taperThreshold * idx)
  return Math.max(0, pa - over / 2)
}

// Tax `amount` of income stacked on top of `start` of taxable income, using UK bands.
function ukBandTax(start: number, amount: number, b: number, a: number, r1: number, r2: number, r3: number) {
  if (amount <= 0) return 0
  let tax = 0
  const end = start + amount
  const inBasic = Math.max(0, Math.min(end, b) - Math.max(start, 0))
  const inHigher = Math.max(0, Math.min(end, a) - Math.max(start, b))
  const inAdd = Math.max(0, end - Math.max(start, a))
  tax += inBasic * r1 + inHigher * r2 + inAdd * r3
  return tax
}

function scottishTax(taxable: number, idx: number) {
  let tax = 0
  let prev = 0
  for (const band of SCOTTISH_BANDS) {
    const top = band.upTo * idx
    if (taxable <= prev) break
    const slice = Math.min(taxable, top) - prev
    tax += slice * band.rate
    prev = top
  }
  return tax
}

/** Income tax, CGT and NI for one person for one tax year. */
export function personTax(inp: TaxInput, ctx: TaxContext): TaxResult {
  const { idx } = ctx
  const ns = Math.max(0, inp.nonSavings)
  const sav = Math.max(0, inp.savings)
  const div = Math.max(0, inp.dividends)
  const total = ns + sav + div
  const pa = personalAllowance(total, idx)

  // Allowance is used against non-savings, then savings, then dividends.
  const tNS = Math.max(0, ns - pa)
  let paLeft = Math.max(0, pa - ns)
  const tS = Math.max(0, sav - paLeft)
  paLeft = Math.max(0, paLeft - sav)
  const tD = Math.max(0, div - paLeft)
  const taxable = tNS + tS + tD

  const B = INCOME_TAX.basicBand * idx
  const A = INCOME_TAX.additionalThreshold * idx
  const { basic, higher, additional } = INCOME_TAX.rates

  let incomeTax =
    ctx.region === 'scotland' ? scottishTax(tNS, idx) : ukBandTax(0, tNS, B, A, basic, higher, additional)

  // Savings: starting-rate band, then personal savings allowance, then band rates.
  let pos = tNS
  if (tS > 0) {
    const srb = Math.max(0, SAVINGS.startingRateBand * idx - tNS)
    const psa = taxable > A ? 0 : taxable > B ? SAVINGS.psaHigher * idx : SAVINGS.psaBasic * idx
    const free = Math.min(tS, srb + psa)
    const sr = SAVINGS.rates(ctx.year)
    incomeTax += ukBandTax(pos + free, tS - free, B, A, sr.basic, sr.higher, sr.additional)
    pos += tS
  }
  if (tD > 0) {
    const free = Math.min(tD, DIVIDENDS.allowance * idx)
    const dr = DIVIDENDS.rates
    incomeTax += ukBandTax(pos + free, tD - free, B, A, dr.basic, dr.higher, dr.additional)
  }

  // Capital gains: 18% within any unused basic-rate band, 24% above.
  let cgt = 0
  const chargeable = Math.max(0, inp.gains - CGT.annualExempt * idx)
  if (chargeable > 0) {
    const basicLeft = Math.max(0, B - taxable)
    const lo = Math.min(chargeable, basicLeft)
    cgt = lo * CGT.basic + (chargeable - lo) * CGT.higher
  }

  // Class 1 employee NI on earnings below State Pension age.
  let ni = 0
  if (!inp.overSpa && inp.earnings > 0) {
    const pt = NI.primaryThreshold * idx
    const uel = NI.upperEarningsLimit * idx
    ni = Math.max(0, Math.min(inp.earnings, uel) - pt) * NI.main + Math.max(0, inp.earnings - uel) * NI.upper
  }

  return { incomeTax, cgt, ni, total: incomeTax + cgt + ni, personalAllowance: pa }
}

/** Total income at which the next band above "basic" starts (where pension draws stop being cheap). */
export function higherRateStart(region: Region, idx: number): number {
  if (region === 'scotland') return (SCOTTISH_BANDS[2].upTo + INCOME_TAX.personalAllowance) * idx
  return (INCOME_TAX.basicBand + INCOME_TAX.personalAllowance) * idx
}
