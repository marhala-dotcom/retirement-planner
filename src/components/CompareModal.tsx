import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { runDeterministic } from '../engine/montecarlo'
import { compareInWorker } from '../hooks/useEngine'
import type { Scenario } from '../hooks/usePlans'
import { compact, money, pct } from '../lib/format'
import { Modal } from './Modal'

const SERIES = ['var(--s-pension)', 'var(--s-isa)', 'var(--s-gia)', 'var(--s-cash)']

export function CompareModal({ scenarios, activeId, onClose }: { scenarios: Scenario[]; activeId: string; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(() => {
    const others = scenarios.filter((s) => s.id !== activeId).map((s) => s.id)
    return [activeId, ...others].slice(0, 4)
  })
  const chosen = scenarios.filter((s) => picked.includes(s.id))
  const steady = useMemo(() => chosen.map((s) => runDeterministic(s.plan)), [chosen])
  const [mc, setMc] = useState<{ success: number; maxSteady: number }[] | null>(null)

  useEffect(() => {
    let live = true
    setMc(null)
    compareInWorker(chosen.map((s) => s.plan)).then((r) => live && setMc(r))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.join(',')])

  const ages = new Set<number>()
  steady.forEach((d) => d.rows!.forEach((r) => ages.add(r.ages[0])))
  const data = [...ages]
    .sort((a, b) => a - b)
    .map((age) => {
      const o: Record<string, number> = { age }
      steady.forEach((d, i) => {
        const r = d.rows!.find((x) => x.ages[0] === age)
        if (r) o[`s${i}`] = r.total / r.deflator
      })
      return o
    })

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : p.length < 4 ? [...p, id] : p))

  return (
    <Modal title="Compare scenarios" onClose={onClose} wide>
      {scenarios.length < 2 && (
        <p className="mb-4 rounded-xl bg-accent-wash p-3 text-[13px]">
          Tip: use the copy button next to the scenario name to save variations (e.g. "Retire at 57", "Spend £3,500") and compare them here.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map((s) => {
          const i = picked.indexOf(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${i >= 0 ? 'border-line-strong bg-surface-2 font-medium' : 'border-line text-ink-2'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: i >= 0 ? SERIES[i] : 'var(--surface-3)' }} />
              {s.name}
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="tnum w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Scenario</th>
              <th className="px-3 py-2 text-right font-medium">Retire</th>
              <th className="px-3 py-2 text-right font-medium">Target</th>
              <th className="px-3 py-2 text-right font-medium">Pot at retirement</th>
              <th className="px-3 py-2 text-right font-medium">Sustainable</th>
              <th className="px-3 py-2 text-right font-medium">Chance it lasts</th>
              <th className="px-3 py-2 text-right font-medium">Runs out (steady)</th>
            </tr>
          </thead>
          <tbody>
            {chosen.map((s, i) => {
              const d = steady[i]
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-0.5 w-4 rounded" style={{ background: SERIES[i] }} />
                      {s.name}
                    </span>
                  </td>
                  <td className="px-3 text-right">{s.plan.people[0].retireAge}</td>
                  <td className="px-3 text-right">{money(s.plan.spending.monthly)}/mo</td>
                  <td className="px-3 text-right">{compact(d.potAtRetirementReal)}</td>
                  <td className="px-3 text-right">{mc ? `${money(mc[i].maxSteady)}/mo` : '…'}</td>
                  <td className="px-3 text-right font-semibold">{mc ? pct(mc[i].success) : '…'}</td>
                  <td className="px-3 text-right">{d.depletedAtIndex < 0 ? 'Never' : `age ${d.rows![d.depletedAtIndex].ages[0]}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Savings over time (steady markets, today's money)</h3>
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="age" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-surface p-3 text-xs shadow-lg">
                    <div className="mb-1 font-medium">Age {label}</div>
                    {payload.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="flex items-center gap-1.5 text-ink-2">
                          <span className="h-0.5 w-3 rounded" style={{ background: SERIES[Number(String(p.dataKey).slice(1))] }} />
                          {chosen[Number(String(p.dataKey).slice(1))]?.name}
                        </span>
                        <span className="font-medium">{money(Number(p.value))}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            {chosen.map((_, i) => (
              <Line key={i} dataKey={`s${i}`} stroke={SERIES[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Modal>
  )
}
