import type { Prepared } from '../engine/prepare'

export interface Milestone {
  /** On the x-axis (age of person 1). */
  x: number
  label: string
  who: 0 | 1
  kind: 'retire' | 'access' | 'state' | 'lisa'
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
  // Merge identical x+kind for couples the same age.
  const merged: Milestone[] = []
  for (const m of out) {
    const same = merged.find((x) => x.x === m.x && x.kind === m.kind)
    if (same) same.label = same.label.replace(/ \(.*\)$/, '') + (P.n > 1 ? ' (both)' : '')
    else merged.push({ ...m })
  }
  return merged.sort((a, b) => a.x - b.x)
}
