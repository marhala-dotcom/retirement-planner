// The linked spreadsheet (this browser only), shared by the savings and mortgage sections.
import { useSyncExternalStore } from 'react'
import { fetchGrid } from './google'
import { toNumber, type Mapping } from './sheetImport'

export interface SheetLink {
  url: string
  id: string
  tab: string
  docTitle: string
  mapping: Record<string, Mapping>
  names: string[]
  renamePeople: boolean
  lastSync: string | null
  source: 'google' | 'csv'
  /** Single cells to pull on refresh, e.g. { mortgage: "Mortgage!B21" }. */
  cells?: { mortgage?: string; otherLoan?: string }
}

const KEY = 'horizon-sheet.v1'
const listeners = new Set<() => void>()
let cache: SheetLink | null | undefined

function read(): SheetLink | null {
  if (cache !== undefined) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    cache = null
  }
  return cache ?? null
}

export function getSheetLink() {
  return read()
}

export function setSheetLink(l: SheetLink | null) {
  cache = l
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f())
}

export function useSheetLink(): SheetLink | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    read,
  )
}

/** "Mortgage!B21", "'Net Worth'!C5" → { tab, cell }. */
export function parseCellRef(ref: string): { tab: string; cell: string } | null {
  const m = ref.trim().match(/^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Za-z]{1,3})\$?(\d{1,6})$/)
  if (!m) return null
  return { tab: (m[1] ?? m[2]).replace(/''/g, "'").trim(), cell: `${m[3].toUpperCase()}${m[4]}` }
}

/** Read one numeric cell from the linked Google Sheet. */
export async function fetchCellNumber(spreadsheetId: string, ref: string, token: string): Promise<number> {
  const p = parseCellRef(ref)
  if (!p) throw new Error(`"${ref}" isn't a cell reference. Use the form Mortgage!B21.`)
  const grid = await fetchGrid(spreadsheetId, p.tab, token, p.cell)
  const n = toNumber(grid[0]?.[0])
  if (n == null) throw new Error(`Cell ${p.tab}!${p.cell} doesn't contain a number.`)
  return n
}
