import { FileSpreadsheet, Home, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { balanceAfter, monthsToPayOff, paymentToClear, type MortgageStrategy } from '../engine/mortgage'
import { BASE_YEAR, pensionAccessAge } from '../engine/rules'
import type { Plan } from '../engine/types'
import { compact, money } from '../lib/format'
import { getAccessToken } from '../lib/google'
import { fetchCellNumber, parseCellRef, setSheetLink, useSheetLink } from '../lib/sheetLink'
import { MoneyField, PercentField, Section } from './fields'

type Edit = (fn: (d: Plan) => void) => void

const STRATEGIES: { value: MortgageStrategy; label: string; hint: string }[] = [
  { value: 'overpay', label: 'Clear it from salary before retiring', hint: "Overpay while you're working. Your retirement savings aren't touched." },
  { value: 'atRetirement', label: 'Pay off what’s left when we retire', hint: 'A lump sum from savings in the first year of retirement.' },
  { value: 'atAccess', label: 'Keep paying until pensions unlock, then clear it', hint: 'Monthly payments from savings, then pay off the rest with pension money (e.g. tax-free cash).' },
  { value: 'term', label: 'Keep paying monthly until it ends', hint: 'Payments come out of savings each month in retirement.' },
]

/** Year index when the household starts drawing on savings (mirrors the engine). */
function retireIdx(plan: Plan) {
  const idx = plan.people.map((p) => Math.max(0, p.retireAge - p.age))
  if (!plan.couple) return idx[0]
  return plan.spending.start === 'both' ? Math.max(...idx) : Math.min(...idx)
}

function monthLabel(monthsFromNow: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + monthsFromNow)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function MortgageSection({ plan, edit, editAll }: { plan: Plan; edit: Edit; editAll: Edit }) {
  const m = plan.mortgage
  const link = useSheetLink()
  const [ref, setRef] = useState(link?.cells?.mortgage ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (fn: (x: Plan['mortgage']) => void) => edit((d) => fn(d.mortgage))

  const d = retireIdx(plan)
  const retireAge = plan.people[0].age + d
  const months = monthsToPayOff(m)
  const freeAge = Number.isFinite(months) ? plan.people[0].age + Math.ceil(months / 12) : null
  const leftAtRetirement = balanceAfter(m, 12 * d)
  const needed = paymentToClear(m, 12 * d)
  const accessIdx = Math.min(
    ...plan.people.slice(0, plan.couple ? 2 : 1).map((p) => Math.max(0, pensionAccessAge(p.age, p.protectedPensionAge) - p.age)),
  )
  const accessAge = plan.people[0].age + accessIdx
  const leftAtAccess = balanceAfter(m, 12 * Math.max(d, accessIdx))
  const raw = plan.couple ? plan.people[0].name.trim() : ''
  const isYou = !raw || raw.toLowerCase() === 'you'
  const whenAge = (a: number) => (isYou ? `when you're ${a}` : `when ${raw} is ${a}`)

  const pull = () => {
    if (!link || link.source !== 'google') return
    const p = parseCellRef(ref)
    if (!p) return setErr('Use a cell reference like Mortgage!B21')
    setErr(null)
    setBusy(true)
    getAccessToken()
      .then(async (t) => {
        const v = Math.abs(await fetchCellNumber(link.id, ref, t))
        editAll((x) => void (x.mortgage.balance = Math.round(v)))
        setSheetLink({ ...link, cells: { ...link.cells, mortgage: `${p.tab}!${p.cell}` } })
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false))
  }

  return (
    <Section title="Home & mortgage" icon={<Home size={16} />} aside={m.balance > 0 ? `${compact(m.balance)} left` : 'None'} defaultOpen={m.balance > 0}>
      <MoneyField
        label="Mortgage left to pay"
        help="What you still owe on your home today (a repayment mortgage or home purchase plan). Leave at £0 if you own your home outright."
        value={m.balance}
        onChange={(v) => editAll((x) => void (x.mortgage.balance = v))}
        sliderMax={600_000}
        step={1000}
      />

      {link?.source === 'google' && (
        <div className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
          {link.cells?.mortgage ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-ink-2">
                <FileSpreadsheet size={13} className="text-good" />
                From {link.docTitle} › {link.cells.mortgage}, updated with “Refresh from sheet”
              </span>
              <button
                className="shrink-0 text-muted hover:text-bad"
                onClick={() => setSheetLink({ ...link, cells: { ...link.cells, mortgage: undefined } })}
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-ink-2">Pull from sheet cell</span>
              <input
                className="num-input min-w-0 flex-1 !text-left"
                placeholder="Mortgage!B21"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                aria-label="Sheet cell holding the mortgage balance"
              />
              <button
                onClick={pull}
                disabled={busy || !ref}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 font-medium text-white disabled:opacity-50"
              >
                {busy && <Loader2 size={12} className="animate-spin" />} Link
              </button>
            </div>
          )}
          {err && <p className="mt-1 text-bad">{err}</p>}
        </div>
      )}

      {m.balance > 0 && (
        <>
          <PercentField
            label="Interest rate"
            help="Your mortgage rate, or the rental rate on a home purchase plan."
            value={m.rate}
            onChange={(v) => set((x) => void (x.rate = v))}
            min={0}
            max={0.15}
            slider={false}
            decimals={2}
          />
          <MoneyField
            label="Monthly payment"
            value={m.monthly}
            onChange={(v) => set((x) => void (x.monthly = v))}
            slider={false}
            step={10}
          />

          <div className="my-2 space-y-1 rounded-xl border border-line p-3 text-[13px] leading-snug">
            {Number.isFinite(months) ? (
              <p>
                At {money(m.monthly)}/month it's paid off in <strong>{monthLabel(months)}</strong>
                {freeAge != null && <>, {whenAge(freeAge)}</>}.
              </p>
            ) : (
              <p className="text-bad">That payment doesn't cover the interest, so the balance never goes down.</p>
            )}
            {leftAtRetirement > 1 ? (
              <>
                <p>
                  When you retire in {BASE_YEAR + d} ({whenAge(retireAge).replace('when ', '')}), about{' '}
                  <strong>{money(leftAtRetirement)}</strong> would still be owed.
                </p>
                <p className="text-ink-2">
                  To be mortgage-free by then, pay <strong className="text-ink">{money(needed)}/month</strong> (
                  {money(needed - m.monthly)} more than now).
                </p>
              </>
            ) : (
              <p className="text-good">It'll be paid off before you retire. Nothing comes out of your savings.</p>
            )}
          </div>

          {leftAtRetirement > 1 && (
            <fieldset className="mt-2">
              <legend className="mb-1.5 text-[13px] text-ink-2">How will you clear it?</legend>
              <div className="space-y-1.5">
                {STRATEGIES.map((s) => (
                  <label
                    key={s.value}
                    className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 text-[13px] ${m.strategy === s.value ? 'border-accent bg-accent-wash' : 'border-line hover:bg-surface-2'}`}
                  >
                    <input
                      type="radio"
                      name="mortgage-strategy"
                      className="mt-0.5 accent-[var(--accent)]"
                      checked={m.strategy === s.value}
                      onChange={() => set((x) => void (x.strategy = s.value))}
                    />
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="block text-xs text-ink-2">
                        {s.hint}
                        {s.value === 'atRetirement' && ` About ${compact(leftAtRetirement)}.`}
                        {s.value === 'atAccess' && accessAge > retireAge && ` About ${compact(leftAtAccess)} left at ${accessAge}.`}
                        {s.value === 'overpay' && ` Needs ${money(needed)}/month.`}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <p className="mt-2 text-xs text-muted">
            Keep the mortgage out of your monthly take-home target. Horizon adds any payments from savings separately.
          </p>
        </>
      )}
    </Section>
  )
}
