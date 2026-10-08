// Scenarios live only in this browser (localStorage). Nothing is sent anywhere.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultPlan } from '../engine/defaults'
import type { Plan } from '../engine/types'

export interface Scenario {
  id: string
  name: string
  plan: Plan
}

interface Stored {
  scenarios: Scenario[]
  activeId: string
}

const KEY = 'horizon-retirement.v1'

const uid = () => Math.random().toString(36).slice(2, 10)

/** Fill in any fields added since the plan was saved. */
function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    if (over && typeof over === 'object') {
      for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
        out[k] = k in out ? deepMerge(out[k], v) : v
      }
    }
    return out as T
  }
  return (over === undefined || over === null ? base : over) as T
}

export function normalizePlan(p: unknown): Plan {
  const merged = deepMerge(defaultPlan(), p)
  const d = defaultPlan()
  merged.people = [deepMerge(d.people[0], merged.people?.[0]), deepMerge(d.people[1], merged.people?.[1])]
  return merged
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Stored
      if (s.scenarios?.length) {
        return {
          scenarios: s.scenarios.map((x) => ({ ...x, plan: normalizePlan(x.plan) })),
          activeId: s.scenarios.some((x) => x.id === s.activeId) ? s.activeId : s.scenarios[0].id,
        }
      }
    }
  } catch {
    /* storage unavailable – fall back to the example plan */
  }
  const id = uid()
  return { scenarios: [{ id, name: 'Retire at 55', plan: defaultPlan() }], activeId: id }
}

export function usePlans() {
  const [state, setState] = useState<Stored>(load)

  useEffect(() => {
    const h = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        /* ignore */
      }
    }, 300)
    return () => clearTimeout(h)
  }, [state])

  const active = useMemo(() => state.scenarios.find((s) => s.id === state.activeId) ?? state.scenarios[0], [state])

  const edit = useCallback((fn: (draft: Plan) => void) => {
    setState((s) => ({
      ...s,
      scenarios: s.scenarios.map((x) => {
        if (x.id !== s.activeId) return x
        const draft = structuredClone(x.plan)
        fn(draft)
        return { ...x, plan: draft }
      }),
    }))
  }, [])

  const select = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), [])

  const duplicate = useCallback((name?: string) => {
    setState((s) => {
      const cur = s.scenarios.find((x) => x.id === s.activeId)!
      const id = uid()
      return { scenarios: [...s.scenarios, { id, name: name ?? `${cur.name} (copy)`, plan: structuredClone(cur.plan) }], activeId: id }
    })
  }, [])

  const addPlan = useCallback((name: string, plan: Plan) => {
    setState((s) => {
      const id = uid()
      return { scenarios: [...s.scenarios, { id, name, plan: normalizePlan(plan) }], activeId: id }
    })
  }, [])

  const rename = useCallback((name: string) => {
    setState((s) => ({ ...s, scenarios: s.scenarios.map((x) => (x.id === s.activeId ? { ...x, name } : x)) }))
  }, [])

  const remove = useCallback(() => {
    setState((s) => {
      if (s.scenarios.length <= 1) return { ...s, scenarios: [{ ...s.scenarios[0], plan: defaultPlan(), name: 'Retire at 55' }] }
      const rest = s.scenarios.filter((x) => x.id !== s.activeId)
      return { scenarios: rest, activeId: rest[0].id }
    })
  }, [])

  const reset = useCallback(() => edit((d) => Object.assign(d, defaultPlan())), [edit])

  return { scenarios: state.scenarios, active, edit, select, duplicate, addPlan, rename, remove, reset }
}
