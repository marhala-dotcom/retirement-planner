import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { YearRow } from '../engine/types'
import { INCOME_META, INCOME_ORDER } from '../lib/colors'
import { compact, money } from '../lib/format'

interface Props {
  rows: YearRow[]
  real: boolean
  scrubAge: number
  onScrub: (age: number) => void
  names: string[]
  couple: boolean
}

/** Where each year's spending comes from: stacked sources, tax below the line, target as a line. */
export function IncomeChart({ rows, real, scrubAge, onScrub, names, couple }: Props) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.phase === 'retired')
        .map((r) => {
          const k = real ? 1 / r.deflator : 1
          const o: Record<string, number | [number, number] | number[]> = {
            age: r.ages[0],
            ages: r.ages,
            year: r.year,
            target: r.target * k,
            spent: r.spent * k,
            tax: -r.income.tax * k,
            shortfall: r.shortfall * k,
            surplus: r.surplusSaved * k,
          }
          for (const key of INCOME_ORDER) o[key] = r.income[key] * k
          return o
        }),
    [rows, real],
  )
  const visible = INCOME_ORDER.filter((key) => data.some((d) => (d[key] as number) > 1))
  const hasShortfall = data.some((d) => (d.shortfall as number) > 1)

  if (!data.length) return null
  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold">Where your retirement income comes from</h2>
      <p className="text-[13px] text-ink-2">
        Money drawn each year by source (steady markets), with tax below the line. The line is your spending target
        {real ? " in today's money" : ''}.
      </p>
      <div className="mt-3 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {visible.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME_META[key].color }} />
            {INCOME_META[key].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--s-tax)' }} /> Tax
        </span>
        {hasShortfall && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--critical)' }} /> Shortfall
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: 'var(--ink)' }} /> Spending target
        </span>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            stackOffset="sign"
            margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
            barCategoryGap={1}
            onClick={(s) => s?.activeLabel != null && onScrub(Number(s.activeLabel))}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="age" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<IncomeTooltip names={names} couple={couple} />} cursor={{ fill: 'var(--surface-2)' }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            {visible.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="s"
                fill={INCOME_META[key].color}
                maxBarSize={24}
                stroke="var(--surface)"
                strokeWidth={0.75}
                radius={i === visible.length - 1 && !hasShortfall ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
            {hasShortfall && <Bar dataKey="shortfall" stackId="s" fill="var(--critical)" maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
            <Bar dataKey="tax" stackId="s" fill="var(--s-tax)" maxBarSize={24} radius={[0, 0, 3, 3]} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="target" stroke="var(--ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceLine x={scrubAge} stroke="var(--accent)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function IncomeTooltip({
  active,
  payload,
  names,
  couple,
}: {
  active?: boolean
  payload?: { payload: Record<string, number> }[]
  names: string[]
  couple: boolean
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Record<string, number> & { ages: [number, number] }
  return (
    <div className="min-w-52 rounded-xl border border-line bg-surface p-3 text-xs shadow-lg">
      <div className="mb-1.5 font-medium">
        {couple ? `${names[0]} ${d.ages[0]} · ${names[1]} ${d.ages[1]}` : `Age ${d.age}`}
      </div>
      {INCOME_ORDER.filter((k) => d[k] > 1).map((k) => (
        <div key={k} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="h-0.5 w-3 rounded" style={{ background: INCOME_META[k].color }} />
            {INCOME_META[k].label}
          </span>
          <span className="tnum font-medium">{money(d[k])}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 py-0.5">
        <span className="text-ink-2">Tax</span>
        <span className="tnum font-medium">{money(d.tax)}</span>
      </div>
      {d.surplus > 1 && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-ink-2">Reinvested</span>
          <span className="tnum font-medium">{money(-d.surplus)}</span>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
        <span className="font-medium">Spent</span>
        <span className="tnum font-semibold">{money(d.spent)}</span>
      </div>
      {d.shortfall > 1 && (
        <div className="flex items-center justify-between gap-4 py-0.5 text-bad">
          <span>Short of target by</span>
          <span className="tnum font-semibold">{money(d.shortfall)}</span>
        </div>
      )}
    </div>
  )
}
