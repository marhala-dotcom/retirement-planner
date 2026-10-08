import { AlertOctagon, AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import type { MCResult } from '../engine/montecarlo'
import type { Prepared } from '../engine/prepare'
import { compact, money, pct } from '../lib/format'

interface Props {
  P: Prepared
  potAtRet: number
  depletedAge: number | null
  mc: MCResult | null
  solve: { maxSteady: number; max90: number; max75: number } | null
  busy: boolean
}

function status(p: number) {
  if (p >= 0.85) return { label: 'On track', color: 'var(--good)', text: 'text-good', Icon: CheckCircle2 }
  if (p >= 0.7) return { label: 'Borderline', color: 'var(--warning)', text: 'text-warn', Icon: CircleAlert }
  if (p >= 0.5) return { label: 'At risk', color: 'var(--serious)', text: 'text-warn', Icon: AlertTriangle }
  return { label: 'Unlikely', color: 'var(--critical)', text: 'text-bad', Icon: AlertOctagon }
}

export function KpiStrip({ P, potAtRet, depletedAge, mc, solve, busy }: Props) {
  const plan = P.plan
  const target = plan.spending.monthly
  const retireAge = plan.people[0].retireAge
  const names = plan.people.map((p, i) => p.name || (i ? 'Partner' : 'You'))
  const s = mc ? status(mc.successRate) : null
  const d = P.drawStart
  const retireYear = 2026 + d
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${busy ? '[&_.async]:opacity-60' : ''}`}>
      {/* Hero: chance of success */}
      <div className="card flex items-center gap-4 p-5">
        <SuccessRing value={mc?.successRate ?? null} color={s?.color ?? 'var(--surface-3)'} />
        <div className="async min-w-0 transition-opacity">
          <div className="text-[13px] text-ink-2">Chance money lasts to {plan.planToAge}</div>
          {s && mc ? (
            <>
              <div className={`mt-1 inline-flex items-center gap-1 text-sm font-semibold ${s.text}`}>
                <s.Icon size={15} /> {s.label}
              </div>
              <div className="mt-1 text-xs text-muted">
                {plan.strategy.type === 'guardrails'
                  ? `With flexible spending; ${pct(mc.bigCutRate)} need a cut over 10%`
                  : `${mc.runs.toLocaleString()} simulated markets`}
              </div>
            </>
          ) : (
            <div className="mt-1 text-xs text-muted">Simulating…</div>
          )}
        </div>
      </div>

      <Tile
        label={`Pot when ${plan.couple ? 'you retire' : 'you retire'} (${retireAge})`}
        value={compact(potAtRet)}
        sub={
          mc ? (
            <>
              Likely range {compact(mc.percentiles.p10[d] ?? 0)}–{compact(mc.percentiles.p90[d] ?? 0)} · ≈{' '}
              {compact(potAtRet * P.deflator[Math.min(d, P.T - 1)])} in {retireYear} pounds
            </>
          ) : (
            "In today's money, steady growth"
          )
        }
      />

      <Tile
        label="Sustainable monthly income"
        value={solve ? money(solve.maxSteady) : '…'}
        valueSuffix="/mo"
        async
        sub={
          solve ? (
            <>
              <span className={solve.max90 >= target ? 'text-good' : solve.maxSteady >= target ? 'text-warn' : 'text-bad'}>
                {money(solve.max90)}/mo with 90% confidence
              </span>{' '}
              · your target {money(target)}
            </>
          ) : (
            'Solving…'
          )
        }
      />

      <Tile
        label="Money lasts until"
        value={depletedAge == null ? `${plan.planToAge}+` : `age ${depletedAge}`}
        valueClass={depletedAge == null ? '' : 'text-bad'}
        sub={
          mc ? (
            <>
              Poor markets (1 in 10): {mc.depletionAgeP10 == null ? `${plan.planToAge}+` : `age ${mc.depletionAgeP10}`} · typical left at{' '}
              {plan.planToAge}: {compact(mc.medianFinalReal)}
            </>
          ) : (
            `Steady markets${plan.couple ? `, ${names[0]}'s age` : ''}`
          )
        }
      />
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  valueSuffix,
  valueClass = '',
  async,
}: {
  label: string
  value: string
  sub: React.ReactNode
  valueSuffix?: string
  valueClass?: string
  async?: boolean
}) {
  return (
    <div className="card p-5">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={`mt-1 text-[28px] leading-tight font-semibold tracking-tight ${valueClass} ${async ? 'async transition-opacity' : ''}`}>
        {value}
        {valueSuffix && <span className="text-base font-medium text-muted">{valueSuffix}</span>}
      </div>
      <div className="async mt-1 text-xs text-muted transition-opacity">{sub}</div>
    </div>
  )
}

function SuccessRing({ value, color }: { value: number | null; color: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0" role="img" aria-label={value == null ? 'Calculating' : `${Math.round(value * 100)}%`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      {value != null && (
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, value * c)} ${c}`}
          transform="rotate(-90 42 42)"
          style={{ transition: 'stroke-dasharray 300ms' }}
        />
      )}
      <text x="42" y="47" textAnchor="middle" fontSize="19" fontWeight="650" fill="var(--ink)">
        {value == null ? '…' : `${Math.round(value * 100)}%`}
      </text>
    </svg>
  )
}
