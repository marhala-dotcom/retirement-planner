import { describe, expect, it } from 'vitest'
import { defaultPlan } from '../engine/defaults'
import {
  applyToPlan,
  availableTargets,
  buildMapping,
  fitTarget,
  classify,
  detectNames,
  gridToRows,
  parseCsv,
  parseSheetUrl,
  summarise,
  toNumber,
} from './sheetImport'

// A made-up "net worth" tab in a typical household layout (fake names and numbers).
const GRID: unknown[][] = [
  ['Asset', 'Amount', 'Total Equity %', 'Non-House Equity %', 'Categgory'],
  ['Alex Pensions', 120000, 0.2, 0.4, 'Investments'],
  ['Sam Pensions', 90000, 0.15, 0.3, 'Investments'],
  ['Stocks', 50000, 0.1, 0.2, 'Investments'],
  ['Crypto', 0, 0, 0, 'Investments'],
  ['Alex Savings', 4000, 0.01, 0.01, 'Cash'],
  ['Sam Savings', 6000, 0.01, 0.02, 'Cash'],
  ['Overseas Savings', 2000, 0, 0, 'Cash'],
  ['Liabilities', -3000, 0, 0, 'Cash'],
  ['', 269000, 0.47, 1],
  [],
  ['House Equity', 400000, 0, 0],
  ['House Loan', -100000],
  ['Actual Equity', 300000, 0.53, 0, 'Assets'],
  [],
  ['Net Worth', 569000, 1],
]

describe('sheet import', () => {
  it('parses Google Sheets links with a tab id', () => {
    expect(parseSheetUrl('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789/edit?gid=42#gid=42')).toEqual({
      id: '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789',
      gid: 42,
    })
    expect(parseSheetUrl('not a link')).toBeNull()
  })

  it('reads accounting-formatted numbers', () => {
    expect(toNumber('£ 105,572')).toBe(105572)
    expect(toNumber('(7,575)')).toBe(-7575)
    expect(toNumber('£ -')).toBe(0)
    expect(toNumber('Investments')).toBeNull()
  })

  it('finds the header, skips blank-label totals', () => {
    const rows = gridToRows(GRID)
    expect(rows.map((r) => r.label)).toEqual([
      'Alex Pensions',
      'Sam Pensions',
      'Stocks',
      'Crypto',
      'Alex Savings',
      'Sam Savings',
      'Overseas Savings',
      'Liabilities',
      'House Equity',
      'House Loan',
      'Actual Equity',
      'Net Worth',
    ])
    expect(rows[0].category).toBe('Investments')
  })

  it('classifies rows into pots and leaves out the house and totals', () => {
    expect(classify('Alex Pensions')).toBe('pension')
    expect(classify('Stocks')).toBe('gia')
    expect(classify('Vanguard S&S ISA')).toBe('isa')
    expect(classify('Cash ISA')).toBe('cash')
    expect(classify('Lifetime ISA')).toBe('lisa')
    expect(classify('Sam Savings')).toBe('cash')
    expect(classify('Liabilities')).toBe('debt')
    expect(classify('House Equity')).toBe('ignore')
    expect(classify('House Loan')).toBe('ignore')
    expect(classify('Net Worth')).toBe('ignore')
    expect(classify('Actual Equity')).toBe('ignore')
  })

  it('detects the two people from repeated name prefixes', () => {
    expect(detectNames(gridToRows(GRID))).toEqual(['Alex', 'Sam'])
  })

  it('sums into each person, splits unowned rows 50/50 and turns debts into a one-off', () => {
    const rows = gridToRows(GRID)
    const names = detectNames(rows)
    const mapping = buildMapping(rows, names, true)
    const r = summarise(rows, mapping, true)
    expect(r.pots[0].pension).toBe(120000)
    expect(r.pots[1].pension).toBe(90000)
    expect(r.pots[0].gia).toBe(25000)
    expect(r.pots[1].gia).toBe(25000)
    expect(r.pots[0].cash).toBe(4000 + 1000)
    expect(r.pots[1].cash).toBe(6000 + 1000)
    expect(r.debt).toBe(3000)
    expect(r.included).toBe(120000 + 90000 + 50000 + 4000 + 6000 + 2000)

    const plan = defaultPlan()
    applyToPlan(plan, r, names)
    expect(plan.people[0].name).toBe('Alex')
    expect(plan.people[1].pots.pension).toBe(90000)
    expect(plan.events.find((e) => e.id === 'sheet-debts')?.amount).toBe(-3000)
    // Re-applying replaces, not duplicates, the debt event.
    applyToPlan(plan, r, names)
    expect(plan.events.filter((e) => e.id === 'sheet-debts')).toHaveLength(1)
  })

  it('keeps saved choices for known rows', () => {
    const rows = gridToRows(GRID)
    const mapping = buildMapping(rows, ['Alex', 'Sam'], true, { Stocks: { target: 'isa', owner: 0 } })
    expect(mapping.Stocks).toEqual({ target: 'isa', owner: 0 })
  })

  it('parses CSV exports with quoted, formatted numbers', () => {
    const csv = 'Asset,Amount,Categgory\r\nAlex Pensions,"£ 120,000",Investments\r\nLiabilities,"(3,000)",Cash\r\n'
    const rows = gridToRows(parseCsv(csv))
    expect(rows).toEqual([
      { label: 'Alex Pensions', amount: 120000, category: 'Investments' },
      { label: 'Liabilities', amount: -3000, category: 'Cash' },
    ])
  })
})

describe('without GIA and Lifetime ISA', () => {
  it('re-homes shares to the ISA and leaves crypto out', () => {
    const rows = gridToRows(GRID)
    const mapping = buildMapping(rows, ['Alex', 'Sam'], true, { Crypto: { target: 'gia', owner: 'split' } }, false)
    expect(mapping.Stocks.target).toBe('isa')
    expect(mapping.Crypto.target).toBe('ignore')
    expect(fitTarget('lisa', 'Lifetime ISA', false)).toBe('isa')
    expect(fitTarget('gia', 'Stocks', true)).toBe('gia')
    expect(availableTargets(false)).not.toContain('gia')
    expect(availableTargets(false)).not.toContain('lisa')
  })
})

describe('owner detection', () => {
  it('recognises a person who appears on just one personal-pot row', () => {
    const rows = gridToRows([
      ['Asset', 'Amount'],
      ['Alex Pensions', 1],
      ['Alex Savings', 1],
      ['Sam Pensions', 1],
      ['Stocks', 1],
      ['UAE Savings', 1],
      ['House Equity', 1],
    ])
    expect(detectNames(rows)).toEqual(['Alex', 'Sam'])
  })
})
