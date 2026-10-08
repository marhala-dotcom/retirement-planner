import { monthsToPayOff } from '../engine/mortgage'
import type { Prepared } from '../engine/prepare'

/** Year index when the mortgage is gone under the chosen plan (null if there's none). */
export function mortgageFreeIdx(P: Prepared): number | null {
  const m = P.plan.mortgage
  if (m.balance <= 0) return null
  const natural = Math.ceil(monthsToPayOff(m) / 12)
  const firstAccess = Math.min(...[0, 1].slice(0, P.n).map((p) => Math.max(0, P.accessAge[p] - P.age0[p])))
  switch (m.strategy) {
    case 'overpay':
    case 'atRetirement':
      return Math.min(natural, P.drawStart)
    case 'atAccess':
      return Math.min(natural, Math.max(P.drawStart, firstAccess))
    default:
      return Number.isFinite(natural) ? natural : null
  }
}

export interface Milestone {
  /** On the x-axis (age of person 1). */
  x: number
  label: string
  who: 0 | 1
  kind: 'retire' | 'access' | 'state' | 'lisa' | 'mortgage'
}

export function milestones(P: Prepared): Milestone[] {
  const plan = P.plan
  const out: Milestone[] = []
  const names = plan.people.map((p, i) => p.name || (i ? 'Partner' : 'You'))
  for (let p = 0; p < P.n; p++) {
    const shift = P.age0[0] - P.age0[p]
    const who = p as 0 | 1
    const tag = P.n > 1 ? ` (${names[p]})` : ''
    out.push({ x: plan.people[p].retireAge + shift, label: `Retire${tag}`, who, kind: 'retire' })
    out.push({ x: P.accessAge[p] + shift, label: `Pension unlocks${tag}`, who, kind: 'access' })
    if (plan.people[p].statePension.weekly > 0) out.push({ x: Math.ceil(P.spa[p]) + shift, label: `State Pension${tag}`, who, kind: 'state' })
  }
  const free = mortgageFreeIdx(P)
  if (free != null) out.push({ x: P.age0[0] + free, label: 'Mortgage-free', who: 0, kind: 'mortgage' })

  // Merge identical x+kind for couples the same age.
  const merged: Milestone[] = []
  for (const m of out) {
    const same = merged.find((x) => x.x === m.x && x.kind === m.kind)
    if (same) same.label = same.label.replace(/ \(.*\)$/, '') + (P.n > 1 ? ' (both)' : '')
    else merged.push({ ...m })
  }
  return merged.sort((a, b) => a.x - b.x)
}
