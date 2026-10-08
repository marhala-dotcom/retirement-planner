import { AlertOctagon, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import type { Insight, Tone } from '../lib/insights'

const TONE: Record<Tone, { Icon: typeof Lightbulb; color: string; label: string }> = {
  bad: { Icon: AlertOctagon, color: 'var(--critical)', label: 'Needs attention' },
  warn: { Icon: AlertTriangle, color: 'var(--warning)', label: 'Worth a look' },
  info: { Icon: Lightbulb, color: 'var(--accent)', label: 'Tip' },
  good: { Icon: CheckCircle2, color: 'var(--good)', label: 'Looking good' },
}

export function Insights({ items }: { items: Insight[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold">What this means for you</h2>
      <p className="text-[13px] text-ink-2">Observations from your numbers — not financial advice.</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.map((it) => {
          const t = TONE[it.tone]
          return (
            <li key={it.id} className="flex gap-3 rounded-xl border border-line p-3.5">
              <span className="mt-0.5 shrink-0" style={{ color: t.color }} aria-label={t.label}>
                <t.Icon size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] leading-snug font-semibold">{it.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{it.body}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
