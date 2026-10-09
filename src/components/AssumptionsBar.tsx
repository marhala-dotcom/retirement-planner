import { SlidersHorizontal } from 'lucide-react'
import type { Plan } from '../engine/types'
import { openSection } from '../lib/sections'

const pc = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`

/** The key assumptions behind every number on the page, always visible, one click to edit. */
export function AssumptionsBar({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
  const a = plan.assumptions
  const items: [string, string][] = [
    ['Inflation', pc(a.inflation)],
    ['Shares', `${pc(a.equityReturn)}/yr`],
    ['Bonds', `${pc(a.bondReturn)}/yr`],
    ['Cash', `${pc(a.cashRate)}/yr`],
    ['Fees', pc(a.fees, 2)],
    ['Mix', `${Math.round(a.equityPre * 100)}/${Math.round((1 - a.equityPre) * 100)} → ${Math.round(a.equityPost * 100)}/${Math.round((1 - a.equityPost) * 100)}`],
    ['Tax-free cash', plan.strategy.tfc === 'ufpls' ? '25% of each withdrawal' : '25% up front'],
  ]
  return (
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-[13px]">
      <span className="font-semibold">
        Assumptions
        <span className="ml-1.5 font-normal text-muted">
          ({a.preset === 'custom' ? 'custom' : a.preset})
        </span>
      </span>
      {items.map(([k, v]) => (
        <span key={k} className="whitespace-nowrap text-ink-2">
          {k} <strong className="tnum font-semibold text-ink">{v}</strong>
        </span>
      ))}
      <button
        onClick={() => {
          onEdit()
          openSection('assumptions')
        }}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        <SlidersHorizontal size={13} /> Edit assumptions
      </button>
    </div>
  )
}
