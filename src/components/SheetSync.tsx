import { AlertTriangle, FileSpreadsheet, Link2, Loader2, RefreshCw, ShieldCheck, Unlink, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WRAPPERS, type Plan } from '../engine/types'
import { WRAPPER_META } from '../lib/colors'
import { compact, money } from '../lib/format'
import { GOOGLE_CLIENT_ID, fetchGrid, fetchMeta, getAccessToken, loadGoogle, signOutGoogle, type SheetMeta } from '../lib/google'
import {
  TARGET_LABELS,
  buildMapping,
  detectNames,
  gridToRows,
  parseCsv,
  parseSheetUrl,
  summarise,
  type ApplyResult,
  type Mapping,
  type Owner,
  type SheetRow,
  type Target,
} from '../lib/sheetImport'
import { Modal } from './Modal'

/** What we remember about the linked sheet (this browser only). Never the numbers' history. */
interface SheetLink {
  url: string
  id: string
  tab: string
  docTitle: string
  mapping: Record<string, Mapping>
  names: string[]
  renamePeople: boolean
  lastSync: string | null
  source: 'google' | 'csv'
}

const KEY = 'horizon-sheet.v1'
function loadLink(): SheetLink | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
function saveLink(l: SheetLink | null) {
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

function ago(iso: string | null) {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SheetSync({ plan, onApply }: { plan: Plan; onApply: (r: ApplyResult, names: string[] | null) => void }) {
  const [link, setLink] = useState<SheetLink | null>(loadLink)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (link?.source === 'google' && GOOGLE_CLIENT_ID) loadGoogle().catch(() => {})
  }, [link?.source])

  const update = (l: SheetLink | null) => {
    setLink(l)
    saveLink(l)
  }

  /** Re-read the sheet and apply with the saved matching. Opens review if there are new rows. */
  const refresh = () => {
    if (!link || link.source !== 'google') return setOpen(true)
    setBusy(true)
    setMsg(null)
    getAccessToken()
      .then(async (t) => {
        const grid = await fetchGrid(link.id, link.tab, t)
        const rows = gridToRows(grid)
        const newRows = rows.filter((r) => !link.mapping[r.label])
        if (newRows.length) {
          setMsg({ tone: 'err', text: `${newRows.length} new row${newRows.length > 1 ? 's' : ''} in your sheet — check how they're matched.` })
          setOpen(true)
          return
        }
        const result = summarise(rows, link.mapping, plan.couple)
        onApply(result, link.renamePeople ? link.names : null)
        update({ ...link, lastSync: new Date().toISOString() })
        setMsg({ tone: 'ok', text: `Updated: ${money(result.included)} across your pots.` })
      })
      .catch((e: Error) => setMsg({ tone: 'err', text: e.message }))
      .finally(() => setBusy(false))
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3">
      {link ? (
        <>
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-good" />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="truncate font-medium">
                {link.docTitle} › {link.tab}
              </div>
              <div className="text-xs text-muted">Synced {ago(link.lastSync)} · balances below come from this sheet</div>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {link.source === 'google' && (
              <button
                onClick={refresh}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh from sheet
              </button>
            )}
            <button onClick={() => setOpen(true)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-3">
              {link.source === 'google' ? 'Review matching' : 'Import again'}
            </button>
            <button
              onClick={() => {
                update(null)
                signOutGoogle()
                setMsg(null)
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:text-bad"
              title="Stop syncing. Your current balances stay as they are."
            >
              <Unlink size={12} /> Unlink
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="shrink-0 text-accent" />
          <div className="flex-1 text-[13px] leading-snug">
            <div className="font-medium">Keep your balances in a spreadsheet?</div>
            <div className="text-xs text-muted">Pull them in from Google Sheets (or a CSV) instead of typing.</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Link2 size={13} /> Connect
          </button>
        </div>
      )}
      {msg && (
        <p className={`mt-2 flex items-start gap-1.5 text-xs ${msg.tone === 'ok' ? 'text-good' : 'text-bad'}`}>
          {msg.tone === 'err' && <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          {msg.text}
        </p>
      )}
      {open && (
        <SheetModal
          plan={plan}
          link={link}
          onClose={() => setOpen(false)}
          onDone={(l, result) => {
            onApply(result, l.renamePeople ? l.names : null)
            update({ ...l, lastSync: new Date().toISOString() })
            setMsg({ tone: 'ok', text: `Imported ${money(result.included)} across your pots.` })
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SheetModal({
  plan,
  link,
  onClose,
  onDone,
}: {
  plan: Plan
  link: SheetLink | null
  onClose: () => void
  onDone: (l: SheetLink, r: ApplyResult) => void
}) {
  const [url, setUrl] = useState(link?.source === 'google' ? link.url : '')
  const [step, setStep] = useState<'connect' | 'review'>('connect')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [meta, setMeta] = useState<SheetMeta | null>(null)
  const [tab, setTab] = useState(link?.tab ?? '')
  const [rows, setRows] = useState<SheetRow[]>([])
  const [mapping, setMapping] = useState<Record<string, Mapping>>({})
  const [names, setNames] = useState<string[]>(link?.names ?? [])
  const [rename, setRename] = useState(link?.renamePeople ?? true)
  const [source, setSource] = useState<'google' | 'csv'>(link?.source ?? 'google')
  const [csvName, setCsvName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const configured = Boolean(GOOGLE_CLIENT_ID)

  useEffect(() => {
    if (configured) loadGoogle().catch((e: Error) => setErr(e.message))
  }, [configured])

  const ingest = (grid: unknown[][]) => {
    const r = gridToRows(grid)
    if (!r.length) throw new Error("Couldn't find a column of amounts. Make sure the tab has a name column and an 'Amount' or 'Value' column.")
    const detected = detectNames(r)
    const useNames = detected.length ? detected : names
    setRows(r)
    setNames(useNames)
    setMapping(buildMapping(r, useNames, plan.couple, link?.mapping))
    setStep('review')
  }

  const connect = (tabOverride?: string) => {
    const parsed = parseSheetUrl(url)
    if (!parsed) return setErr("That doesn't look like a Google Sheets link. Copy it from your browser's address bar.")
    setErr(null)
    setBusy(true)
    getAccessToken()
      .then(async (t) => {
        const m = meta ?? (await fetchMeta(parsed.id, t))
        setMeta(m)
        const chosen =
          tabOverride ??
          m.tabs.find((x) => x.id === parsed.gid)?.title ??
          (link?.tab && m.tabs.some((x) => x.title === link.tab) ? link.tab : m.tabs[0].title)
        setTab(chosen)
        ingest(await fetchGrid(parsed.id, chosen, t))
        setSource('google')
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false))
  }

  const onCsv = async (f: File) => {
    try {
      setErr(null)
      setCsvName(f.name)
      setSource('csv')
      ingest(parseCsv(await f.text()))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const result = summarise(rows, mapping, plan.couple)
  const people = plan.couple ? [0, 1] : [0]
  const personName = (i: number) => (rename && names[i]) || plan.people[i].name || (i ? 'Partner' : 'You')
  const setRow = (label: string, patch: Partial<Mapping>) => setMapping((m) => ({ ...m, [label]: { ...m[label], ...patch } }))

  const finish = () => {
    const parsed = parseSheetUrl(url)
    onDone(
      {
        url,
        id: parsed?.id ?? '',
        tab: source === 'csv' ? csvName : tab,
        docTitle: source === 'csv' ? 'CSV file' : (meta?.title ?? 'Google Sheet'),
        mapping,
        names,
        renamePeople: rename && names.length > 0,
        lastSync: null, // stamped by the caller
        source,
      },
      result,
    )
  }

  return (
    <Modal title={step === 'connect' ? 'Connect your spreadsheet' : 'Check how your sheet is matched'} onClose={onClose} wide={step === 'review'}>
      {step === 'connect' ? (
        <div className="space-y-4 text-[13px]">
          <p className="text-ink-2">
            Paste the link to your Google Sheet (open the tab with your balances first, so the link points to it). Horizon reads it
            straight from Google into this browser. It's read-only, and nothing is stored anywhere except on this device.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="num-input min-w-0 flex-1 !text-left"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Google Sheets link"
            />
            <button
              onClick={() => connect()}
              disabled={busy || !configured || !url}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <GoogleG />} Sign in with Google & read
            </button>
          </div>
          {!configured && (
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-warn">
              Google sign-in isn't set up for this copy of the app yet. You can still import a CSV below.
            </p>
          )}
          {err && (
            <p className="flex items-start gap-1.5 text-xs text-bad">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {err}
            </p>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-good" />
            <span>
              Google will ask you to allow read-only access to your spreadsheets. Horizon only opens the sheet you link, keeps the
              access token in memory for an hour at most, and has no server. Remove access any time at myaccount.google.com →
              Security → Third-party connections.
            </span>
          </div>
          <div className="border-t border-line pt-3 text-xs text-muted">
            Prefer not to sign in?{' '}
            <button className="inline-flex items-center gap-1 font-medium text-accent-ink underline" onClick={() => fileRef.current?.click()}>
              <Upload size={12} /> Import a CSV
            </button>{' '}
            (in Sheets: File → Download → Comma-separated values, with your balances tab open).
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onCsv(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-[13px]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-medium">
              <FileSpreadsheet size={16} className="text-good" />
              {source === 'csv' ? csvName : meta?.title}
            </div>
            {source === 'google' && meta && (
              <select
                value={tab}
                onChange={(e) => connect(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px]"
                aria-label="Tab"
              >
                {meta.tabs.map((t) => (
                  <option key={t.id} value={t.title}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
            {busy && <Loader2 size={15} className="animate-spin text-muted" />}
          </div>

          <p className="text-ink-2">
            Check where each row should go. Rows like totals and your house are left out, because Horizon plans with money you can
            invest and spend. Debts are paid off from savings straight away. Your choices are remembered for next time.
          </p>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Row in your sheet</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Goes into</th>
                  {plan.couple && <th className="px-3 py-2 font-medium">Whose</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = mapping[r.label]
                  const off = m.target === 'ignore'
                  return (
                    <tr key={r.label} className={`border-t border-line ${off ? 'text-muted' : ''}`}>
                      <td className="px-3 py-1.5">
                        {r.label}
                        {r.category && <span className="ml-1.5 text-xs text-muted">· {r.category}</span>}
                      </td>
                      <td className="tnum px-3 py-1.5 text-right">{money(r.amount)}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={m.target}
                          onChange={(e) => setRow(r.label, { target: e.target.value as Target })}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1"
                          aria-label={`Where ${r.label} goes`}
                        >
                          {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
                            <option key={t} value={t}>
                              {TARGET_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      {plan.couple && (
                        <td className="px-3 py-1.5">
                          <select
                            value={String(m.owner)}
                            disabled={off || m.target === 'debt'}
                            onChange={(e) => setRow(r.label, { owner: (e.target.value === 'split' ? 'split' : Number(e.target.value)) as Owner })}
                            className="w-full rounded-md border border-line bg-surface px-2 py-1 disabled:opacity-40"
                            aria-label={`Whose ${r.label} is`}
                          >
                            <option value="0">{personName(0)}</option>
                            <option value="1">{personName(1)}</option>
                            <option value="split">Joint (50/50)</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {names.length > 0 && plan.couple && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} />
              Call you <strong>{names[0]}</strong>
              {names[1] && (
                <>
                  {' '}
                  and <strong>{names[1]}</strong>
                </>
              )}{' '}
              in the plan
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {people.map((i) => (
              <div key={i} className="rounded-xl bg-surface-2 p-3">
                <div className="mb-1.5 font-semibold">{personName(i)}</div>
                {WRAPPERS.map((w) => (
                  <div key={w} className="flex justify-between py-0.5 text-xs">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: WRAPPER_META[w].color }} />
                      {WRAPPER_META[w].short}
                    </span>
                    <span className="tnum font-medium">{compact(result.pots[i][w])}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-xs text-ink-2">
              Total going into your plan: <strong className="text-ink">{money(result.included)}</strong>
              {result.debt > 0 && <> · debts to pay off: {money(result.debt)}</>}
              <div className="text-muted">Replaces today's balances in all your scenarios.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('connect')} className="rounded-lg border border-line px-3 py-2 hover:bg-surface-2">
                Back
              </button>
              <button onClick={finish} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90">
                Use these balances
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function GoogleG() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}
