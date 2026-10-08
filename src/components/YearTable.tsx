import { ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'
import type { YearRow } from '../engine/types'
import { money } from '../lib/format'

const COLS: { key: string; label: string; get: (r: YearRow) => number }[] = [
  { key: 'total', label: 'Savings (start)', get: (r) => r.total },
  { key: 'pension', label: 'Pension', get: (r) => r.balances.pension },
  { key: 'isa', label: 'ISA', get: (r) => r.balances.isa },
  { key: 'gia', label: 'GIA', get: (r) => r.balances.gia },
  { key: 'cash', label: 'Cash', get: (r) => r.balances.cash },
  { key: 'lisa', label: 'LISA', get: (r) => r.balances.lisa },
  { key: 'contrib', label: 'Paid in', get: (r) => r.contributions },
  { key: 'sp', label: 'State Pension', get: (r) => r.income.statePension },
  { key: 'other', label: 'DB & work', get: (r) => r.income.other },
  { key: 'wPension', label: 'From pension', get: (r) => r.income.pension },
  { key: 'wIsa', label: 'From ISA/LISA', get: (r) => r.income.isa + r.income.lisa },
  { key: 'wGia', label: 'From GIA', get: (r) => r.income.gia },
  { key: 'wCash', label: 'From cash', get: (r) => r.income.cash },
  { key: 'tax', label: 'Tax', get: (r) => r.income.tax },
  { key: 'mortgage', label: 'Mortgage from savings', get: (r) => r.mortgage },
  { key: 'spent', label: 'Spent', get: (r) => r.spent },
  { key: 'short', label: 'Shortfall', get: (r) => r.shortfall },
]

export function YearTable({ rows, real, couple, names }: { rows: YearRow[]; real: boolean; couple: boolean; names: string[] }) {
  const [open, setOpen] = useState(false)
  const hasLisa = rows.some((r) => r.balances.lisa > 0.5 || r.income.lisa > 0.5)
  const cols = COLS.filter((c) => rows.some((r) => Math.abs(c.get(r)) > 0.5) || c.key === 'total').map((c) =>
    c.key === 'wIsa' && !hasLisa ? { ...c, label: 'From ISA' } : c,
  )
  const val = (r: YearRow, x: number) => (real ? x / r.deflator : x)

  const exportCsv = () => {
    const head = ['Tax year', couple ? `${names[0]} age` : 'Age', ...(couple ? [`${names[1]} age`] : []), 'Phase', ...cols.map((c) => c.label)]
    const lines = rows.map((r) =>
      [
        `${r.year}/${String((r.year + 1) % 100).padStart(2, '0')}`,
        r.ages[0],
        ...(couple ? [r.ages[1]] : []),
        r.phase,
        ...cols.map((c) => Math.round(val(r, c.get(r)))),
      ].join(','),
    )
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `retirement-plan-${real ? 'todays-money' : 'future-money'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 p-5">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDown size={18} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          <span>
            <span className="block text-base font-semibold">Year-by-year details</span>
            <span className="block text-[13px] text-ink-2">
              Every number behind the charts, steady markets, {real ? "today's money" : 'future pounds'}
            </span>
          </span>
        </button>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] hover:bg-surface-2"
        >
          <Download size={14} /> CSV
        </button>
      </div>
      {open && (
        <div className="max-h-[520px] overflow-auto border-t border-line">
          <table className="tnum w-full text-right text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-surface-2 text-muted">
              <tr>
                <th className="sticky left-0 bg-surface-2 px-3 py-2 text-left font-medium">Age{couple ? 's' : ''}</th>
                <th className="px-3 py-2 text-left font-medium">Year</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className={`border-t border-line ${r.phase === 'saving' ? 'text-ink-2' : ''} ${r.shortfall > 1 ? 'bg-[color-mix(in_srgb,var(--critical)_8%,transparent)]' : ''}`}>
                  <td className="sticky left-0 bg-surface px-3 py-1.5 text-left font-medium">
                    {r.ages[0]}
                    {couple ? ` / ${r.ages[1]}` : ''}
                  </td>
                  <td className="px-3 py-1.5 text-left text-muted">{r.year}</td>
                  {cols.map((c) => {
                    const v = val(r, c.get(r))
                    return (
                      <td key={c.key} className={`px-3 py-1.5 ${c.key === 'short' && v > 1 ? 'font-medium text-bad' : ''}`}>
                        {Math.abs(v) < 0.5 ? '–' : money(c.key === 'tax' ? -v : v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
