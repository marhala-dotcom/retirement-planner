import { useEffect, useMemo, useRef, useState } from 'react'
import { runDeterministic, type MCResult } from '../engine/montecarlo'
import type { Plan, YearRow } from '../engine/types'
import type { SweepPoint, WorkerRequest, WorkerResponse } from '../engine/worker'

export interface EngineState {
  steady: ReturnType<typeof runDeterministic>
  mc: MCResult | null
  paths: { poor: YearRow[]; strong: YearRow[] } | null
  solve: { maxSteady: number; max90: number; max75: number; altSuccess: number } | null
  sweep: SweepPoint[] | null
  busy: boolean
}

let worker: Worker | null = null
function getWorker() {
  if (!worker) worker = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' })
  return worker
}

let nextId = 1

/** Steady-markets projection runs instantly on every edit; Monte Carlo and solvers run in a worker. */
export function useEngine(plan: Plan): EngineState {
  const steady = useMemo(() => runDeterministic(plan), [plan])
  const [async, setAsync] = useState<Omit<EngineState, 'steady' | 'busy'> & { id: number }>({
    id: 0,
    mc: null,
    paths: null,
    solve: null,
    sweep: null,
  })
  const [busy, setBusy] = useState(true)
  const current = useRef(0)

  useEffect(() => {
    const w = getWorker()
    const onMsg = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data
      if (m.type === 'compare' || m.id !== current.current) return
      setAsync((s) => {
        if (m.type === 'mc') return { ...s, id: m.id, mc: m.mc, paths: m.paths }
        if (m.type === 'solve') return { ...s, solve: { maxSteady: m.maxSteady, max90: m.max90, max75: m.max75, altSuccess: m.altSuccess } }
        return { ...s, sweep: m.sweep }
      })
      if (m.type === 'sweep') setBusy(false)
    }
    w.addEventListener('message', onMsg)
    return () => w.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    const h = setTimeout(() => {
      const id = nextId++
      current.current = id
      setBusy(true)
      getWorker().postMessage({ type: 'run', id, plan } satisfies WorkerRequest)
    }, 120)
    return () => clearTimeout(h)
  }, [plan])

  return { steady, mc: async.mc, paths: async.paths, solve: async.solve, sweep: async.sweep, busy }
}

/** One-off comparison of several plans (success rate + sustainable spend). */
export function compareInWorker(plans: Plan[]): Promise<{ success: number; maxSteady: number }[]> {
  const w = getWorker()
  const id = nextId++
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'compare' && ev.data.id === id) {
        w.removeEventListener('message', onMsg)
        resolve(ev.data.results)
      }
    }
    w.addEventListener('message', onMsg)
    w.postMessage({ type: 'compare', id, plans } satisfies WorkerRequest)
  })
}
