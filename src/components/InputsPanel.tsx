import { CalendarHeart, Plus, PiggyBank, Route, Settings2, Trash2, TrendingUp, User, Users, Wallet } from 'lucide-react'
import { PRESETS } from '../engine/defaults'
import { PLSA, STATE_PENSION, birthYearFromAge, pensionAccessAge, statePensionAge } from '../engine/rules'
import { WRAPPERS, type LifeEvent, type Plan, type ReturnPreset, type WrapperKey } from '../engine/types'
import { WRAPPER_META } from '../lib/colors'
import { compact, money } from '../lib/format'
import { MoneyField, NumberField, PercentField, Section, Segmented, Toggle, InfoTip } from './fields'
import { SplitDonut } from './SplitDonut'
import { SheetSync } from './SheetSync'
import { applyToPlan } from '../lib/sheetImport'
import { MortgageSection } from './MortgageSection'
import { showsGia, visibleWrappers } from '../lib/pots'

type Edit = (fn: (d: Plan) => void) => void
export function InputsPanel({ plan, edit, editAll }: { plan: Plan; edit: Edit; editAll: Edit }) {
  const people = plan.couple ? [0, 1] : [0]
  return (
    <div>
      <Section title="Household" icon={<Users size={16} />}>
        <Segmented
          value={plan.couple ? 'couple' : 'single'}
          onChange={(v) => edit((d) => void (d.couple = v === 'couple'))}
          options={[
            { value: 'couple', label: 'Couple' },
            { value: 'single', label: 'Just me' },
          ]}
        />
        <Segmented
          label="Where you pay income tax"
          value={plan.region}
          onChange={(v) => edit((d) => void (d.region = v))}
          options={[
            { value: 'rUK', label: 'England, Wales, NI' },
            { value: 'scotland', label: 'Scotland' },
          ]}
        />
        <NumberField
          label="Plan until age"
          help="How long the money needs to last. A 40-year-old today has roughly a 1 in 4 chance of reaching 95; planning to 95–100 is prudent."
          value={plan.planToAge}
          onChange={(v) => edit((d) => void (d.planToAge = Math.round(v)))}
          min={70}
          max={110}
          sliderMin={80}
          sliderMax={105}
          width="w-16"
          suffix="yrs"
        />
      </Section>

      {people.map((i) => (
        <PersonSection key={i} plan={plan} edit={edit} i={i} />
      ))}

      <SavingsSection plan={plan} edit={edit} editAll={editAll} />
      <MortgageSection plan={plan} edit={edit} editAll={editAll} />
      <SpendingSection plan={plan} edit={edit} />
      <StrategySection plan={plan} edit={edit} />
      <AssumptionsSection plan={plan} edit={edit} />
    </div>
  )
}

function PersonSection({ plan, edit, i }: { plan: Plan; edit: Edit; i: number }) {
  const p = plan.people[i]
  const access = pensionAccessAge(p.age, p.protectedPensionAge)
  const spaAuto = statePensionAge(birthYearFromAge(p.age))
  const set = (fn: (person: Plan['people'][0]) => void) => edit((d) => fn(d.people[i]))
  return (
    <Section
      title={p.name || (i === 0 ? 'You' : 'Partner')}
      icon={<User size={16} />}
      aside={`${p.age} → retire ${p.retireAge}`}
      defaultOpen={i === 0}
    >
      <div className="flex items-center justify-between py-1.5">
        <label className="text-[13px] text-ink-2" htmlFor={`name-${i}`}>
          Name
        </label>
        <input
          id={`name-${i}`}
          className="num-input w-36 !text-left"
          value={p.name}
          maxLength={20}
          onChange={(e) => set((x) => void (x.name = e.target.value))}
        />
      </div>
      <NumberField
        label="Age today"
        value={p.age}
        onChange={(v) => set((x) => void (x.age = Math.round(v)))}
        min={18}
        max={90}
        sliderMin={20}
        sliderMax={75}
        width="w-16"
      />
      <NumberField
        label="Retire at"
        value={p.retireAge}
        onChange={(v) => set((x) => void (x.retireAge = Math.max(x.age, Math.round(v))))}
        min={p.age}
        max={85}
        sliderMin={Math.max(p.age, 40)}
        sliderMax={75}
        width="w-16"
        marks={[
          { value: access, label: `pension ${access}` },
          { value: Math.round(p.statePension.ageOverride ?? spaAuto), label: `State ${Math.round(p.statePension.ageOverride ?? spaAuto)}` },
        ]}
        help={`Private pensions can be accessed from ${access}${access === 57 ? ' (the minimum age rises from 55 to 57 on 6 April 2028)' : ''}. Retiring earlier means bridging the gap from ISAs and cash.`}
      />
      <NumberField
        label="State Pension (£/week)"
        help={`Today's money. The full new State Pension is £${STATE_PENSION.fullWeekly.toFixed(2)}/week in 2026/27 (35 qualifying years). Get your forecast at gov.uk/check-state-pension.`}
        value={p.statePension.weekly}
        onChange={(v) => set((x) => void (x.statePension.weekly = v))}
        min={0}
        max={400}
        sliderMax={260}
        step={0.01}
        sliderStep={1}
        decimals={2}
        prefix="£"
        width="w-20"
        marks={[{ value: STATE_PENSION.fullWeekly, label: 'full' }]}
      />
      <NumberField
        label={`State Pension age${p.statePension.ageOverride == null ? ' (auto)' : ''}`}
        help="Worked out from your age under current law: 67 if born 1961–1976, rising to 68 for anyone born after April 1978. A government review may change this; you can override it."
        value={p.statePension.ageOverride ?? spaAuto}
        onChange={(v) => set((x) => void (x.statePension.ageOverride = v))}
        min={60}
        max={75}
        step={0.5}
        decimals={spaAuto % 1 ? 1 : 0}
        width="w-16"
        slider={false}
      />
      <details className="group mt-1">
        <summary className="cursor-pointer select-none py-1.5 text-[13px] font-medium text-accent-ink">
          Other income (DB pension, part-time work)
        </summary>
        <MoneyField
          label="Defined-benefit pension (£/yr)"
          help="Final-salary or career-average pension, today's money, assumed to rise with inflation."
          value={p.db.annual}
          onChange={(v) => set((x) => void (x.db.annual = v))}
          sliderMax={40_000}
          step={500}
        />
        {p.db.annual > 0 && (
          <NumberField
            label="DB pension starts at"
            value={p.db.startAge}
            onChange={(v) => set((x) => void (x.db.startAge = Math.round(v)))}
            min={50}
            max={75}
            width="w-16"
          />
        )}
        <MoneyField
          label="Part-time work after retiring (£/yr)"
          help="Gross earnings after you 'retire', e.g. consulting. Taxed and subject to National Insurance."
          value={p.work.annual}
          onChange={(v) => set((x) => void (x.work.annual = v))}
          sliderMax={50_000}
          step={500}
        />
        {p.work.annual > 0 && (
          <NumberField
            label="Work until age"
            value={p.work.untilAge}
            onChange={(v) => set((x) => void (x.work.untilAge = Math.round(v)))}
            min={p.retireAge}
            max={80}
            width="w-16"
          />
        )}
        <Toggle
          label="Protected pension age (55)"
          help="Some schemes give an unqualified right to take benefits before 57. If yours does, you keep access at 55 after April 2028."
          checked={p.protectedPensionAge}
          onChange={(v) => set((x) => void (x.protectedPensionAge = v))}
        />
      </details>
    </Section>
  )
}

function SavingsSection({ plan, edit, editAll }: { plan: Plan; edit: Edit; editAll: Edit }) {
  const people = plan.couple ? [0, 1] : [0]
  const total = people.reduce((s, i) => s + WRAPPERS.reduce((a, w) => a + plan.people[i].pots[w], 0), 0)
  const byWrapper = WRAPPERS.map((w) => ({ key: w, value: people.reduce((s, i) => s + plan.people[i].pots[w], 0) }))
  const contribTotal = people.reduce((s, i) => s + WRAPPERS.reduce((a, w) => a + plan.people[i].contrib[w], 0), 0)
  const shown = visibleWrappers(plan)
  const extrasEmpty = !shown.includes('gia') && !shown.includes('lisa')
  const extrasUnused = people.every((i) => (['gia', 'lisa'] as const).every((w) => !plan.people[i].pots[w] && !plan.people[i].contrib[w]))

  const grid = (field: 'pots' | 'contrib') => (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{field === 'pots' ? 'Pot today' : '£ per month'}</th>
            {people.map((i) => (
              <th key={i} className="px-2 py-2 text-right font-medium">
                {plan.people[i].name || (i ? 'Partner' : 'You')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((w) => (
            <tr key={w} className="border-t border-line">
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: WRAPPER_META[w].color }} />
                  {WRAPPER_META[w].short}
                  <InfoTip text={WRAPPER_META[w].help} />
                </span>
              </td>
              {people.map((i) => (
                <td key={i} className="px-2 py-1 text-right">
                  <CellInput
                    value={plan.people[i][field][w]}
                    onChange={(v) => edit((d) => void (d.people[i][field][w as WrapperKey] = v))}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <Section title="Savings & investments" icon={<PiggyBank size={16} />} aside={compact(total)}>
      <SheetSync
        plan={plan}
        onApply={(result, names) => editAll((d) => applyToPlan(d, result, names))}
        onMortgage={(balance) => editAll((d) => void (d.mortgage.balance = Math.round(balance)))}
      />
      <div className="mb-3 flex items-center gap-4">
        <SplitDonut data={byWrapper} total={total} />
        <ul className="flex-1 space-y-1 text-xs">
          {byWrapper
            .filter((x) => x.value > 0)
            .map((x) => (
              <li key={x.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: WRAPPER_META[x.key].color }} />
                  {WRAPPER_META[x.key].short}
                </span>
                <span className="tnum font-medium">
                  {total > 0 ? Math.round((x.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
        </ul>
      </div>
      {grid('pots')}
      <div className="mt-4 mb-2 flex items-center gap-1.5 text-[13px] font-medium">
        Monthly saving until you retire
        <InfoTip text="Pension: the gross amount going in each month, including employer contributions and tax relief. Contributions stop at each person's retirement age and rise with inflation." />
        <span className="ml-auto text-xs font-normal text-muted">{money(contribTotal)}/mo</span>
      </div>
      {grid('contrib')}
      {extrasEmpty ? (
        <button
          onClick={() => edit((d) => void (d.extraPots = true))}
          className="mt-2 text-xs font-medium text-accent-ink hover:underline"
        >
          + Also have a general investment account or Lifetime ISA?
        </button>
      ) : (
        plan.extraPots &&
        extrasUnused && (
          <button onClick={() => edit((d) => void (d.extraPots = false))} className="mt-2 text-xs text-muted hover:text-ink hover:underline">
            Hide GIA & Lifetime ISA
          </button>
        )
      )}
      {plan.people.slice(0, people.length).some((p) => p.pots.gia > 0) && (
        <PercentField
          label="GIA: amount originally invested"
          help="Share of your GIA's value that is your original investment (cost basis). The rest is gain that may face capital gains tax when sold."
          value={plan.people[0].giaBasisPct}
          onChange={(v) => edit((d) => d.people.forEach((p) => (p.giaBasisPct = v)))}
          min={0}
          max={1}
          sliderStep={0.05}
          decimals={0}
        />
      )}
    </Section>
  )
}

function CellInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className="num-input w-full max-w-28"
      defaultValue={Math.round(value).toLocaleString('en-GB')}
      key={value}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => {
        const n = parseFloat(e.target.value.replace(/[£,\s]/g, ''))
        if (Number.isFinite(n) && n >= 0) onChange(n)
        else e.target.value = Math.round(value).toLocaleString('en-GB')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      aria-label="Amount in pounds"
    />
  )
}

const EVENT_PRESETS: Omit<LifeEvent, 'id'>[] = [
  { label: 'New car', age: 58, amount: -20_000, every: 8, untilAge: 82 },
  { label: 'Home improvements', age: 56, amount: -30_000, every: 0, untilAge: 56 },
  { label: 'Help the children', age: 60, amount: -25_000, every: 0, untilAge: 60 },
  { label: 'Inheritance', age: 65, amount: 100_000, every: 0, untilAge: 65 },
  { label: 'Downsize home', age: 70, amount: 150_000, every: 0, untilAge: 70 },
]

function SpendingSection({ plan, edit }: { plan: Plan; edit: Edit }) {
  const s = plan.spending
  const bench = plan.couple ? PLSA.couple : PLSA.single
  const m = (x: number) => Math.round(x / 12 / 50) * 50
  return (
    <Section title="Retirement spending" icon={<Wallet size={16} />} aside={`${money(s.monthly)}/mo`}>
      <MoneyField
        label="Monthly take-home you want"
        help="Household spending after tax, in today's money. Markers show the Pensions UK Retirement Living Standards 2026 (outside London, mortgage-free) for comparison."
        value={s.monthly}
        onChange={(v) => edit((d) => void (d.spending.monthly = v))}
        step={50}
        sliderMin={1000}
        sliderMax={8000}
        marks={[
          { value: m(bench.minimum), label: 'Minimum' },
          { value: m(bench.moderate), label: 'Moderate' },
          { value: m(bench.comfortable), label: 'Comfortable' },
        ]}
      />
      <p className="-mt-0.5 mb-2 text-xs text-muted">
        {money(s.monthly * 12)} a year in today's money · Retirement Living Standards ({plan.couple ? 'couple' : 'single'}):{' '}
        {compact(bench.minimum)} / {compact(bench.moderate)} / {compact(bench.comfortable)}
      </p>
      {plan.couple && (
        <Segmented
          label="Spending starts when"
          size="sm"
          value={s.start}
          onChange={(v) => edit((d) => void (d.spending.start = v))}
          options={[
            { value: 'first', label: 'First of us retires' },
            { value: 'both', label: 'Both retired' },
          ]}
        />
      )}
      <Toggle
        label="Spend less in later life"
        help="Research (Blanchett's 'retirement spending smile', ONS spending data) shows real spending typically falls through the 70s and 80s as travel and hobbies slow down."
        checked={s.smile}
        onChange={(v) => edit((d) => void (d.spending.smile = v))}
      />
      {s.smile && (
        <div className="mb-2 rounded-xl bg-surface-2 px-3 py-1">
          <div className="grid grid-cols-2 gap-x-3">
            <NumberField label="From age" value={s.slowAge} onChange={(v) => edit((d) => void (d.spending.slowAge = Math.round(v)))} min={60} max={95} slider={false} width="w-14" />
            <PercentField label="change" value={s.slowPct} onChange={(v) => edit((d) => void (d.spending.slowPct = v))} min={-0.6} max={0.5} slider={false} decimals={0} />
            <NumberField label="From age" value={s.lateAge} onChange={(v) => edit((d) => void (d.spending.lateAge = Math.round(v)))} min={60} max={100} slider={false} width="w-14" />
            <PercentField label="change" value={s.latePct} onChange={(v) => edit((d) => void (d.spending.latePct = v))} min={-0.6} max={0.5} slider={false} decimals={0} />
          </div>
        </div>
      )}

      <div className="mt-3 mb-1 flex items-center gap-2 text-[13px] font-medium">
        <CalendarHeart size={15} className="text-accent" /> Big one-offs
        <InfoTip text="Expenses (cars, weddings, helping children) and windfalls (inheritance, downsizing) in today's money, at your age. Windfalls are invested (ISA first)." />
      </div>
      <div className="space-y-2">
        {plan.events.map((ev, k) => (
          <div key={ev.id} className="rounded-xl border border-line p-2.5">
            <div className="flex items-center gap-2">
              <input
                className="num-input min-w-0 flex-1 !text-left"
                value={ev.label}
                aria-label="Event name"
                onChange={(e) => edit((d) => void (d.events[k].label = e.target.value))}
              />
              <button
                aria-label={`Remove ${ev.label}`}
                className="rounded p-1 text-muted hover:bg-surface-2 hover:text-bad"
                onClick={() => edit((d) => void d.events.splice(k, 1))}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-xs">
              <NumberField label="Amount" prefix="£" value={ev.amount} onChange={(v) => edit((d) => void (d.events[k].amount = v))} slider={false} width="w-20" step={1000} />
              <NumberField label="At age" value={ev.age} onChange={(v) => edit((d) => void (d.events[k].age = Math.round(v)))} slider={false} width="w-12" min={18} max={110} />
              <NumberField label="Repeat every" suffix="yr" value={ev.every} onChange={(v) => edit((d) => void (d.events[k].every = Math.max(0, Math.round(v))))} slider={false} width="w-12" min={0} max={30} />
              {ev.every > 0 && (
                <NumberField label="Until age" value={ev.untilAge} onChange={(v) => edit((d) => void (d.events[k].untilAge = Math.round(v)))} slider={false} width="w-12" min={ev.age} max={110} />
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted">Negative = expense, positive = money in.</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EVENT_PRESETS.map((e) => (
          <button
            key={e.label}
            onClick={() => edit((d) => void d.events.push({ ...e, id: Math.random().toString(36).slice(2) }))}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-accent hover:text-accent-ink"
          >
            <Plus size={12} /> {e.label}
          </button>
        ))}
      </div>
    </Section>
  )
}

function StrategySection({ plan, edit }: { plan: Plan; edit: Edit }) {
  const st = plan.strategy
  return (
    <Section title="Drawdown strategy" icon={<Route size={16} />} defaultOpen={false}>
      <Segmented
        label="Spending rule"
        help="Fixed: spend the same inflation-linked amount every year, whatever markets do. Flexible: Guyton–Klinger-style guardrails. Each year we check what your remaining money (plus future pensions) can sustain to your plan age. If you're spending more than 10% above that, spending is trimmed 10%, never below your essentials. When markets recover it's restored, up to your full target."
        value={st.type}
        onChange={(v) => edit((d) => void (d.strategy.type = v))}
        options={[
          { value: 'fixed', label: 'Fixed' },
          { value: 'guardrails', label: 'Flexible (guardrails)' },
        ]}
      />
      {st.type === 'guardrails' && (
        <PercentField
          label="Never cut below"
          help="Your essential spending as a share of your target. Guardrail cuts stop here."
          value={plan.spending.essentialPct}
          onChange={(v) => edit((d) => void (d.spending.essentialPct = v))}
          min={0.4}
          max={1}
          sliderStep={0.05}
          decimals={0}
        />
      )}
      <Segmented
        label="Which pots to draw first"
        help="Tax-smart: cash first, then pension up to the basic-rate limit, then ISAs, with higher-rate pension last. ISAs first: spend ISAs before pensions. Pensions first: run pensions down early (relevant now unused pensions face inheritance tax from April 2027)."
        size="sm"
        value={st.order}
        onChange={(v) => edit((d) => void (d.strategy.order = v))}
        options={[
          { value: 'taxSmart', label: 'Tax-smart' },
          { value: 'preservePension', label: 'ISAs first' },
          { value: 'pensionFirst', label: 'Pensions first' },
        ]}
      />
      <Segmented
        label="Pension tax-free cash"
        help="UFPLS: every withdrawal is 25% tax-free and 75% taxable. Up front: take 25% as a lump sum when you first draw (moved into your ISA), then the rest is fully taxable. Both are capped by the £268,275 Lump Sum Allowance."
        size="sm"
        value={st.tfc}
        onChange={(v) => edit((d) => void (d.strategy.tfc = v))}
        options={[
          { value: 'ufpls', label: '25% of each withdrawal' },
          { value: 'upfront', label: '25% lump sum up front' },
        ]}
      />
      <Toggle
        label="Use personal allowances every year"
        help="Each of you can take £12,570 of taxable income a year tax-free. Once pensions are accessible, draw at least that much from each pension every year and reinvest anything not spent in ISAs."
        checked={st.usePersonalAllowance}
        onChange={(v) => edit((d) => void (d.strategy.usePersonalAllowance = v))}
      />
      {showsGia(plan) && (
      <Toggle
        label="Bed & ISA each year"
        help="Move money from the taxable GIA into unused ISA allowances each year, only realising gains within the £3,000 CGT exemption."
        checked={st.bedAndIsa}
        onChange={(v) => edit((d) => void (d.strategy.bedAndIsa = v))}
      />
      )}
    </Section>
  )
}

function AssumptionsSection({ plan, edit }: { plan: Plan; edit: Edit }) {
  const a = plan.assumptions
  const setPreset = (p: ReturnPreset) =>
    edit((d) => {
      d.assumptions.preset = p
      if (p !== 'custom') Object.assign(d.assumptions, PRESETS[p])
    })
  const custom = (fn: (x: Plan['assumptions']) => void) =>
    edit((d) => {
      fn(d.assumptions)
      d.assumptions.preset = 'custom'
    })
  return (
    <Section title="Investments & assumptions" icon={<TrendingUp size={16} />} defaultOpen={false}>
      <Segmented
        label="Market outlook"
        help="Long-run return assumptions for a GBP investor, based on 2025–26 capital market assumptions from Vanguard, J.P. Morgan, BlackRock and others. Central is a middle-of-the-road view."
        value={a.preset}
        onChange={setPreset}
        size="sm"
        options={[
          { value: 'cautious', label: 'Cautious' },
          { value: 'central', label: 'Central' },
          { value: 'optimistic', label: 'Optimistic' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      <PercentField
        label="Shares (equities) while saving"
        help="The rest is in bonds. Applies to pensions and ISAs. Cash is held separately."
        value={a.equityPre}
        onChange={(v) => edit((d) => void (d.assumptions.equityPre = v))}
        min={0}
        max={1}
        sliderStep={0.05}
        decimals={0}
      />
      <PercentField
        label="Shares (equities) in retirement"
        value={a.equityPost}
        onChange={(v) => edit((d) => void (d.assumptions.equityPost = v))}
        min={0}
        max={1}
        sliderStep={0.05}
        decimals={0}
      />
      <PercentField
        label="Inflation (CPI)"
        help="Bank of England target is 2%. 2.5% is a common prudent long-run planning assumption."
        value={a.inflation}
        onChange={(v) => edit((d) => void (d.assumptions.inflation = v))}
        min={0}
        max={0.1}
        sliderMax={0.06}
        sliderStep={0.0025}
        decimals={2}
      />
      <PercentField
        label="Annual fees (platform + funds)"
        value={a.fees}
        onChange={(v) => edit((d) => void (d.assumptions.fees = v))}
        min={0}
        max={0.03}
        sliderMax={0.02}
        sliderStep={0.0005}
        decimals={2}
      />
      <details className="mt-1">
        <summary className="flex cursor-pointer items-center gap-1.5 py-1.5 text-[13px] font-medium text-accent-ink">
          <Settings2 size={14} /> Advanced
        </summary>
        <div className="grid grid-cols-2 gap-x-4">
          <PercentField label="Equity return" value={a.equityReturn} onChange={(v) => custom((x) => void (x.equityReturn = v))} min={0} max={0.15} slider={false} />
          <PercentField label="Equity volatility" value={a.equityVol} onChange={(v) => custom((x) => void (x.equityVol = v))} min={0} max={0.4} slider={false} />
          <PercentField label="Bond return" value={a.bondReturn} onChange={(v) => custom((x) => void (x.bondReturn = v))} min={0} max={0.12} slider={false} />
          <PercentField label="Bond volatility" value={a.bondVol} onChange={(v) => custom((x) => void (x.bondVol = v))} min={0} max={0.3} slider={false} />
          <PercentField label="Cash interest" value={a.cashRate} onChange={(v) => custom((x) => void (x.cashRate = v))} min={0} max={0.1} slider={false} />
          <NumberField label="Correlation" value={a.correlation} onChange={(v) => custom((x) => void (x.correlation = v))} min={-1} max={1} step={0.05} decimals={2} slider={false} width="w-16" />
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Returns are nominal, before fees, as long-run averages. Simulated years vary around these using a lognormal model.
        </p>
        <PercentField
          label="State Pension rises above inflation by"
          help="The triple lock raises it by the highest of earnings, CPI or 2.5%. Historically that has averaged ~1% above CPI; 0.5% is a cautious middle ground."
          value={a.statePensionReal}
          onChange={(v) => edit((d) => void (d.assumptions.statePensionReal = v))}
          min={-0.02}
          max={0.03}
          sliderMin={0}
          sliderMax={0.015}
          sliderStep={0.0025}
          decimals={2}
        />
        <Segmented
          label="Tax thresholds after April 2031"
          help="Income tax thresholds are frozen until April 2031. After that we assume they rise with inflation, or you can assume they stay frozen (more tax)."
          size="sm"
          value={a.thresholdsAfterFreeze}
          onChange={(v) => edit((d) => void (d.assumptions.thresholdsAfterFreeze = v))}
          options={[
            { value: 'cpi', label: 'Rise with inflation' },
            { value: 'frozen', label: 'Stay frozen' },
          ]}
        />
        <PercentField
          label="Contributions rise above inflation by"
          value={a.contribGrowthReal}
          onChange={(v) => edit((d) => void (d.assumptions.contribGrowthReal = v))}
          min={-0.05}
          max={0.1}
          sliderMin={0}
          sliderMax={0.04}
          sliderStep={0.005}
        />
        <Segmented
          label="Simulations"
          size="sm"
          value={String(plan.simulations) as '500' | '1000' | '2000' | '5000'}
          onChange={(v) => edit((d) => void (d.simulations = Number(v)))}
          options={[
            { value: '500', label: '500' },
            { value: '1000', label: '1,000' },
            { value: '2000', label: '2,000' },
            { value: '5000', label: '5,000' },
          ]}
        />
      </details>
    </Section>
  )
}
