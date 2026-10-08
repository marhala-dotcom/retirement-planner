import type { Plan } from '../engine/types'
import { CGT, DIVIDENDS, INCOME_TAX, ISA_ALLOWANCE, PENSION, PLSA, STATE_PENSION } from '../engine/rules'
import { money, pct } from '../lib/format'
import { Modal } from './Modal'

const REPO = 'https://github.com/marhala-dotcom/retirement-planner'

export function MethodModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const a = plan.assumptions
  return (
    <Modal title="How Horizon works" onClose={onClose}>
      <div className="space-y-6 text-[13px] leading-relaxed text-ink-2">
        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">In one paragraph</h3>
          <p>
            Horizon simulates your household year by year, from today to age {plan.planToAge}. While you work, contributions go into
            each pot. Once you retire, it works out how much to take from each pot to hit your take-home target after tax. It uses each
            person's own personal allowance, tax bands, CGT exemption and ISA allowance. Pensions stay locked until the minimum
            pension age. It then repeats the whole life {plan.simulations.toLocaleString()} times with randomly varying markets
            to show the range of outcomes. Everything runs in your browser, and your numbers are never sent anywhere.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">Your current assumptions</h3>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <KV k="Shares: long-run growth / volatility" v={`${pct(a.equityReturn, 1)} / ${pct(a.equityVol)}`} />
            <KV k="Bonds: long-run growth / volatility" v={`${pct(a.bondReturn, 1)} / ${pct(a.bondVol)}`} />
            <KV k="Cash interest" v={pct(a.cashRate, 1)} />
            <KV k="Inflation (CPI)" v={pct(a.inflation, 1)} />
            <KV k="Fees" v={pct(a.fees, 2)} />
            <KV k="Shares before / in retirement" v={`${pct(a.equityPre)} / ${pct(a.equityPost)}`} />
            <KV k="State Pension growth" v={`CPI + ${pct(a.statePensionReal, 1)}`} />
            <KV k="Tax thresholds after 2031" v={a.thresholdsAfterFreeze === 'cpi' ? 'Rise with CPI' : 'Stay frozen'} />
          </div>
          <p className="mt-2 text-xs">
            Growth rates are nominal compound (median) returns before fees. The central case is based on J.P. Morgan's 2026
            sterling forecasts (global equities 6.4%, gilts 4.7%, cash 2.7%) and Schroders' 30-year forecasts (6.6%), trimmed
            slightly for prudence.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">UK rules built in (2026/27)</h3>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <KV k="Personal allowance (frozen to 2031)" v={money(INCOME_TAX.personalAllowance)} />
            <KV k="Higher rate from" v={money(INCOME_TAX.personalAllowance + INCOME_TAX.basicBand)} />
            <KV k="Allowance taper" v={`above ${money(INCOME_TAX.taperThreshold)}`} />
            <KV k="Savings rates" v="20/40/45% → 22/42/47% from 2027" />
            <KV k="Dividend allowance / rates" v={`${money(DIVIDENDS.allowance)} / 10.75%, 35.75%, 39.35%`} />
            <KV k="CGT exemption / rates" v={`${money(CGT.annualExempt)} / 18%, 24%`} />
            <KV k="ISA allowance (each)" v={money(ISA_ALLOWANCE)} />
            <KV k="Lump Sum Allowance (each)" v={money(PENSION.lumpSumAllowance)} />
            <KV k="Minimum pension age" v="55 → 57 from 6 April 2028" />
            <KV k="Full State Pension" v={`£${STATE_PENSION.fullWeekly.toFixed(2)}/week`} />
            <KV k="State Pension age" v="67 (born 1961–76) · 68 (born after Apr 1978)" />
            <KV k="Scottish income tax" v="19/20/21/42/45/48%" />
          </div>
          <p className="mt-2 text-xs">
            Rules checked 8 October 2026. The Autumn Budget on 28 October 2026 may change figures for future years.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">How withdrawals are chosen each year</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Guaranteed income first: State Pensions, DB pensions, part-time work.</li>
            <li>
              Once pensions unlock, draw enough from each person's pension to use their £12,570 personal allowance. It's tax-free,
              and anything you don't spend is moved into ISAs.
            </li>
            <li>
              Then, depending on your chosen order: cash and GIA (inside the £3,000 CGT exemption), then pension up to the
              basic-rate limit, then ISAs and LISAs, then higher-rate pension.
            </li>
            <li>
              Every withdrawal is grossed up for income tax and CGT. Each person's tax is worked out separately. UFPLS
              withdrawals are 25% tax-free until the Lump Sum Allowance is used up.
            </li>
            <li>Bed & ISA moves GIA money into unused ISA allowances, but only within the CGT exemption.</li>
          </ol>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">Simulated markets</h3>
          <p>
            Shares and bonds get correlated random annual returns (lognormal) around the long-run rates above. Each simulated
            life also gets its own slightly different long-run average, because nobody knows the true future return. "Poor"
            and "Strong" are real simulated paths at the 10th and 90th percentiles of outcomes. "Crash" applies a 35% fall in
            shares in the first year of retirement, then steady growth. Flexible spending follows Guyton–Klinger-style guardrails
            anchored to a sustainable level. Each year we compare your spending with what your remaining savings, plus the value of
            future guaranteed income, can support to your plan age. If it's more than 10% above that, it's cut by 10%, never
            below your essential floor. When markets recover it's restored, up to your full target.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">Not modelled (yet)</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Death of one partner (the survivor's single allowance, lower spending, inherited pots). Both are assumed alive to the plan age.</li>
            <li>Inheritance tax on the estate, care costs, the property and its equity, mortgages (use one-off events instead).</li>
            <li>Tax on interest and dividends while you're still working, and tax relief beyond the gross contributions you enter.</li>
            <li>DB early-retirement reductions, annuities, salary sacrifice and the MPAA limit on contributions after drawing.</li>
            <li>Returns are random but not historical. Real markets have regimes and valuations this doesn't capture.</li>
          </ul>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-semibold text-ink">Benchmarks & sources</h3>
          <p>
            Pensions UK Retirement Living Standards 2026 (couple: {money(PLSA.couple.minimum)} / {money(PLSA.couple.moderate)} /{' '}
            {money(PLSA.couple.comfortable)}). Sustainable withdrawal research: Morningstar "State of Retirement Income" 2025,
            Pfau's international SWR studies, Early Retirement Now. Guardrails: Guyton & Klinger (2006). Longevity: ONS 2024-based
            cohort life tables. Full notes and links are in{' '}
            <a className="text-accent-ink underline" href={`${REPO}/blob/main/docs/RESEARCH.md`} target="_blank" rel="noreferrer">
              docs/RESEARCH.md
            </a>
            .
          </p>
          <p className="mt-2 rounded-xl bg-surface-2 p-3 text-xs">
            Horizon is an educational planning tool, not regulated financial advice. Tax rules can change. For decisions with big
            consequences (e.g. taking tax-free cash, transferring a DB pension) speak to a regulated adviser, or use the free
            government Pension Wise service if you're 50 or over.
          </p>
        </section>
      </div>
    </Modal>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1">
      <span>{k}</span>
      <span className="tnum text-right font-medium text-ink">{v}</span>
    </div>
  )
}
