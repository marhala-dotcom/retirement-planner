// Read-only Google Sheets access straight from the browser (Google Identity Services
// token flow). The access token lives only in memory; nothing goes via any server.

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
export function loadGoogle(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisPromise = null
      reject(new Error("Couldn't load Google sign-in. Check your connection or ad blocker."))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

let token: { value: string; expires: number } | null = null
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null
let client: TokenClient | null = null

/** Must be called from a click handler (opens Google's popup). Call loadGoogle() first. */
export function getAccessToken(): Promise<string> {
  if (token && Date.now() < token.expires - 60_000) return Promise.resolve(token.value)
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('Google sign-in is not configured for this copy of the app.'))
  const g = window.google
  if (!g) return Promise.reject(new Error('Google sign-in is still loading — try again in a moment.'))
  client ??= g.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      if (r.access_token) {
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 }
        pending?.resolve(r.access_token)
      } else pending?.reject(new Error(r.error_description || r.error || 'Google sign-in failed.'))
      pending = null
    },
    error_callback: (e) => {
      pending?.reject(new Error(e.type === 'popup_closed' ? 'Sign-in window was closed.' : e.message || 'Google sign-in failed.'))
      pending = null
    },
  })
  return new Promise((resolve, reject) => {
    pending = { resolve, reject }
    client!.requestAccessToken({ prompt: '' })
  })
}

export function signOutGoogle() {
  token = null
}

async function api<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 401) token = null
  if (!res.ok) {
    let msg = `Google Sheets returned ${res.status}`
    try {
      const body = await res.json()
      msg = body?.error?.message ?? msg
    } catch {
      /* ignore */
    }
    if (res.status === 403) msg += ' — check the Google account you signed in with can open this sheet.'
    if (res.status === 404) msg = "That spreadsheet wasn't found. Check the link."
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export interface SheetMeta {
  title: string
  tabs: { id: number; title: string }[]
}

export async function fetchMeta(spreadsheetId: string, accessToken: string): Promise<SheetMeta> {
  const d = await api<{ properties: { title: string }; sheets: { properties: { sheetId: number; title: string } }[] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    accessToken,
  )
  return { title: d.properties.title, tabs: d.sheets.map((s) => ({ id: s.properties.sheetId, title: s.properties.title })) }
}

export async function fetchGrid(spreadsheetId: string, tabTitle: string, accessToken: string): Promise<unknown[][]> {
  const range = encodeURIComponent(`'${tabTitle.replace(/'/g, "''")}'!A1:Z300`)
  const d = await api<{ values?: unknown[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    accessToken,
  )
  return d.values ?? []
}
