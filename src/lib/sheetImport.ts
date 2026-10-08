// Turn a spreadsheet of balances (Google Sheet or CSV) into Horizon's pots.
// Works on a plain grid of cell values, so it doesn't care where the data came from.
// Nothing here is ever sent anywhere: it runs in the browser.

import type { Plan, Pots, WrapperKey } from '../engine/types'

export type Target = WrapperKey | 'debt' | 'ignore'
export type Owner = 0 | 1 | 'split'
export interface Mapping {
  target: Target
  owner: Owner
}
export interface SheetRow {
  label: string
  amount: number
  category: string
}

export const TARGET_LABELS: Record<Target, string> = {
  pension: 'Pension',
  isa: 'Stocks & Shares ISA',
  gia: 'General investments (GIA)',
  cash: 'Cash savings',
  lisa: 'Lifetime ISA',
  debt: 'Debt — pay off now',
  ignore: "Don't include",
}

/** Spreadsheet ID and tab (gid) from a Google Sheets URL. */
export function parseSheetUrl(url: string): { id: string; gid: number | null } | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
  if (!m) return null
  const g = url.match(/[#&?]gid=(\d+)/)
  return { id: m[1], gid: g ? Number(g[1]) : null }
}

/** Numbers as Sheets may return them: 1234, "£ 1,234", "(7,575)", "-", "". */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  if (/^[£$€\s]*-+\s*$/.test(s)) return 0 // accounting dash
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[£$€\s]/g, ''))
  const digits = s.replace(/[^0-9.]/g, '')
  if (!digits || !/\d/.test(digits)) return null
  const n = parseFloat(digits)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

/** Find the header row and the label / amount / category columns, then read the rows. */
export function gridToRows(grid: unknown[][]): SheetRow[] {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
  let headerRow = -1
  let labelCol = 0
  let amountCol = -1
  let categoryCol = -1
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r] ?? []
    const a = row.findIndex((c) => /^(amount|value|balance|£|total value|current value)$/i.test(text(c)))
    if (a >= 0) {
      headerRow = r
      amountCol = a
      const l = row.findIndex((c) => /^(asset|account|name|item|description|holding)s?$/i.test(text(c)))
      labelCol = l >= 0 ? l : 0
      categoryCol = row.findIndex((c) => /categ|type|class/i.test(text(c)))
      break
    }
  }
  if (amountCol < 0) {
    // No header: label = first mostly-text column, amount = first mostly-numeric column.
    const width = Math.max(0, ...grid.map((r) => r?.length ?? 0))
    let best = -1
    let bestCount = 0
    for (let c = 0; c < width; c++) {
      const count = grid.filter((r) => toNumber(r?.[c]) != null).length
      if (count > bestCount) {
        best = c
        bestCount = count
      }
    }
    amountCol = best
    labelCol = best > 0 ? 0 : 1
  }
  if (amountCol < 0) return []
  const out: SheetRow[] = []
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    const label = text(row[labelCol])
    const amount = toNumber(row[amountCol])
    if (!label || amount == null) continue
    out.push({ label, amount, category: categoryCol >= 0 ? text(row[categoryCol]) : '' })
  }
  return out
}

/** Best guess at which pot a row belongs to, from its name and category. */
export function classify(label: string, category = ''): Target {
  const s = label.toLowerCase()
  const c = category.toLowerCase()
  if (/net worth|^total|subtotal|actual equity|grand total/.test(s)) return 'ignore'
  if (/house|property|home|real estate|valuation|mortgage/.test(s)) return 'ignore'
  if (/liabilit|debt|credit card|overdraft|loan|owed|borrow/.test(s)) return 'debt'
  if (/lifetime isa|\blisa\b/.test(s)) return 'lisa'
  if (/pension|sipp|ssas|workplace|\bnest\b|annuit|retirement/.test(s)) return 'pension'
  if (/cash isa/.test(s)) return 'cash'
  if (/\bisa\b|isas\b/.test(s)) return 'isa'
  if (/crypto|bitcoin|\bbtc\b|\beth\b/.test(s)) return 'gia'
  if (/stock|share|\bgia\b|general|invest|fund|trading|dealing|broker|equit|etf/.test(s)) return 'gia'
  if (/saving|cash|bank|current|deposit|premium bond|easy access|saver|account/.test(s)) return 'cash'
  if (/cash|saving/.test(c)) return 'cash'
  if (/invest/.test(c)) return 'gia'
  return 'ignore'
}

const NOT_NAMES = new Set([
  'joint', 'total', 'net', 'house', 'home', 'stocks', 'shares', 'crypto', 'cash', 'savings', 'pension', 'pensions',
  'isa', 'gia', 'lisa', 'liabilities', 'actual', 'the', 'our', 'my', 'uae', 'uk', 'us', 'eu', 'other', 'emergency',
])

/** People's names that prefix rows: "Alex Pensions", "Alex Savings", "Sam's ISA".
 *  A name counts if it prefixes two rows, or one row that is clearly a personal pot. */
export function detectNames(rows: SheetRow[]): string[] {
  const score = new Map<string, number>()
  for (const r of rows) {
    const [first, ...rest] = r.label.split(/[\s'’-]+/).filter(Boolean)
    if (!first || !/^[A-Z][a-z]+$/.test(first) || NOT_NAMES.has(first.toLowerCase())) continue
    const personalPot = /^(s\s+)?(pensions?|savings|isas?|sipp|cash|lisa|workplace|investments?|accounts?)\b/i.test(rest.join(' '))
    score.set(first, (score.get(first) ?? 0) + (personalPot ? 2 : 1))
  }
  return [...score.entries()].filter(([, n]) => n >= 2).map(([name]) => name).slice(0, 2)
}

export function guessOwner(label: string, names: string[], couple: boolean): Owner {
  const s = label.toLowerCase()
  for (let i = 0; i < names.length && i < 2; i++) if (names[i] && s.includes(names[i].toLowerCase())) return i as 0 | 1
  return couple ? 'split' : 0
}

/** Pots a row can go into. Without the extra pots there is no GIA or Lifetime ISA. */
export function availableTargets(extraPots: boolean): Target[] {
  return extraPots ? ['pension', 'isa', 'gia', 'cash', 'lisa', 'debt', 'ignore'] : ['pension', 'isa', 'cash', 'debt', 'ignore']
}

/** Re-home a GIA/LISA choice when those pots are switched off: shares → ISA, crypto → left out. */
export function fitTarget(target: Target, label: string, extraPots: boolean): Target {
  if (extraPots) return target
  if (target === 'lisa') return 'isa'
  if (target === 'gia') return /crypto|bitcoin|\bbtc\b|\beth\b/i.test(label) ? 'ignore' : 'isa'
  return target
}

/** Default mapping for each row, keeping any choices the user already made. */
export function buildMapping(rows: SheetRow[], names: string[], couple: boolean, saved: Record<string, Mapping> = {}, extraPots = true) {
  const out: Record<string, Mapping> = {}
  for (const r of rows) {
    const m = saved[r.label] ?? { target: classify(r.label, r.category), owner: guessOwner(r.label, names, couple) }
    out[r.label] = { ...m, target: fitTarget(m.target, r.label, extraPots) }
  }
  return out
}

export interface ApplyResult {
  pots: [Pots, Pots]
  debt: number
  included: number
}

/** Sum the mapped rows into each person's pots. Debts are returned separately (positive £). */
export function summarise(rows: SheetRow[], mapping: Record<string, Mapping>, couple: boolean): ApplyResult {
  const zero = (): Pots => ({ pension: 0, isa: 0, gia: 0, cash: 0, lisa: 0 })
  const pots: [Pots, Pots] = [zero(), zero()]
  let debt = 0
  let included = 0
  for (const r of rows) {
    const m = mapping[r.label]
    if (!m || m.target === 'ignore') continue
    if (m.target === 'debt') {
      debt += Math.abs(r.amount)
      continue
    }
    const amt = Math.max(0, r.amount)
    if (amt <= 0) continue
    included += amt
    const owner: Owner = couple ? m.owner : 0
    if (owner === 'split') {
      pots[0][m.target] += amt / 2
      pots[1][m.target] += amt / 2
    } else pots[owner][m.target] += amt
  }
  return { pots, debt, included }
}

const DEBT_EVENT_ID = 'sheet-debts'

/** Write imported balances into a plan (and optionally the people's names). */
export function applyToPlan(plan: Plan, result: ApplyResult, names: string[] | null) {
  plan.people[0].pots = { ...result.pots[0] }
  if (plan.couple) plan.people[1].pots = { ...result.pots[1] }
  if (names) names.forEach((n, i) => n && (plan.people[i].name = n))
  plan.events = plan.events.filter((e) => e.id !== DEBT_EVENT_ID)
  if (result.debt > 0) {
    plan.events.unshift({
      id: DEBT_EVENT_ID,
      label: 'Pay off debts (from sheet)',
      age: plan.people[0].age,
      amount: -Math.round(result.debt),
      every: 0,
      untilAge: plan.people[0].age,
    })
  }
}

/** Minimal CSV parser (quotes, commas inside quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
