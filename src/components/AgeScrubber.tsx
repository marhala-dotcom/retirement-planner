import { AlertTriangle, CheckCircle2, Lock, Pause, Play, Unlock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WRAPPERS, type YearRow } from '../engine/types'
import { INCOME_META, INCOME_ORDER, WRAPPER_META } from '../lib/colors'
import { compact, money } from '../lib/format'
import type { Milestone } from '../lib/milestones'
import type { MarketView } from './WealthChart'

interface Props {
  rows: YearRow[]
  age: number
  setAge: (a: number) => void
  real: boolean
  marks: Milestone[]
  names: string[]
  couple: boolean
  market: MarketView
  spa: [number, number]
  accessAge: [number, number]
}

/** The "sliding gauge": drag through the years and see what's left and where income comes from. */
export function AgeScrubber({ rows, age, setAge, real, marks, names, couple, market, spa, accessAge }: Props) {
  const minAge = rows[0].ages[0]
  const maxAge = rows[rows.length - 1].ages[0]
  const row = rows.find((r) => r.ages[0] === age) ?? rows[0]
  const k = real ? 1 / row.deflator : 1
  const v = (x: number) => x * k
  const peakRow = rows.reduce((a, b) => (b.total / b.deflator > a.total / a.deflator ? b : a), rows[0])
  const peakReal = peakRow.total / peakRow.deflator
  const totalReal = row.total / row.deflator
  const share = peakReal > 0 ? Math.min(1, totalReal / peakReal) : 0
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)

  const isPlaying = playing && age < maxAge
  useEffect(() => {
    if (!isPlaying) return
    timer.current = window.setInterval(() => {
      setAge(-1) // sentinel handled by parent: advance one year
    }, 160)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [isPlaying, setAge])

  const pctPos = ((age - minAge) / Math.max(1, maxAge - minAge)) * 100
  const ticks = sliderTicks(marks, minAge, maxAge)
  const inc = row.income
  const incomeItems = INCOME_ORDER.map((key) => ({ key, value: inc[key] })).filter((x) => x.value > 1)
  const grossIn = incomeItems.reduce((s, x) => s + x.value, 0)
  const retired = row.phase === 'retired'

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">How much is left at age {age}?</h2>
          <p className="text-[13px] text-ink-2">
            {couple ? `${names[0]} ${row.ages[0]} · ${names[1]} ${row.ages[1]} · ` : ''}tax year {row.year}/
            {String((row.year + 1) % 100).padStart(2, '0')} ·{' '}
            {{ typical: 'steady markets', poor: 'poor markets (1 in 10)', strong: 'strong markets (1 in 10)', crash: 'crash at retirement' }[market]}
          </p>
        </div>
        <button
          onClick={() => {
            if (!isPlaying && age >= maxAge) setAge(minAge)
            setPlaying(!isPlaying)
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pause' : 'Play the years'}
        </button>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: gauge + pots */}
        <div>
          <div className="flex items-center gap-5">
            <Gauge share={share} empty={row.total < 1 && retired} />
            <div className="min-w-0">
              <div className="text-[40px] leading-none font-semibold tracking-tight">{money(v(row.total))}</div>
              <div className="mt-1 text-[13px] text-ink-2">{real ? "in today's money" : `in ${row.year} pounds`}</div>
              <div className="mt-2 text-xs text-muted">
                {row.total < 1 && retired ? (
                  <span className="inline-flex items-center gap-1 font-medium text-bad">
                    <AlertTriangle size={13} /> Savings have run out
                  </span>
                ) : (
                  <>
                    {Math.round(share * 100)}% of your peak ({compact(real ? peakReal : peakRow.total)} at {peakRow.ages[0]})
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {WRAPPERS.filter((w) => rows.some((r) => r.balances[w] > 1)).map((w) => {
              const val = v(row.balances[w])
              const max = Math.max(...rows.map((r) => (real ? r.balances[w] / r.deflator : r.balances[w])))
              return (
                <div key={w} className="grid grid-cols-[64px_1fr_72px] items-center gap-2 text-[13px]">
                  <span className="text-ink-2">{WRAPPER_META[w].short}</span>
                  <div className="h-2.5 rounded-full bg-surface-2">
                    <div
                      className="h-2.5 rounded-full transition-[width] duration-150"
                      style={{ width: `${max > 0 ? (val / max) * 100 : 0}%`, background: WRAPPER_META[w].color }}
                    />
                  </div>
                  <span className="tnum text-right font-medium">{compact(val)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: this year's money */}
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">{retired ? 'Income this year' : 'Still saving'}</span>
            {retired && <span className="text-xs text-muted">per year · per month</span>}
          </div>
          {retired ? (
            <>
              {incomeItems.length === 0 && <p className="text-[13px] text-muted">No income this year.</p>}
              {incomeItems.map((x) => (
                <div key={x.key} className="flex items-center justify-between gap-2 py-1 text-[13px]">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME_META[x.key].color }} />
                    {INCOME_META[x.key].label}
                    {grossIn > 0 && <span className="text-xs text-muted">{Math.round((x.value / grossIn) * 100)}%</span>}
                  </span>
                  <span className="tnum">
                    {money(v(x.value))} <span className="text-muted">· {money(v(x.value) / 12)}</span>
                  </span>
                </div>
              ))}
              {inc.tax >= 1 && (
                <div className="flex items-center justify-between gap-2 py-1 text-[13px]">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--s-tax)' }} />
                    Tax
                  </span>
                  <span className="tnum">
                    −{money(v(inc.tax))} <span className="text-muted">· {money(v(inc.tax) / 12)}</span>
                  </span>
                </div>
              )}
              {row.surplusSaved > 1 && (
                <div className="flex items-center justify-between gap-2 py-1 text-[13px] text-ink-2">
                  <span>Reinvested (not needed)</span>
                  <span className="tnum">−{money(v(row.surplusSaved))}</span>
                </div>
              )}
              <div className="mt-2 border-t border-line pt-2">
                <div className="flex items-center justify-between text-[13px] font-semibold">
                  <span>Spending</span>
                  <span className="tnum">
                    {money(v(row.spent))} <span className="font-normal text-muted">· {money(v(row.spent) / 12)}/mo</span>
                  </span>
                </div>
                {row.shortfall > 1 && (
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-bad">
                    <AlertTriangle size={14} /> Short by {money(v(row.shortfall))} ({money(v(row.shortfall) / 12)}/mo)
                  </div>
                )}
                {row.spendingFactor < 0.999 && (
                  <div className="mt-1 text-xs text-warn">Guardrails: spending trimmed to {Math.round(row.spendingFactor * 100)}% of target</div>
                )}
                {row.spendingFactor > 1.001 && (
                  <div className="mt-1 text-xs text-good">Guardrails: spending raised to {Math.round(row.spendingFactor * 100)}% of target</div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1 text-[13px] text-ink-2">
              <p>
                {row.contributions > 0 ? (
                  <>
                    Paying in <span className="tnum font-medium text-ink">{money(v(row.contributions))}</span> this year (
                    {money(v(row.contributions) / 12)}/mo).
                  </>
                ) : (
                  'No new saving in this plan — your pots just stay invested. Add monthly saving under Savings & investments.'
                )}
              </p>
              <p>Retirement spending starts at {rows.find((r) => r.phase === 'retired')?.ages[0] ?? '—'}. Drag the slider to a later age.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(couple ? [0, 1] : [0]).map((p) => {
              const a = row.ages[p]
              const unlocked = a >= accessAge[p]
              const sp = a >= Math.ceil(spa[p])
              const nm = couple ? `${names[p]}: ` : ''
              return (
                <span key={p} className="contents">
                  <Chip ok={unlocked} icon={unlocked ? <Unlock size={12} /> : <Lock size={12} />}>
                    {nm}pension {unlocked ? 'unlocked' : `locked until ${accessAge[p]}`}
                  </Chip>
                  <Chip ok={sp} icon={sp ? <CheckCircle2 size={12} /> : null}>
                    {nm}State Pension {sp ? 'paid' : `from ${Math.ceil(spa[p])}`}
                  </Chip>
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* The slider itself */}
      <div className="mt-6">
        <input
          type="range"
          className="slider big"
          min={minAge}
          max={maxAge}
          step={1}
          value={age}
          aria-label="Age"
          aria-valuetext={`Age ${age}, ${money(v(row.total))} left`}
          style={{ ['--pct' as string]: `${pctPos}%` }}
          onChange={(e) => {
            setPlaying(false)
            setAge(Number(e.target.value))
          }}
        />
        <div className="relative mt-1 h-12 text-[10px] text-muted">
          {ticks.map(({ x, label, showNum, showLabel, row }) => {
            const left = ((x - minAge) / Math.max(1, maxAge - minAge)) * 100
            return (
              <button
                key={x}
                onClick={() => setAge(x)}
                className="absolute flex -translate-x-1/2 flex-col items-center hover:text-ink"
                style={{ left: `calc(${left}% + ${14 - left * 0.28}px)` }}
                title={label ? `${label} (${x})` : `Age ${x}`}
              >
                <span className="h-1.5 w-px bg-current" />
                {showNum && <span className="font-medium text-ink-2">{x}</span>}
                {!showNum && <span className="invisible">0</span>}
                {showLabel && label && (
                  <span className={`hidden whitespace-nowrap sm:block ${row === 1 ? 'mt-3' : ''}`}>{label}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Chip({ ok, icon, children }: { ok: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        ok ? 'border-line bg-surface text-ink' : 'border-transparent bg-surface-3 text-ink-2'
      }`}
    >
      {icon}
      {children}
    </span>
  )
}

/** Semicircle meter: how much of the peak pot remains. Track is a lighter step of the fill hue. */
function Gauge({ share, empty }: { share: number; empty: boolean }) {
  const r = 52
  const len = Math.PI * r
  return (
    <svg width="128" height="74" viewBox="0 0 128 74" role="img" aria-label={`${Math.round(share * 100)}% of peak remaining`}>
      <path d="M 12 66 A 52 52 0 0 1 116 66" fill="none" stroke="var(--accent-wash)" strokeWidth="12" strokeLinecap="round" />
      <path
        d="M 12 66 A 52 52 0 0 1 116 66"
        fill="none"
        stroke={empty ? 'var(--critical)' : 'var(--accent)'}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.001, share * len)} ${len}`}
        style={{ transition: 'stroke-dasharray 150ms' }}
      />
      <text x="64" y="62" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--ink)">
        {Math.round(share * 100)}%
      </text>
    </svg>
  )
}

/** Slider ticks: milestones plus the ends; thin out labels that would collide (two label rows). */
function sliderTicks(marks: Milestone[], minAge: number, maxAge: number) {
  const pts = new Map<number, string>()
  pts.set(minAge, '')
  for (const m of marks) if (m.x >= minAge && m.x <= maxAge && !pts.get(m.x)) pts.set(m.x, m.label.replace(/ \(.*\)/, ''))
  if (!pts.has(maxAge)) pts.set(maxAge, '')
  const span = Math.max(1, maxAge - minAge)
  let lastNum = -1e9
  const lastLabel = [-1e9, -1e9]
  const out: { x: number; label: string; showNum: boolean; showLabel: boolean; row: number }[] = []
  for (const [x, label] of [...pts.entries()].sort((a, b) => a[0] - b[0])) {
    const pos = ((x - minAge) / span) * 100
    const showNum = pos - lastNum >= 2.8
    if (showNum) lastNum = pos
    let row = -1
    if (label) row = pos - lastLabel[0] >= 13 ? 0 : pos - lastLabel[1] >= 13 ? 1 : -1
    if (row >= 0) lastLabel[row] = pos
    out.push({ x, label, showNum, showLabel: row >= 0, row })
  }
  return out
}
