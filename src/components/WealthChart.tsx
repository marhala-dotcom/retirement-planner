import { useMemo } from 'react'
import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MCResult } from '../engine/montecarlo'
import { WRAPPERS, type YearRow } from '../engine/types'
import { WRAPPER_META } from '../lib/colors'
import { compact, money } from '../lib/format'
import type { Milestone } from '../lib/milestones'
import { Segmented } from './fields'

export type MarketView = 'typical' | 'poor' | 'strong' | 'crash'
export type ChartMode = 'breakdown' | 'range'

interface Props {
  rows: YearRow[]
  mc: MCResult | null
  real: boolean
  mode: ChartMode
  setMode: (m: ChartMode) => void
  market: MarketView
  setMarket: (m: MarketView) => void
  scrubAge: number
  onScrub: (age: number) => void
  marks: Milestone[]
  planToAge: number
  names: string[]
  couple: boolean
  busy: boolean
}

const MARKET_DESC: Record<MarketView, string> = {
  typical: ', with steady growth',
  poor: ', in a poor-markets path (1 in 10)',
  strong: ', in a strong-markets path (1 in 10)',
  crash: ', if shares fall 35% the year you retire',
}

/** One reference line per age; labels at the same age are joined. */
function groupMarks(marks: Milestone[]): Milestone[] {
  const out: Milestone[] = []
  for (const m of marks) {
    const same = out.find((x) => x.x === m.x)
    if (same) same.label = `${same.label} · ${m.label}`
    else out.push({ ...m })
  }
  return out
}

const MARK_COLOR: Record<Milestone['kind'], string> = {
  retire: 'var(--ink-2)',
  access: 'var(--s-pension)',
  state: 'var(--s-sp)',
  lisa: 'var(--s-lisa)',
  mortgage: 'var(--ink-2)',
}

export function WealthChart(p: Props) {
  const data = useMemo(
    () =>
      p.rows.map((r, t) => {
        const k = p.real ? 1 / r.deflator : 1
        const d = p.real ? 1 : r.deflator
        const pc = p.mc?.percentiles
        return {
          age: r.ages[0],
          ages: r.ages,
          year: r.year,
          pension: r.balances.pension * k,
          isa: r.balances.isa * k,
          gia: r.balances.gia * k,
          cash: r.balances.cash * k,
          lisa: r.balances.lisa * k,
          total: r.total * k,
          band90: pc ? [pc.p10[t] * d, pc.p90[t] * d] : undefined,
          band50: pc ? [pc.p25[t] * d, pc.p75[t] * d] : undefined,
          p10: pc ? pc.p10[t] * d : undefined,
          p50: pc ? pc.p50[t] * d : undefined,
          p90: pc ? pc.p90[t] * d : undefined,
        }
      }),
    [p.rows, p.mc, p.real],
  )

  const handleClick = (s: { activeLabel?: string | number } | null) => {
    if (s && s.activeLabel != null) p.onScrub(Number(s.activeLabel))
  }

  const first = data[0]?.age ?? 0
  const last = data[data.length - 1]?.age ?? 0
  const ticks: number[] = [first]
  for (let a = Math.ceil((first + 1) / 5) * 5; a < last - 1; a += 5) ticks.push(a)
  ticks.push(last)

  const visibleWrappers = WRAPPERS.filter((w) => data.some((d) => d[w] > 1))

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Your money over time</h2>
          <p className="text-[13px] text-ink-2">
            {p.mode === 'breakdown'
              ? `Total savings at each age by pot, ${p.real ? "in today's money" : 'in future pounds'}${
                  MARKET_DESC[p.market]
                }.`
              : `Range of outcomes across ${p.mc?.runs.toLocaleString() ?? '…'} simulated market histories.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-52">
            <Segmented
              size="sm"
              value={p.mode}
              onChange={p.setMode}
              options={[
                { value: 'breakdown', label: 'By pot' },
                { value: 'range', label: 'Range of outcomes' },
              ]}
            />
          </div>
          {p.mode === 'breakdown' && (
            <div className="w-72">
              <Segmented
                size="sm"
                value={p.market}
                onChange={p.setMarket}
                options={[
                  { value: 'poor', label: 'Poor', title: 'A simulated path where markets were in the worst 10%' },
                  { value: 'typical', label: 'Steady', title: 'Every year earns the long-run median return' },
                  { value: 'strong', label: 'Strong', title: 'A simulated path where markets were in the best 10%' },
                  { value: 'crash', label: 'Crash', title: 'Shares fall 35% in your first year of retirement, then steady growth' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Legend: always present for multiple series */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {p.mode === 'breakdown' ? (
          visibleWrappers.map((w) => (
            <span key={w} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WRAPPER_META[w].color }} />
              {WRAPPER_META[w].short}
            </span>
          ))
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: 'var(--s-pension)' }} /> Middle outcome
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: 'var(--band-inner)' }} /> Half of outcomes land here
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: 'var(--band-outer)' }} /> 8 in 10 land here
            </span>
          </>
        )}
      </div>

      <div className={`h-[352px] transition-opacity ${p.busy && p.mode === 'range' ? 'opacity-60' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 34, right: 12, bottom: 0, left: 4 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="age"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--muted)' }}
              axisLine={{ stroke: 'var(--axis)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fontSize: 12, fill: 'var(--muted)' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={<WealthTooltip mode={p.mode} names={p.names} couple={p.couple} />}
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {p.mode === 'breakdown'
              ? visibleWrappers.map((w) => (
                  <Area
                    key={w}
                    type="monotone"
                    dataKey={w}
                    stackId="1"
                    stroke="var(--surface)"
                    strokeWidth={1.5}
                    fill={WRAPPER_META[w].color}
                    fillOpacity={0.88}
                    isAnimationActive={false}
                  />
                ))
              : [
                  <Area key="b90" type="monotone" dataKey="band90" stroke="none" fill="var(--band-outer)" fillOpacity={1} isAnimationActive={false} />,
                  <Area key="b50" type="monotone" dataKey="band50" stroke="none" fill="var(--band-inner)" fillOpacity={1} isAnimationActive={false} />,
                  <Line key="p50" type="monotone" dataKey="p50" stroke="var(--s-pension)" strokeWidth={2} dot={false} isAnimationActive={false} />,
                ]}
            {groupMarks(p.marks).map((m, i) => (
              <ReferenceLine
                key={m.kind + m.x + i}
                x={m.x}
                stroke={MARK_COLOR[m.kind]}
                strokeOpacity={0.55}
                strokeDasharray="3 3"
                label={{
                  value: m.label,
                  position: 'insideTopLeft',
                  fontSize: 10,
                  fill: 'var(--ink-2)',
                  offset: 4,
                  dy: -30 + (i % 3) * 11, // three label rows so neighbours don't collide
                }}
              />
            ))}
            <ReferenceLine x={p.scrubAge} stroke="var(--accent)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">Tap or click the chart to move the age slider below.</p>
    </div>
  )
}

interface TTProps {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
  mode: ChartMode
  names: string[]
  couple: boolean
}

function WealthTooltip({ active, payload, mode, names, couple }: TTProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as {
    age: number
    ages: [number, number]
    year: number
    total: number
    p10?: number
    p50?: number
    p90?: number
  } & Record<string, number>
  return (
    <div className="min-w-48 rounded-xl border border-line bg-surface p-3 text-xs shadow-lg">
      <div className="mb-1.5 font-medium text-ink">
        {couple ? `${names[0]} ${d.ages[0]} · ${names[1]} ${d.ages[1]}` : `Age ${d.age}`}
        <span className="ml-1.5 font-normal text-muted">
          {d.year}/{String((d.year + 1) % 100).padStart(2, '0')}
        </span>
      </div>
      {mode === 'breakdown' ? (
        <>
          <div className="mb-1 text-base font-semibold text-ink">{money(d.total)}</div>
          {WRAPPERS.filter((w) => d[w] > 1).map((w) => (
            <div key={w} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 text-ink-2">
                <span className="h-0.5 w-3 rounded" style={{ background: WRAPPER_META[w].color }} />
                {WRAPPER_META[w].short}
              </span>
              <span className="tnum font-medium text-ink">{money(d[w])}</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <Row label="Strong markets (top 10%)" v={d.p90} />
          <Row label="Middle outcome" v={d.p50} strong />
          <Row label="Poor markets (bottom 10%)" v={d.p10} />
        </>
      )}
    </div>
  )
}

function Row({ label, v, strong }: { label: string; v?: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-ink-2">{label}</span>
      <span className={`tnum text-ink ${strong ? 'font-semibold' : 'font-medium'}`}>{v == null ? '…' : money(v)}</span>
    </div>
  )
}
