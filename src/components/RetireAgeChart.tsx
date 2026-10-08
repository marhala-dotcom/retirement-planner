import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SweepPoint } from '../engine/worker'
import { compact, money } from '../lib/format'
import { Segmented } from './fields'

/** "What if we retire earlier or later?" — both partners shift together. */
export function RetireAgeChart({
  sweep,
  current,
  onPick,
  couple,
  busy,
}: {
  sweep: SweepPoint[] | null
  current: number
  onPick: (age: number) => void
  couple: boolean
  busy: boolean
}) {
  const [metric, setMetric] = useState<'success' | 'spend'>('success')
  const data = (sweep ?? []).map((s) => ({ ...s, successPct: Math.round(s.success * 100) }))
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Retire earlier or later?</h2>
          <p className="text-[13px] text-ink-2">
            {metric === 'success'
              ? 'Chance your money lasts, by retirement age'
              : "Most you could spend each month (steady markets, today's money)"}
            {couple ? ' — both of you shifting together.' : '.'} Click a bar to try it.
          </p>
        </div>
        <div className="w-56">
          <Segmented
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'success', label: 'Chance it lasts' },
              { value: 'spend', label: 'Monthly income' },
            ]}
          />
        </div>
      </div>
      <div className={`mt-3 h-[220px] transition-opacity ${busy ? 'opacity-60' : ''}`}>
        {!sweep ? (
          <div className="flex h-full items-center justify-center text-[13px] text-muted">Running scenarios…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 4 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="retireAge" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                width={52}
                domain={metric === 'success' ? [0, 100] : [0, 'auto']}
                tickFormatter={(v) => (metric === 'success' ? `${v}%` : compact(v))}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                isAnimationActive={false}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl border border-line bg-surface p-3 text-xs shadow-lg">
                      <div className="mb-1 font-medium">Retire at {payload[0].payload.retireAge}</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-2">Chance money lasts</span>
                        <span className="tnum font-semibold">{payload[0].payload.successPct}%</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-ink-2">Sustainable spending</span>
                        <span className="tnum font-semibold">{money(payload[0].payload.maxSpend)}/mo</span>
                      </div>
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey={metric === 'success' ? 'successPct' : 'maxSpend'}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
                onClick={(d) => {
                  const age = (d as unknown as { payload?: { retireAge?: number } }).payload?.retireAge
                  if (age != null) onPick(age)
                }}
                style={{ cursor: 'pointer' }}
              >
                {data.map((d) => (
                  <Cell key={d.retireAge} fill={d.retireAge === current ? 'var(--accent)' : 'var(--band-inner)'} />
                ))}
                <LabelList
                  dataKey={metric === 'success' ? 'successPct' : 'maxSpend'}
                  position="top"
                  fontSize={10}
                  fill="var(--ink-2)"
                  formatter={(v: unknown) => (metric === 'success' ? `${v}%` : compact(Number(v)))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
