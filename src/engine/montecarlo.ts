// Monte Carlo: thousands of plausible market histories (correlated lognormal
// equity/bond returns), each run through the full tax-aware simulation.

import { prepare, type Prepared } from './prepare'
import { simulate, type SimSummary } from './simulate'
import type { Plan } from './types'

/** Small fast seeded PRNG (mulberry32). Same seed → same markets → stable results while you edit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Markets {
  runs: number
  T: number
  eq: Float64Array // runs × T
  bd: Float64Array
}

export function generateMarkets(P: Prepared, runs: number, seed = 20260408): Markets {
  const T = P.T
  const eq = new Float64Array(runs * T)
  const bd = new Float64Array(runs * T)
  const r = rng(seed)
  const c = Math.sqrt(1 - P.rho * P.rho)
  const normals = () => {
    // Box–Muller: two independent standard normals.
    const u1 = Math.max(r(), 1e-12)
    const u2 = r()
    const m = Math.sqrt(-2 * Math.log(u1))
    return [m * Math.cos(2 * Math.PI * u2), m * Math.sin(2 * Math.PI * u2)]
  }
  for (let run = 0; run < runs; run++) {
    // Parameter uncertainty: nobody knows the true long-run return, so each
    // simulated history gets its own slightly different average.
    const [s1, s2] = normals()
    const muEq = P.mu.eq + 0.01 * s1
    const muBd = P.mu.bd + 0.005 * s2
    for (let t = 0; t < T; t++) {
      const [z1, z2] = normals()
      const i = run * T + t
      eq[i] = Math.exp(muEq + P.sigma.eq * z1) - 1
      bd[i] = Math.exp(muBd + P.sigma.bd * (P.rho * z1 + c * z2)) - 1
    }
  }
  return { runs, T, eq, bd }
}

/** Steady "typical" markets: every year earns the median (geometric) return. */
export function steadyMarkets(P: Prepared) {
  return {
    eq: new Float64Array(P.T).fill(Math.exp(P.mu.eq) - 1),
    bd: new Float64Array(P.T).fill(Math.exp(P.mu.bd) - 1),
  }
}

export function runDeterministic(plan: Plan, record = true): SimSummary & { P: Prepared } {
  const P = prepare(plan)
  const m = steadyMarkets(P)
  return { ...simulate(P, m.eq, m.bd, { record }), P }
}

/** Stress test: steady markets, except shares fall 35% (bonds −5%) in the first year of retirement. */
export function runCrash(P: Prepared) {
  const m = steadyMarkets(P)
  const t = Math.min(P.T - 1, P.drawStart)
  m.eq[t] = -0.35
  m.bd[t] = -0.05
  return simulate(P, m.eq, m.bd, { record: true })
}

export interface MCResult {
  runs: number
  T: number
  successRate: number
  cutRate: number // share of runs where spending was ever cut (guardrails)
  bigCutRate: number // share of runs with a real spending cut of more than 10%
  p10MinFactor: number // in a bad 1-in-10 run, lowest spending as share of target
  percentiles: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] }
  depletionAgeP10: number | null // age by which 10% of runs have run out
  medianFinalReal: number
  p10FinalReal: number
  medianMinFactor: number
  representative: { poor: number; typical: number; strong: number } // run indices
  depletedByYear: number[] // cumulative share of runs run out by each year
}

function quantile(sorted: Float64Array | number[], q: number) {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function runMonteCarlo(P: Prepared, M: Markets): MCResult {
  const { runs, T } = M
  const wealth = new Float64Array(runs * T)
  const depl = new Int32Array(runs)
  const finals = new Float64Array(runs)
  const minF = new Float64Array(runs)
  const score = new Float64Array(runs)
  let ok = 0
  let cut = 0
  let bigCut = 0
  for (let r = 0; r < runs; r++) {
    const eq = M.eq.subarray(r * T, (r + 1) * T)
    const bd = M.bd.subarray(r * T, (r + 1) * T)
    const view = wealth.subarray(r * T, (r + 1) * T)
    const s = simulate(P, eq, bd, { wealthReal: view })
    depl[r] = s.depletedAtIndex
    finals[r] = s.finalReal
    minF[r] = s.minSpendingFactor
    if (s.depletedAtIndex < 0) ok++
    if (s.minSpendingFactor < 0.999) cut++
    if (s.minSpendingFactor < 0.9 - 1e-9) bigCut++
    // Rank outcomes: runs that run out rank by how early; otherwise by what's left.
    score[r] = s.depletedAtIndex >= 0 ? -1e12 + s.depletedAtIndex * 1e9 : s.finalReal + sumRange(view, P.drawStart, T)
  }

  const col = new Float64Array(runs)
  const pct = { p10: [] as number[], p25: [] as number[], p50: [] as number[], p75: [] as number[], p90: [] as number[] }
  for (let t = 0; t < T; t++) {
    for (let r = 0; r < runs; r++) col[r] = wealth[r * T + t]
    col.sort()
    pct.p10.push(quantile(col, 0.1))
    pct.p25.push(quantile(col, 0.25))
    pct.p50.push(quantile(col, 0.5))
    pct.p75.push(quantile(col, 0.75))
    pct.p90.push(quantile(col, 0.9))
  }

  const depletedByYear: number[] = []
  for (let t = 0; t < T; t++) {
    let c = 0
    for (let r = 0; r < runs; r++) if (depl[r] >= 0 && depl[r] <= t) c++
    depletedByYear.push(c / runs)
  }
  let depletionAgeP10: number | null = null
  for (let t = 0; t < T; t++) {
    if (depletedByYear[t] >= 0.1) {
      depletionAgeP10 = P.age0[0] + t
      break
    }
  }

  const order = Array.from({ length: runs }, (_, i) => i).sort((a, b) => score[a] - score[b])
  const pick = (q: number) => order[Math.min(runs - 1, Math.max(0, Math.round((runs - 1) * q)))]

  const sortedFinals = Float64Array.from(finals).sort()
  const sortedMinF = Float64Array.from(minF).sort()
  return {
    runs,
    T,
    successRate: ok / runs,
    cutRate: cut / runs,
    bigCutRate: bigCut / runs,
    p10MinFactor: quantile(sortedMinF, 0.1),
    percentiles: pct,
    depletionAgeP10,
    medianFinalReal: quantile(sortedFinals, 0.5),
    p10FinalReal: quantile(sortedFinals, 0.1),
    medianMinFactor: quantile(sortedMinF, 0.5),
    representative: { poor: pick(0.1), typical: pick(0.5), strong: pick(0.9) },
    depletedByYear,
  }
}

function sumRange(a: Float64Array, from: number, to: number) {
  let s = 0
  for (let i = from; i < to; i++) s += a[i]
  return s / Math.max(1, to - from)
}

export function simulateRun(P: Prepared, M: Markets, r: number) {
  const T = M.T
  return simulate(P, M.eq.subarray(r * T, (r + 1) * T), M.bd.subarray(r * T, (r + 1) * T), { record: true })
}

/** Success rate only (for sweeps and solvers). */
export function successRate(P: Prepared, M: Markets): number {
  let ok = 0
  const T = M.T
  for (let r = 0; r < M.runs; r++) {
    const s = simulate(P, M.eq.subarray(r * T, (r + 1) * T), M.bd.subarray(r * T, (r + 1) * T))
    if (s.depletedAtIndex < 0) ok++
  }
  return ok / M.runs
}

function withMonthly(plan: Plan, monthly: number): Plan {
  return { ...plan, spending: { ...plan.spending, monthly } }
}

/** Highest monthly spend that never runs out in steady markets (fixed spending). */
export function maxSpendSteady(plan: Plan): number {
  const fixed: Plan = { ...plan, strategy: { ...plan.strategy, type: 'fixed' } }
  const ok = (m: number) => {
    const P = prepare(withMonthly(fixed, m))
    const mk = steadyMarkets(P)
    return simulate(P, mk.eq, mk.bd).depletedAtIndex < 0
  }
  return bisect(ok, 0, 40_000, 18)
}

/** Highest monthly spend with at least `target` chance of lasting (fixed spending). */
export function maxSpendMC(plan: Plan, runs: number, target: number): number {
  const fixed: Plan = { ...plan, strategy: { ...plan.strategy, type: 'fixed' } }
  const P0 = prepare(fixed)
  const M = generateMarkets(P0, runs, 777)
  const ok = (m: number) => successRate(prepare(withMonthly(fixed, m)), M) >= target
  return bisect(ok, 0, 40_000, 13)
}

function bisect(ok: (x: number) => boolean, lo: number, hi: number, iters: number) {
  if (!ok(lo)) return 0
  if (ok(hi)) return hi
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return Math.floor(lo / 10) * 10
}
