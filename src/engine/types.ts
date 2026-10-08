// Core data model. Every money input is in TODAY'S pounds; the engine inflates
// internally and reports both nominal and real (today's money) figures.

import type { Mortgage } from './mortgage'

export type Region = 'rUK' | 'scotland'
export type WrapperKey = 'pension' | 'isa' | 'gia' | 'cash' | 'lisa'
export const WRAPPERS: WrapperKey[] = ['pension', 'isa', 'gia', 'cash', 'lisa']

export interface Pots {
  pension: number // SIPP / workplace defined-contribution pension
  isa: number // stocks & shares ISA (cash ISA can be included here at 0% equity)
  gia: number // general investment account (taxable)
  cash: number // savings accounts, premium bonds etc.
  lisa: number // Lifetime ISA
}

export interface Person {
  name: string
  age: number
  retireAge: number
  pots: Pots
  /** Monthly contributions until retirement (pension = gross incl. tax relief + employer). */
  contrib: Pots
  /** GIA cost basis as a share of current value (0–1). Used for CGT. */
  giaBasisPct: number
  statePension: {
    weekly: number // today's £ per week (gov.uk forecast); 0 = none
    ageOverride: number | null // null = automatic from age
  }
  db: { annual: number; startAge: number } // defined-benefit pension, today's £ a year, CPI-linked
  work: { annual: number; untilAge: number } // part-time earnings after retiring, gross today's £
  protectedPensionAge: boolean // can still access pension at 55 after 2028
}

export interface LifeEvent {
  id: string
  label: string
  /** Age of person 1 when it happens. */
  age: number
  /** Today's £. Positive = money in (inheritance, downsizing), negative = expense. */
  amount: number
  /** Repeat every N years (0 = one-off). */
  every: number
  /** Last age (person 1) for repeating events. */
  untilAge: number
}

export type Strategy = 'fixed' | 'guardrails'
export type TfcMode = 'ufpls' | 'upfront'
export type DrawOrder = 'taxSmart' | 'preservePension' | 'pensionFirst'
export type ReturnPreset = 'cautious' | 'central' | 'optimistic' | 'custom'

export interface Assumptions {
  preset: ReturnPreset
  equityReturn: number // long-run compound (median) nominal annual return, e.g. 0.06
  equityVol: number
  bondReturn: number
  bondVol: number
  correlation: number
  cashRate: number // nominal interest on cash
  inflation: number // CPI
  fees: number // platform + fund charges, % a year
  equityPre: number // share in equities before retirement (0–1)
  equityPost: number // share in equities in retirement (0–1)
  dividendYield: number // for GIA tax
  statePensionReal: number // growth above CPI (triple lock), e.g. 0.005
  thresholdsAfterFreeze: 'cpi' | 'frozen'
  contribGrowthReal: number // contributions rise by this much above inflation
}

export interface Spending {
  monthly: number // household net take-home, today's £
  smile: boolean
  slowAge: number // age of person 1
  slowPct: number // e.g. -0.1 = 10% less
  lateAge: number
  latePct: number
  essentialPct: number // floor used by guardrails (0–1)
  start: 'first' | 'both' // spending starts when first / both retire
}

export interface Plan {
  version: 1
  couple: boolean
  region: Region
  planToAge: number
  people: [Person, Person]
  spending: Spending
  strategy: {
    type: Strategy
    tfc: TfcMode
    order: DrawOrder
    bedAndIsa: boolean
    usePersonalAllowance: boolean
  }
  assumptions: Assumptions
  events: LifeEvent[]
  simulations: number
  /** Show/use the general investment account and Lifetime ISA. When off, money that
   *  overflows ISA allowances goes to cash instead of a GIA. */
  extraPots: boolean
  mortgage: Mortgage
}

export interface IncomeBreakdown {
  statePension: number
  other: number // DB + work + windfalls
  pension: number // gross pension withdrawals
  isa: number
  gia: number
  cash: number
  lisa: number
  tax: number // household income tax + CGT + NI
}

/** One simulated year (nominal £ unless named *Real). */
export interface YearRow {
  year: number // tax year starting (2026 = 2026/27)
  ages: [number, number]
  phase: 'saving' | 'retired'
  deflator: number // divide nominal by this for today's £
  balances: Record<WrapperKey, number> // household end-of-year
  balancesByPerson: [Pots, Pots]
  total: number
  target: number // household net spending target for the year
  spent: number // actually funded net spending
  shortfall: number
  income: IncomeBreakdown
  taxByPerson: [number, number]
  higherRate: [boolean, boolean] // taxable income above the basic-rate band
  contributions: number
  mortgage: number // mortgage payments/payoff taken from savings this year
  surplusSaved: number // excess income reinvested
  spendingFactor: number // guardrail multiplier
  pensionAccess: [boolean, boolean]
  marketReturn: number // equity return that year
}

export interface SimResult {
  rows: YearRow[]
  depletedAtIndex: number | null // first year with a shortfall
  potAtRetirementReal: number
  finalReal: number
  totalTaxReal: number
  minSpendingFactor: number
  cutYears: number // years spending was below target
}
