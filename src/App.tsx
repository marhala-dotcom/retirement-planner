import { Lock, SlidersHorizontal, X, LineChart as LineIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgeScrubber } from './components/AgeScrubber'
import { AssumptionsBar } from './components/AssumptionsBar'
import { CompareModal } from './components/CompareModal'
import { IncomeChart } from './components/IncomeChart'
import { InputsPanel } from './components/InputsPanel'
import { Insights } from './components/Insights'
import { KpiStrip } from './components/KpiStrip'
import { MethodModal } from './components/MethodModal'
import { RetireAgeChart } from './components/RetireAgeChart'
import { Timeline } from './components/Timeline'
import { TopBar, type Theme } from './components/TopBar'
import { WealthChart, type ChartMode, type MarketView } from './components/WealthChart'
import { YearTable } from './components/YearTable'
import { runCrash } from './engine/montecarlo'
import { useEngine } from './hooks/useEngine'
import { normalizePlan, usePlans } from './hooks/usePlans'
import { buildInsights } from './lib/insights'
import { milestones } from './lib/milestones'

const UI_KEY = 'horizon-ui.v1'
function loadUi() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as { real?: boolean; theme?: Theme; welcomed?: boolean }
  } catch {
    return {}
  }
}

export default function App() {
  const store = usePlans()
  const plan = store.active.plan
  const engine = useEngine(plan)
  const { steady } = engine
  const P = steady.P
  const [ui0] = useState(loadUi)

  const [real, setReal] = useState(ui0.real ?? true)
  const [theme, setTheme] = useState<Theme>(ui0.theme ?? 'system')
  const [welcomed, setWelcomed] = useState(ui0.welcomed ?? false)
  const [mode, setMode] = useState<ChartMode>('breakdown')
  const [market, setMarket] = useState<MarketView>('typical')
  const [tab, setTab] = useState<'results' | 'plan'>('results')
  const [modal, setModal] = useState<'compare' | 'method' | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ real, theme, welcomed }))
    } catch {
      /* ignore */
    }
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [real, theme, welcomed])

  const rows = steady.rows!
  const minAge = rows[0].ages[0]
  const maxAge = rows[rows.length - 1].ages[0]
  const retireAt = rows[Math.min(P.drawStart, rows.length - 1)].ages[0]
  const [scrubRaw, setScrubAgeRaw] = useState(retireAt)
  const scrubAge = Math.min(maxAge, Math.max(minAge, scrubRaw))
  const setScrubAge = useCallback(
    (a: number) => setScrubAgeRaw((cur) => (a === -1 ? Math.min(maxAge, cur + 1) : Math.min(maxAge, Math.max(minAge, a)))),
    [minAge, maxAge],
  )

  const crashRows = useMemo(() => (market === 'crash' ? runCrash(P).rows! : null), [market, P])
  const marketRows =
    market === 'crash' ? crashRows! : market === 'typical' || !engine.paths ? rows : market === 'poor' ? engine.paths.poor : engine.paths.strong

  const marks = useMemo(() => milestones(P), [P])
  const names = plan.people.map((p, i) => p.name || (i ? 'Partner' : 'You'))
  const depletedAge = steady.depletedAtIndex >= 0 ? rows[steady.depletedAtIndex].ages[0] : null
  const insights = useMemo(
    () =>
      buildInsights({
        P,
        rows,
        depletedAt: steady.depletedAtIndex,
        potAtRet: steady.potAtRetirementReal,
        mc: engine.mc,
        solve: engine.solve,
        sweep: engine.sweep,
      }),
    [P, rows, steady, engine.mc, engine.solve, engine.sweep],
  )

  const exportPlans = () => {
    const blob = new Blob([JSON.stringify({ app: 'horizon', version: 1, scenarios: store.scenarios }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'horizon-retirement-plans.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importPlans = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      const list = Array.isArray(data?.scenarios) ? data.scenarios : data?.people ? [{ name: 'Imported plan', plan: data }] : []
      if (!list.length) throw new Error('No plans found')
      list.forEach((s: { name?: string; plan: unknown }) => store.addPlan(String(s.name ?? 'Imported plan').slice(0, 40), normalizePlan(s.plan)))
    } catch {
      alert("Sorry, that file couldn't be read as a Horizon plan.")
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar
        scenarios={store.scenarios}
        activeId={store.active.id}
        onSelect={store.select}
        onDuplicate={() => store.duplicate()}
        onRename={store.rename}
        onDelete={store.remove}
        onReset={store.reset}
        onExport={exportPlans}
        onImport={importPlans}
        onCompare={() => setModal('compare')}
        onMethod={() => setModal('method')}
        real={real}
        setReal={setReal}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Mobile tabs */}
      <div className="sticky top-16 z-20 flex gap-1 border-b border-line bg-page p-2 lg:hidden">
        {(
          [
            ['results', 'Results', LineIcon],
            ['plan', 'Edit plan', SlidersHorizontal],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium ${tab === k ? 'bg-control shadow-sm' : 'text-ink-2'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside
          className={`${tab === 'plan' ? 'block' : 'hidden'} border-line bg-surface lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-r`}
          aria-label="Your plan"
        >
          <div className="border-b border-line px-5 py-4">
            <h1 className="text-lg font-semibold tracking-tight">Your plan</h1>
            <p className="text-xs text-muted">Everything in today's money. Results update as you type.</p>
          </div>
          <InputsPanel plan={plan} edit={store.edit} editAll={store.editAll} />
          <div className="flex items-start gap-2 px-5 py-4 text-xs text-muted">
            <Lock size={13} className="mt-0.5 shrink-0" />
            Your numbers are saved only in this browser. Nothing is uploaded.
          </div>
        </aside>

        <main className={`${tab === 'results' ? 'block' : 'hidden'} min-w-0 space-y-5 p-4 sm:p-6 lg:block`}>
          {!welcomed && (
            <div className="card relative flex gap-4 border-accent/30 bg-accent-wash p-5 pr-12">
              <div>
                <h2 className="text-base font-semibold">Welcome — this is an example plan</h2>
                <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-2">
                  A couple aged 40 with £300,000 across pensions, ISAs and cash, both retiring at 55 and wanting £3,000 a month. Replace
                  the numbers in <span className="font-medium text-ink">Your plan</span> with your own. Drag the age slider to see what's
                  left each year, and save variations to compare. Everything stays on your device.
                </p>
              </div>
              <button aria-label="Dismiss" onClick={() => setWelcomed(true)} className="absolute top-3 right-3 rounded-lg p-1.5 text-muted hover:bg-surface">
                <X size={16} />
              </button>
            </div>
          )}

          <KpiStrip P={P} potAtRet={steady.potAtRetirementReal} depletedAge={depletedAge} mc={engine.mc} solve={engine.solve} busy={engine.busy} />

          <AssumptionsBar plan={plan} onEdit={() => setTab('plan')} />

          <WealthChart
            rows={marketRows}
            mc={engine.mc}
            real={real}
            mode={mode}
            setMode={setMode}
            market={market}
            setMarket={setMarket}
            scrubAge={scrubAge}
            onScrub={setScrubAge}
            marks={marks}
            planToAge={plan.planToAge}
            names={names}
            couple={plan.couple}
            busy={engine.busy}
          />

          <AgeScrubber
            rows={marketRows}
            age={scrubAge}
            setAge={setScrubAge}
            real={real}
            marks={marks}
            names={names}
            couple={plan.couple}
            market={market}
            spa={P.spa}
            accessAge={P.accessAge}
            target={plan.spending.monthly}
            onEdit={() => setTab('plan')}
          />

          <Timeline P={P} onPick={setScrubAge} />

          <div className="grid gap-5 2xl:grid-cols-2">
            <IncomeChart rows={rows} real={real} scrubAge={scrubAge} onScrub={setScrubAge} names={names} couple={plan.couple} />
            <RetireAgeChart
              sweep={engine.sweep}
              current={plan.people[0].retireAge}
              couple={plan.couple}
              busy={engine.busy}
              onPick={(age) =>
                store.edit((d) => {
                  const delta = age - d.people[0].retireAge
                  d.people[0].retireAge = age
                  d.people[1].retireAge = Math.max(d.people[1].age, d.people[1].retireAge + delta)
                })
              }
            />
          </div>

          <Insights items={insights} />

          <YearTable rows={rows} real={real} couple={plan.couple} names={names} />

          <footer className="pb-8 text-center text-xs leading-relaxed text-muted">
            Horizon · UK rules for 2026/27, checked October 2026 · Educational tool, not financial advice ·{' '}
            <button className="underline hover:text-ink" onClick={() => setModal('method')}>
              How it works
            </button>
          </footer>
        </main>
      </div>

      {modal === 'compare' && <CompareModal scenarios={store.scenarios} activeId={store.active.id} onClose={() => setModal(null)} />}
      {modal === 'method' && <MethodModal plan={plan} onClose={() => setModal(null)} />}
    </div>
  )
}
