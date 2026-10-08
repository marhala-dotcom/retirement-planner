import { STATE_PENSION } from './rules'
import type { Assumptions, Person, Plan, ReturnPreset } from './types'

/** Capital market assumption presets: long-run compound (median) nominal returns in GBP,
 *  before fees. Central ≈ J.P. Morgan 2026 LTCMA sterling (global equity 6.4%, gilts 4.7%),
 *  Schroders 30-year (6.6%), trimmed slightly for prudence. See docs/RESEARCH.md. */
export const PRESETS: Record<Exclude<ReturnPreset, 'custom'>, Pick<Assumptions, 'equityReturn' | 'equityVol' | 'bondReturn' | 'bondVol' | 'cashRate'>> = {
  cautious: { equityReturn: 0.045, equityVol: 0.16, bondReturn: 0.035, bondVol: 0.06, cashRate: 0.025 },
  central: { equityReturn: 0.06, equityVol: 0.15, bondReturn: 0.043, bondVol: 0.06, cashRate: 0.03 },
  optimistic: { equityReturn: 0.075, equityVol: 0.15, bondReturn: 0.05, bondVol: 0.06, cashRate: 0.035 },
}

const person = (name: string, overrides: Partial<Person>): Person => ({
  name,
  age: 40,
  retireAge: 55,
  pots: { pension: 0, isa: 0, gia: 0, cash: 0, lisa: 0 },
  contrib: { pension: 0, isa: 0, gia: 0, cash: 0, lisa: 0 },
  giaBasisPct: 0.8,
  statePension: { weekly: STATE_PENSION.fullWeekly, ageOverride: null },
  db: { annual: 0, startAge: 65 },
  work: { annual: 0, untilAge: 60 },
  protectedPensionAge: false,
  ...overrides,
})

export function defaultPlan(): Plan {
  return {
    version: 1,
    couple: true,
    region: 'rUK',
    planToAge: 100,
    people: [
      person('You', { pots: { pension: 140_000, isa: 50_000, gia: 0, cash: 15_000, lisa: 0 } }),
      person('Partner', { pots: { pension: 60_000, isa: 25_000, gia: 0, cash: 10_000, lisa: 0 } }),
    ],
    spending: {
      monthly: 3_000,
      smile: false,
      slowAge: 75,
      slowPct: -0.1,
      lateAge: 85,
      latePct: -0.2,
      essentialPct: 0.75,
      start: 'first',
    },
    strategy: {
      type: 'fixed',
      tfc: 'ufpls',
      order: 'taxSmart',
      bedAndIsa: true,
      usePersonalAllowance: true,
    },
    assumptions: {
      preset: 'central',
      ...PRESETS.central,
      correlation: 0.2,
      inflation: 0.025,
      fees: 0.004,
      equityPre: 0.8,
      equityPost: 0.6,
      dividendYield: 0.02,
      statePensionReal: 0.005,
      thresholdsAfterFreeze: 'cpi',
      contribGrowthReal: 0,
    },
    events: [],
    simulations: 2000,
  }
}
