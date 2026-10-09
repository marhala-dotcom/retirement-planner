import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { YearRow } from '../engine/types'
import { INCOME_META } from '../lib/colors'
import { money } from '../lib/format'
import { openSection } from '../lib/sections'
import { Segmented } from './fields'

type Per = 'month' | 'year'

/** One retirement year's money, monthly by default: what comes in from each pot, the
 *  tax-free and taxable parts of pension withdrawals, each person's tax, and the take-home. */
export function YearMoney({
  row,
  real,
  names,
  couple,
  target,
  onEdit,
}: {
  row: YearRow
  real: boolean
  names: string[]
  couple: boolean
  target: number // monthly target, today's money
  onEdit: () => void
}) {
  const [per, setPer] = useState<Per>('month')
  const [showTax, setShowTax] = useState(false)
  const k = (real ? 1 / row.deflator : 1) / (per === 'month' ? 12 : 1)
  const v = (x: number) => x * k
  const inc = row.income
  const people = couple ? [0, 1] : [0]
  const taxFree = row.detail[0].pensionTaxFree + row.detail[1].pensionTaxFree
  const lump = row.detail[0].lumpSum + row.detail[1].lumpSum
  const suffix = per === 'month' ? '/mo' : '/yr'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">This year's money</span>
        <div className="w-44 shrink-0">
          <Segmented
            size="sm"
            value={per}
            onChange={setPer}
            options={[
              { value: 'month', label: 'Per month' },
              { value: 'year', label: 'Per year' },
            ]}
          />
        </div>
      </div>

      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">Coming in</div>
      <Line label="State Pension" amount={v(inc.statePension)} color={INCOME_META.statePension.color} />
      <Line label="DB pension & work" amount={v(inc.other)} color={INCOME_META.other.color} />
      <Line label="From pensions" amount={v(inc.pension)} color={INCOME_META.pension.color} />
      <Line label="25% tax-free" amount={v(taxFree)} sub />
      <Line label="taxable" amount={v(inc.pension - taxFree)} sub />
      <Line label="From ISAs" amount={v(inc.isa + inc.lisa)} color={INCOME_META.isa.color} />
      <Line label="From GIA" amount={v(inc.gia)} color={INCOME_META.gia.color} />
      <Line label="From cash" amount={v(inc.cash)} color={INCOME_META.cash.color} />

      {(inc.tax > 0.5 || row.surplusSaved > 0.5) && (
        <div className="mt-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">Going out</div>
      )}
      <Line label="Income tax" amount={v(inc.tax)} color="var(--s-tax)" minus />
      {couple && inc.tax > 0.5 && (
        <div className="pl-[18px] text-xs text-ink-2">
          {people.map((p, i) => (
            <span key={p}>
              {i > 0 && ' · '}
              {names[p]} {money(v(row.taxByPerson[p]))}
            </span>
          ))}
        </div>
      )}
      <Line label="Not needed, reinvested in ISAs" amount={v(row.surplusSaved)} minus />

      <div className="mt-2 border-t border-line pt-2">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span>Take-home</span>
          <span className="tnum">
            {money(v(row.spent))}
            <span className="font-normal text-muted">{suffix}</span>
          </span>
        </div>
        {per === 'month' && real && Math.abs(v(row.spent) - target) > 5 && row.mortgage < 1 && row.shortfall < 1 && row.spendingFactor === 1 && (
          <div className="text-xs text-muted">Your target is {money(target)}/mo</div>
        )}
        {row.mortgage > 1 && (
          <div className="mt-0.5 flex items-center justify-between text-xs text-ink-2">
            <span>of which mortgage & loans</span>
            <span className="tnum">{money(v(row.mortgage))}</span>
          </div>
        )}
        {row.shortfall > 1 && (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-bad">
            <AlertTriangle size={14} /> Short of your target by {money(v(row.shortfall))}
            {suffix}
          </div>
        )}
        {row.spendingFactor < 0.999 && (
          <div className="mt-1 text-xs text-warn">Guardrails: spending trimmed to {Math.round(row.spendingFactor * 100)}% of target</div>
        )}
        {lump > 1 && (
          <div className="mt-1 text-xs text-ink-2">
            Tax-free lump sum taken this year: <strong className="text-ink">{money(real ? lump / row.deflator : lump)}</strong>, moved into
            ISAs/cash.
          </div>
        )}
      </div>

      {inc.pension + inc.statePension + inc.other > 1 && (
        <div className="mt-3 border-t border-line pt-2">
          <button
            onClick={() => setShowTax((s) => !s)}
            aria-expanded={showTax}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-accent-ink"
          >
            How the tax is worked out
            <ChevronDown size={14} className={`transition-transform ${showTax ? 'rotate-180' : ''}`} />
          </button>
          {showTax && (
            <div className="mt-2">
              <table className="tnum w-full text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 text-left font-medium">{per === 'month' ? 'Per month' : 'Per year'}</th>
                    {people.map((p) => (
                      <th key={p} className="py-1 text-right font-medium">
                        {names[p]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  <TaxRow label="Pension withdrawn" cells={people.map((p) => v(row.detail[p].pension))} />
                  <TaxRow label="– 25% tax-free" cells={people.map((p) => -v(row.detail[p].pensionTaxFree))} />
                  <TaxRow label="State Pension" cells={people.map((p) => v(row.detail[p].statePension))} />
                  <TaxRow label="DB pension & work" cells={people.map((p) => v(row.detail[p].other))} />
                  <TaxRow label="Interest & dividends" cells={people.map((p) => v(row.detail[p].savingsIncome))} />
                  <TaxRow label="Taxable income" cells={people.map((p) => v(row.detail[p].taxableIncome))} strong />
                  <TaxRow
                    label="– Tax-free allowance"
                    cells={people.map((p) => -Math.min(v(row.detail[p].allowance), v(row.detail[p].taxableIncome)))}
                  />
                  <TaxRow label="Income tax" cells={people.map((p) => v(row.detail[p].incomeTax))} strong />
                  <tr>
                    <td className="py-0.5">Effective rate</td>
                    {people.map((p) => {
                      const d = row.detail[p]
                      const drawn = d.pension + d.statePension + d.other + d.savingsIncome
                      return (
                        <td key={p} className="py-0.5 text-right">
                          {drawn > 0 ? `${((d.incomeTax / drawn) * 100).toFixed(1)}%` : '–'}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                25% of each pension withdrawal is tax-free (up to £268,275 each over your lifetime). The rest counts as income. Each of you
                has a £12,570 tax-free allowance, then pays 20% up to £50,270 and 40% above. ISA withdrawals are tax-free. The app takes
                just enough from each pot, in the cheapest order, to give you your take-home after tax.{' '}
                <button
                  className="text-accent-ink underline"
                  onClick={() => {
                    onEdit()
                    openSection('strategy')
                  }}
                >
                  Change the order or how tax-free cash is taken
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Line({ label, amount, color, sub, minus }: { label: string; amount: number; color?: string; sub?: boolean; minus?: boolean }) {
  if (amount <= 0.5) return null
  return (
    <div className={`flex items-center justify-between gap-2 ${sub ? 'py-0.5 pl-[18px] text-xs text-ink-2' : 'py-1 text-[13px]'}`}>
      <span className="flex items-center gap-2 text-ink-2">
        {color && <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />}
        {sub && <span className="text-muted">↳</span>}
        {label}
      </span>
      <span className="tnum text-ink">
        {minus ? '−' : ''}
        {money(amount)}
      </span>
    </div>
  )
}

function TaxRow({ label, cells, strong }: { label: string; cells: number[]; strong?: boolean }) {
  if (cells.every((c) => Math.abs(c) < 0.5)) return null
  return (
    <tr className={strong ? 'font-semibold text-ink' : ''}>
      <td className="py-0.5">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="py-0.5 text-right">
          {Math.abs(c) < 0.5 ? '–' : c < 0 ? `−${money(-c)}` : money(c)}
        </td>
      ))}
    </tr>
  )
}
