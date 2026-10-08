/// <reference lib="webworker" />
// Runs the heavy maths off the main thread so sliders stay smooth.
// Stages post back as soon as they finish; a newer request aborts older ones.

import { generateMarkets, maxSpendMC, maxSpendSteady, runMonteCarlo, simulateRun, successRate } from './montecarlo'
import { prepare } from './prepare'
import type { Plan } from './types'

export type WorkerRequest = { type: 'run'; id: number; plan: Plan } | { type: 'compare'; id: number; plans: Plan[] }

export interface SweepPoint {
  retireAge: number
  success: number
  maxSpend: number
}

export type WorkerResponse =
  | {
      type: 'mc'
      id: number
      mc: ReturnType<typeof runMonteCarlo>
      paths: { poor: NonNullable<ReturnType<typeof simulateRun>['rows']>; strong: NonNullable<ReturnType<typeof simulateRun>['rows']> }
    }
  | { type: 'solve'; id: number; maxSteady: number; max90: number; max75: number; altSuccess: number }
  | { type: 'sweep'; id: number; sweep: SweepPoint[] }
  | { type: 'compare'; id: number; results: { success: number; maxSteady: number }[] }

let latest = 0
const tick = () => new Promise((r) => setTimeout(r, 0))

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  if (msg.type === 'run') latest = msg.id
  const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m)
  const stale = () => msg.type === 'run' && latest !== msg.id

  if (msg.type === 'compare') {
    const results = msg.plans.map((plan) => {
      const P = prepare(plan)
      return { success: successRate(P, generateMarkets(P, 500)), maxSteady: maxSpendSteady(plan) }
    })
    post({ type: 'compare', id: msg.id, results })
    return
  }

  const plan = msg.plan
  const P = prepare(plan)
  const M = generateMarkets(P, plan.simulations)
  const mc = runMonteCarlo(P, M)
  const poor = simulateRun(P, M, mc.representative.poor).rows!
  const strong = simulateRun(P, M, mc.representative.strong).rows!
  post({ type: 'mc', id: msg.id, mc, paths: { poor, strong } })

  await tick()
  if (stale()) return
  const maxSteady = maxSpendSteady(plan)
  const max90 = maxSpendMC(plan, 400, 0.9)
  await tick()
  if (stale()) return
  const max75 = maxSpendMC(plan, 400, 0.75)
  // Same plan with the other spending rule, to show what flexibility is worth.
  const alt: Plan = { ...plan, strategy: { ...plan.strategy, type: plan.strategy.type === 'fixed' ? 'guardrails' : 'fixed' } }
  const altP = prepare(alt)
  const altSuccess = successRate(altP, generateMarkets(altP, 600))
  post({ type: 'solve', id: msg.id, maxSteady, max90, max75, altSuccess })

  await tick()
  if (stale()) return
  const sweep: SweepPoint[] = []
  const base = plan.people[0].retireAge
  const youngestNow = Math.max(plan.people[0].age, 45)
  for (let a = Math.max(youngestNow, base - 7); a <= Math.min(base + 7, plan.planToAge - 5); a++) {
    const d = a - base
    const shifted: Plan = structuredClone(plan)
    shifted.people[0].retireAge = a
    shifted.people[1].retireAge = Math.max(shifted.people[1].age, shifted.people[1].retireAge + d)
    const SP = prepare(shifted)
    sweep.push({ retireAge: a, success: successRate(SP, generateMarkets(SP, 400)), maxSpend: maxSpendSteady(shifted) })
    if (sweep.length % 4 === 0) {
      await tick()
      if (stale()) return
    }
  }
  post({ type: 'sweep', id: msg.id, sweep })
}
