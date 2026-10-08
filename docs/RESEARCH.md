# Research notes: what a best-in-class UK retirement planner needs

Compiled 8 October 2026. This document records the research behind Horizon's design: what the best tools do, the UK rules the model uses, and the evidence behind each default assumption. Figures for future tax years may change at the Autumn Budget on 28 October 2026.

---

## 1. The landscape

| Tool | Best at | Users complain about |
|---|---|---|
| **ProjectionLab** | A polished, privacy-first life model with Monte Carlo and historical tests. Has a Sankey diagram for any year and compare overlays. UK wrappers and PCLS/UFPLS were added in April 2026. | A learning curve, a US feel, and manual entry. |
| **Boldin** (US) | Guided setup and a "chance of success" score, now reframed as "probability of needing adjustments". | A crowded first session. Its score changed with methodology, not with users' finances. |
| **Pralana** | The deepest tax optimisation. Shows deterministic, Monte Carlo and historical results on one chart. | Intimidating, with Excel roots. |
| **MaxiFi** | Solves for the smoothest affordable spending. | Opaque engine. You can't test your own target. |
| **FIRECalc, cFIREsim, FICalc** | Fast historical sequence testing. FICalc has around 12 withdrawal rules. | US-only data and tax. Users read the success rate as a forecast. |
| **Voyant (UK adviser tool)** | Yearly cash-flow bars, blue when funded and red when short, with drill-down by asset. Has a compare-plans view. | "A bit of a beast", too granular. |
| **Timeline (UK adviser tool)** | 100+ years of historical stress tests, guardrail withdrawal rules and IHT planning. | Only available through advisers. |
| **Guiide** | Very few inputs and a tax-aware drawdown order. Users like how it shows the bridge to State Pension. | Single person only, no ISA wrapper, tax-free cash is all-or-nothing. |
| **RetireEasy** | Couples, IHT and up to 10 scenarios. | A dated interface and opaque handling of tax-free cash. |
| **Provider calculators** (HL, ii, AJ Bell, PensionBee, Nutmeg) | Quick single-pot estimates. | Single person, single pot, and they funnel you to their own products. |
| **Spreadsheets** (e.g. Ian Shadrack's) | The full UK rule set with transparent assumptions. | Poor UX and no visuals. |

**Gap Horizon targets:** a free, private, *couple-first* UK planner with a real tax engine, the 55→57 pension access bridge, and visuals a non-expert can read.

### Visualisations and interactions that work
- **Stacked wealth by wrapper.** It shows ISAs draining during the bridge and pensions taking over.
- **Income-source stacked bars with a spending-target line.** This is the Voyant pattern, with shortfalls shown in red.
- **Fan charts with plain-English band labels.** Bank of England experiments found people anchor on the middle, so the labels should say "half of outcomes" and "8 in 10".
- **Dual-age milestone timeline** for both partners.
- **Live sliders with instant recalculation**, side-by-side scenario comparison, and a year scrubber.
- **Avoid a lone success-probability gauge.** It hides how bad a failure would be. Pair it with spending-cut metrics and money-lasts ages (Kitces, CFA Institute).

### UX pitfalls to avoid
- Too many inputs up front. Start from a filled-in example and reveal detail progressively.
- Confusing nominal and real money. Default to today's money, with a visible toggle.
- Opaque assumptions. Show the year-by-year working and every assumption.
- Stale tax rules. Show a "rules as of" badge.
- Single-person tools that force couples to run them twice.
- Sales nudges.

---

## 2. UK rules used (2026/27)

| Area | Rule | Source |
|---|---|---|
| Income tax (rUK) | Personal allowance £12,570. Basic 20% to £50,270, higher 40% to £125,140, additional 45%. Allowance tapers above £100k. **Frozen to 5 April 2031.** | [gov.uk rates](https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past), [freeze to 2031](https://www.gov.uk/government/publications/maintaining-income-tax-and-equivalent-national-insurance-contributions-thresholds-until-5-april-2031) |
| Scottish income tax | 19% starter to £16,537, 20% to £29,526, 21% to £43,662, 42% to £75,000, 45% to £125,140, 48% above | [gov.scot](https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/) |
| Savings income | Personal savings allowance £1,000 / £500 / £0. Starting rate band £5,000. Rates **22/42/47% from April 2027**. | [gov.uk technical note](https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-and-dividend-income/change-to-tax-rates-for-property-savings-and-dividend-income-technical-note) |
| Dividends | Allowance £500. **10.75% / 35.75% / 39.35% from April 2026.** | as above |
| CGT | Annual exempt amount £3,000. 18% / 24%. | [gov.uk CGT](https://www.gov.uk/capital-gains-tax/rates) |
| ISAs | £20,000 each, frozen to 2031. Cash ISA cap of £12,000 for under-65s from April 2027. LISA: £4k a year, 25% bonus, pay in until 50, withdraw from 60. | [ISA newsletter Sept 2026](https://www.gov.uk/government/publications/tax-free-savings-newsletter-23/tax-free-savings-newsletter-23-september-2026), [LISA](https://www.gov.uk/lifetime-isa) |
| Pensions | Annual allowance £60k, MPAA £10k, Lump Sum Allowance £268,275. UFPLS is 25% tax-free per withdrawal. | [pension schemes rates](https://www.gov.uk/government/publications/rates-and-allowances-pension-schemes/pension-schemes-rates) |
| Pension access | Normal minimum pension age **55 → 57 on 6 April 2028**. Protected pension ages exist for some schemes. | [Finance Act 2022 s10](https://www.legislation.gov.uk/ukpga/2022/3/section/10) |
| IHT on pensions | Unused pensions are in the estate for deaths from **6 April 2027**. Spouse exemption applies. | [gov.uk](https://www.gov.uk/government/publications/inheritance-tax-unused-pension-funds-and-death-benefits/inheritance-tax-on-unused-pension-funds-and-death-benefits) |
| State Pension | Full new State Pension **£241.30/week (£12,547.60/yr)**. 35 qualifying years for the full amount. Triple lock continues. | [gov.uk](https://www.gov.uk/new-state-pension/what-youll-get) |
| State Pension age | 67 for those born 6 Mar 1961 – 5 Apr 1977. Phased for 1977–78. **68 for anyone born after 5 April 1978.** A third review is under way. | [Pensions Act 1995 Sch 4](https://www.legislation.gov.uk/ukpga/1995/26/schedule/4), [review](https://www.gov.uk/government/collections/third-state-pension-age-review) |
| National Insurance | Employee 8% from £12,570 to £50,270, 2% above. None above State Pension age. | gov.uk |
| Salary sacrifice | NI relief capped at £2,000 a year from April 2029 (not yet modelled). | [gov.uk](https://www.gov.uk/government/publications/changes-to-salary-sacrifice-for-pensions-from-april-2029/changes-to-salary-sacrifice-for-pensions-from-april-2029) |

**Implication for a couple aged 40 retiring at 55:**
- **Ages 55–57:** ISAs, GIA and cash must fund everything.
- **Ages 57–68:** pension drawdown, ideally using both personal allowances every year.
- **From 68:** two State Pensions, worth about £25k a year in today's money.

---

## 3. Modelling assumptions

### Capital market assumptions (GBP, long run)
The central case is based mainly on the [J.P. Morgan 2026 LTCMA sterling matrix](https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/ltcma-2026-us-matrix_gbp.pdf). J.P. Morgan's own figures are global equities 6.4% compound with 13.8% volatility, UK gilts 4.7%, and cash 2.7%. They are cross-checked against [Schroders' 30-year forecasts](https://www.schroders.com/nl-nl/nl/professionele/inzichten/long-run-asset-class-performance-30-year-return-forecasts-2026-55-/) (global equities 6.6%) and [Vanguard's VCMM](https://www.vanguard.co.uk/professional/insights/whats-driving-the-outlook-fo-gilt-returns).

All returns below are long-run compound (median) nominal rates.

| | Cautious | **Central** | Optimistic |
|---|---|---|---|
| Global equities | 4.5% (vol 16%) | **6.0% (vol 15%)** | 7.5% |
| Bonds | 3.5% (vol 6%) | **4.3% (vol 6%)** | 5.0% |
| Cash | 2.5% | **3.0%** | 3.5% |

- Equity–bond correlation +0.2. J.P. Morgan has ACWI vs gilts at +0.19.
- Fees default to 0.40% a year. DIY platforms charge 0–0.35%, and global trackers 0.10–0.25%.
- CPI 2.5%. The Bank of England target is 2% and the OBR's long-run assumption is 2%, so 2.5% adds prudence.
- State Pension rises at CPI + 0.5%, a cautious middle ground for the triple lock.

### Monte Carlo design
- Annual steps with correlated lognormal equity and bond returns around the compound rates.
- **Parameter uncertainty:** each simulated history draws its own long-run mean (equities ±1% sd, bonds ±0.5% sd), following the [Kitces](https://www.kitces.com/blog/monte-carlo-analysis-risk-fat-tails-vs-safe-withdrawal-rates-rolling-historical-returns/) critique that standard Monte Carlo is overconfident.
- 2,000 simulations by default, with up to 5,000 available. The standard error at 1,000 runs is about ±1.1 points. The seed is fixed so results stay stable while you edit.
- **Reported metrics:**
  - Chance money lasts.
  - Chance of a spending cut deeper than 10%.
  - The poor-markets (10th percentile) age at which money runs out.
  - Median legacy.
  - A fan chart.
  - Representative poor, typical and strong paths.
  - A −35% crash in the first year of retirement, as a stress test.

### Sustainable withdrawal rates
- **Morningstar, December 2025:** 3.9% for 30 years at 90% success, 3.5% for 35 years, about 3.2–3.3% for 40 years.
- **Pfau, UK history 1900–2015:** about 3.4% for a 50/50 portfolio. Subtract about 0.5 points for 40+ years, plus half of fees.
- **Early Retirement Now:** 3.25–3.5% survived the worst US history over 50–60 years.
- **Horizon's benchmark:** about 3% for a 45-year retirement with fixed spending, or 3.5–4% with guardrails.

### Flexible spending (guardrails)
- [Guyton & Klinger (2006)](https://www.financialplanningassociation.org/sites/default/files/2021-11/2006%20-%20Guyton%20and%20Klinger%20-%20Decision%20Rules%20and%20SWR%20(1).PDF): cut spending 10% if the withdrawal rate is more than 20% above its initial level; raise it 10% if it is more than 20% below.
- **Horizon's variant** anchors to a *funded ratio* instead of the initial withdrawal rate. Each year it compares savings with the present value of future spending minus after-tax guaranteed income, discounted at the portfolio's median real return. Below 90% funded it cuts 10%, never below an essential floor. When funding recovers it restores spending up to the target.
- **Why the change:**
  1. It handles the years before State Pension correctly, because you cannot borrow against a future State Pension.
  2. It does not lock in an unsustainable starting rate.
  3. Spending never goes above target, so being flexible can only improve the chance of success.
- **Effect on the example plan:** fixed spending at £3,000/month lasts in 37% of simulations. Guardrails raise that to 75%, but in about half of simulations spending is cut by more than 10% at some point.

### Retirement Living Standards
These are 2026 figures from Pensions UK (formerly the PLSA), published 3 June 2026. They are annual spending after tax, for someone who owns their home outright and lives outside London.

| | Single | Couple |
|---|---|---|
| Minimum | £13,900 | £22,500 |
| Moderate | £32,700 | £45,400 |
| Comfortable | £45,400 | £62,700 |

### Tax-efficient drawdown order (default "tax-smart")
1. Guaranteed income: State Pension, DB pensions and work.
2. Pension withdrawals that fill **each** spouse's personal allowance. This is about £16,760 of UFPLS each, all tax-free. Anything not needed is reinvested in ISAs.
3. Cash, then GIA (gains within the £3k exemption each).
4. Pension up to each spouse's basic-rate limit, about 15% effective tax with UFPLS.
5. LISA (60+), then ISAs.
6. Higher-rate pension last.

**Bed & ISA** moves GIA money into unused ISA allowances each year, within the CGT exemption.

Because pensions enter the IHT estate from April 2027, "pension last" is no longer automatically right. Users can switch to "ISAs first" or "pensions first" to compare.

### Longevity (couple aged 40 in 2026, ONS 2024-based cohort tables)
| | Man | Woman | At least one alive |
|---|---|---|---|
| Reach 90 | 40% | 52% | 71% |
| Reach 95 | 20% | 30% | 44% |
| Reach 100 | 5% | 10% | 15% |

Horizon therefore defaults to planning to age **100**.

### Spending in later life
Blanchett's ["retirement spending smile"](https://www.soa.org/globalassets/assets/files/resources/essays-monographs/2014-living-to-100/mono-li14-1a-blanchett.pdf) shows real spending falling about 1–1.5% a year through the 70s and 80s. Horizon offers this as a toggle (−10% from 75 and −20% from 85 by default).

---

## 4. Built vs roadmap

**Built:**
- **Household and tax:** couple or single, England/Wales/NI or Scotland, and five wrappers per person (pension, ISA, GIA, cash, LISA).
- **Pension rules:** the 55→57 access age with protected pension age, State Pension age from date of birth, UFPLS or up-front PCLS, and the Lump Sum Allowance.
- **Income:** DB pensions and part-time work, with NI.
- **Withdrawals:** a tax-aware order using both personal allowances, and Bed & ISA.
- **Spending:** guardrails, the spending smile, and one-off life events.
- **Analysis:** Monte Carlo with parameter uncertainty, a crash stress test, solvers for sustainable and 90%-confidence spending, and a retirement-age sweep.
- **Interface:** an age scrubber ("how much is left at age X"), scenario comparison, CSV and JSON export, and dark mode.
- **Privacy:** everything stays in the browser.

**Roadmap (ranked):**
1. Survivor modelling: one partner dies, so the survivor has a single allowance, lower spending and inherited pots.
2. An IHT estimate, including pensions from 2027.
3. Historical block-bootstrap mode (UK/global returns).
4. State Pension forecast helper: NI gaps and voluntary contributions.
5. DB early-retirement factors, annuity purchase and MPAA warnings for contributions after access.
6. Salary input, to tax savings income and gains while working, and the salary sacrifice NI cap from 2029.
7. A tracking mode comparing actual results with the plan.
8. A Sankey view of a single year's flows.
