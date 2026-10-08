import { WRAPPERS, type Plan, type WrapperKey } from '../engine/types'

const CORE: WrapperKey[] = ['pension', 'isa', 'cash']

/** Pots shown in the app. GIA and Lifetime ISA are hidden unless switched on — or
 *  unless the plan already has money or saving in them (so nothing is ever hidden silently). */
export function visibleWrappers(plan: Plan): WrapperKey[] {
  if (plan.extraPots) return WRAPPERS
  const people = plan.couple ? plan.people : [plan.people[0]]
  const used = (w: WrapperKey) => people.some((p) => p.pots[w] > 0 || p.contrib[w] > 0)
  return WRAPPERS.filter((w) => CORE.includes(w) || used(w))
}

export const showsGia = (plan: Plan) => visibleWrappers(plan).includes('gia')
