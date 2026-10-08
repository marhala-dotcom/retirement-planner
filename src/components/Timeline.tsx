import type { Prepared } from '../engine/prepare'

/** Dual-age life timeline: each person's phases, coloured by what funds them. */
export function Timeline({ P, onPick }: { P: Prepared; onPick: (age: number) => void }) {
  const plan = P.plan
  const start = 2026
  const end = start + P.T
  const span = end - start
  const x = (year: number) => ((Math.min(end, Math.max(start, year)) - start) / span) * 100
  const lanes = (P.n === 2 ? [0, 1] : [0]).map((p) => {
    const person = plan.people[p]
    const born = start - person.age
    const retire = born + person.retireAge
    const access = born + Math.max(person.retireAge, P.accessAge[p])
    const sp = born + Math.ceil(Math.max(person.retireAge, P.spa[p]))
    const segs = [
      { from: start, to: retire, label: 'Working & saving', color: 'var(--surface-3)', ink: 'var(--ink-2)' },
      { from: retire, to: access, label: 'Bridge: ISA & cash', color: 'var(--s-isa)', ink: '#0b0b0b' },
      { from: access, to: sp, label: 'Pension drawdown', color: 'var(--s-pension)', ink: '#fff' },
      { from: sp, to: end, label: '+ State Pension', color: 'var(--s-sp)', ink: '#fff' },
    ].filter((s) => s.to > s.from)
    return { p, name: person.name || (p ? 'Partner' : 'You'), born, segs }
  })
  const decades: number[] = []
  for (let y = Math.ceil(start / 5) * 5; y < end; y += 5) decades.push(y)

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Your retirement timeline</h2>
        <span className="text-xs text-muted">What pays the bills at each stage · click to jump the age slider</span>
      </div>
      <div className="space-y-3">
        {lanes.map((l) => (
          <div key={l.p} className="grid grid-cols-[72px_1fr] items-center gap-3">
            <div className="truncate text-[13px] font-medium">{l.name}</div>
            <div className="relative h-9">
              {l.segs.map((s, i) => {
                const w = x(s.to) - x(s.from)
                return (
                  <button
                    key={i}
                    onClick={() => onPick(s.from - (start - plan.people[0].age))}
                    className="absolute top-0 flex h-9 items-center overflow-hidden rounded-md px-2 text-left text-[11px] font-medium whitespace-nowrap"
                    style={{
                      left: `calc(${x(s.from)}% + 1px)`,
                      width: `calc(${w}% - 2px)`,
                      background: s.color,
                      color: s.ink,
                    }}
                    title={`${s.label}: age ${s.from - l.born} to ${s.to - l.born} (${s.from}–${s.to})`}
                  >
                    {w > 9 && (
                      <span>
                        {s.label} <span className="opacity-80">· {s.from - l.born}</span>
                      </span>
                    )}
                    {w > 4 && w <= 9 && <span>{s.from - l.born}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <div />
          <div className="relative h-4 text-[10px] text-muted">
            {decades.map((y) => (
              <span key={y} className="tnum absolute -translate-x-1/2" style={{ left: `${x(y)}%` }}>
                {y}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
