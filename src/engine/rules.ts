// UK tax and pension rules. Base year = 2026/27 tax year (6 Apr 2026 – 5 Apr 2027).
// Sources are listed in docs/RESEARCH.md. Update this file when the rules change.

export const BASE_YEAR = 2026

/** Last tax year (starting) for which thresholds are frozen in cash terms. */
export const FREEZE_LAST_YEAR = 2030 // frozen to 5 April 2031

export const INCOME_TAX = {
  personalAllowance: 12_570,
  taperThreshold: 100_000,
  basicBand: 37_700, // taxable income band at 20%
  additionalThreshold: 125_140, // taxable income above this at 45%
  rates: { basic: 0.2, higher: 0.4, additional: 0.45 },
}

/** Scottish rates apply to non-savings, non-dividend income only. Bands are on
 *  taxable income (i.e. above the personal allowance). 2026/27. */
export const SCOTTISH_BANDS: { upTo: number; rate: number }[] = [
  { upTo: 16_537 - 12_570, rate: 0.19 }, // starter
  { upTo: 29_526 - 12_570, rate: 0.2 }, // basic
  { upTo: 43_662 - 12_570, rate: 0.21 }, // intermediate
  { upTo: 75_000 - 12_570, rate: 0.42 }, // higher
  { upTo: 125_140, rate: 0.45 }, // advanced (PA is nil above £125,140)
  { upTo: Infinity, rate: 0.48 }, // top
]

export const SAVINGS = {
  startingRateBand: 5_000,
  psaBasic: 1_000,
  psaHigher: 500,
  /** Savings rates rise by 2 points from 2027/28. */
  rates: (year: number) =>
    year >= 2027
      ? { basic: 0.22, higher: 0.42, additional: 0.47 }
      : { basic: 0.2, higher: 0.4, additional: 0.45 },
}

export const DIVIDENDS = {
  allowance: 500,
  rates: { basic: 0.1075, higher: 0.3575, additional: 0.3935 },
}

export const CGT = { annualExempt: 3_000, basic: 0.18, higher: 0.24 }

export const NI = { primaryThreshold: 12_570, upperEarningsLimit: 50_270, main: 0.08, upper: 0.02 }

export const ISA_ALLOWANCE = 20_000
export const LISA = { maxContribution: 4_000, bonus: 0.25, lastContribAge: 49, accessAge: 60 }

export const PENSION = {
  annualAllowance: 60_000,
  mpaa: 10_000,
  lumpSumAllowance: 268_275,
  taxFreeShare: 0.25,
  nmpaBefore2028: 55,
  nmpaFrom2028: 57,
  nmpaChangeYear: 2028, // 6 April 2028
}

export const STATE_PENSION = {
  fullWeekly: 241.3, // full new State Pension 2026/27
  qualifyingYears: 35,
}

/** Pensions UK (formerly PLSA) Retirement Living Standards, June 2026 — annual spending after tax,
 *  home owned outright, outside London. */
export const PLSA = {
  single: { minimum: 13_900, moderate: 32_700, comfortable: 45_400 },
  couple: { minimum: 22_500, moderate: 45_400, comfortable: 62_700 },
}

/** Threshold multiplier: frozen until FREEZE_LAST_YEAR, then CPI (or frozen). */
export function thresholdIndex(year: number, inflation: number, afterFreeze: 'cpi' | 'frozen'): number {
  if (afterFreeze === 'frozen' || year <= FREEZE_LAST_YEAR) return 1
  return Math.pow(1 + inflation, year - FREEZE_LAST_YEAR)
}

/** Approximate birth year from age today (assumes birthday already passed this tax year). */
export function birthYearFromAge(age: number): number {
  return BASE_YEAR - age
}

/** State Pension age by birth year (Pensions Acts 2007/2011/2014 timetable). */
export function statePensionAge(birthYear: number): number {
  if (birthYear < 1960) return 66
  if (birthYear === 1960) return 66.5 // phased 66→67 for those born Apr 1960 – Mar 1961
  if (birthYear < 1977) return 67
  if (birthYear === 1977) return 67.5 // phased 67→68 for those born Apr 1977 – Apr 1978
  return 68
}

/** Earliest age a private pension can be accessed (normal minimum pension age). */
export function pensionAccessAge(currentAge: number, isProtected: boolean): number {
  if (isProtected) return 55
  const yearAt55 = BASE_YEAR + (55 - currentAge)
  // Anyone turning 55 before 6 April 2028 can already access at 55.
  return yearAt55 < PENSION.nmpaChangeYear ? 55 : 57
}
