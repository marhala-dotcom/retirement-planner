import { BookOpen, Columns3, Copy, Download, Monitor, Moon, MoreHorizontal, Pencil, RotateCcw, Sun, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Scenario } from '../hooks/usePlans'

export type Theme = 'system' | 'light' | 'dark'

interface Props {
  scenarios: Scenario[]
  activeId: string
  onSelect: (id: string) => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onReset: () => void
  onExport: () => void
  onImport: (file: File) => void
  onCompare: () => void
  onMethod: () => void
  real: boolean
  setReal: (r: boolean) => void
  theme: Theme
  setTheme: (t: Theme) => void
}

export function TopBar(p: Props) {
  const [menu, setMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])
  const active = p.scenarios.find((s) => s.id === p.activeId)
  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const ThemeIcon = p.theme === 'light' ? Sun : p.theme === 'dark' ? Moon : Monitor

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Horizon</div>
            <div className="hidden text-[11px] text-muted sm:block">UK retirement planner · rules 2026/27</div>
          </div>
        </div>

        <div className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 sm:ml-6">
          <label className="sr-only" htmlFor="scenario">
            Scenario
          </label>
          <select
            id="scenario"
            value={p.activeId}
            onChange={(e) => p.onSelect(e.target.value)}
            className="w-full max-w-64 min-w-24 truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium"
          >
            {p.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <IconBtn label="Save a copy as a new scenario" onClick={p.onDuplicate}>
            <Copy size={16} />
          </IconBtn>
          <IconBtn label="Compare scenarios" onClick={p.onCompare} className="hidden sm:inline-flex">
            <Columns3 size={16} />
          </IconBtn>
        </div>

        <div className="hidden items-center rounded-lg bg-surface-2 p-0.5 text-xs font-medium md:flex" role="radiogroup" aria-label="Money shown in">
          <button
            role="radio"
            aria-checked={p.real}
            onClick={() => p.setReal(true)}
            className={`rounded-md px-2.5 py-1.5 ${p.real ? 'bg-control shadow-sm' : 'text-ink-2'}`}
            title="Adjusted for inflation — what money will feel like"
          >
            Today's £
          </button>
          <button
            role="radio"
            aria-checked={!p.real}
            onClick={() => p.setReal(false)}
            className={`rounded-md px-2.5 py-1.5 ${!p.real ? 'bg-control shadow-sm' : 'text-ink-2'}`}
            title="The actual pounds in your account in future years"
          >
            Future £
          </button>
        </div>

        <IconBtn label={`Theme: ${p.theme}`} onClick={() => p.setTheme(nextTheme[p.theme])} className="hidden sm:inline-flex">
          <ThemeIcon size={16} />
        </IconBtn>
        <IconBtn label="How it works" onClick={p.onMethod} className="hidden sm:inline-flex">
          <BookOpen size={16} />
        </IconBtn>

        <div className="relative" ref={menuRef}>
          <IconBtn label="More" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal size={16} />
          </IconBtn>
          {menu && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 text-[13px] shadow-xl">
              <MenuItem
                icon={<Pencil size={14} />}
                onClick={() => {
                  const n = prompt('Scenario name', active?.name)
                  if (n?.trim()) p.onRename(n.trim().slice(0, 40))
                  setMenu(false)
                }}
              >
                Rename scenario
              </MenuItem>
              <MenuItem icon={<Columns3 size={14} />} onClick={() => (setMenu(false), p.onCompare())}>
                Compare scenarios
              </MenuItem>
              <div className="md:hidden">
                <MenuItem icon={<Sun size={14} />} onClick={() => (setMenu(false), p.setReal(!p.real))}>
                  Show {p.real ? 'future £' : "today's £"}
                </MenuItem>
              </div>
              <div className="sm:hidden">
                <MenuItem icon={<ThemeIcon size={14} />} onClick={() => p.setTheme(nextTheme[p.theme])}>
                  Theme: {p.theme}
                </MenuItem>
                <MenuItem icon={<BookOpen size={14} />} onClick={() => (setMenu(false), p.onMethod())}>
                  How it works
                </MenuItem>
              </div>
              <div className="my-1 border-t border-line" />
              <MenuItem icon={<Download size={14} />} onClick={() => (setMenu(false), p.onExport())}>
                Export plans (JSON)
              </MenuItem>
              <MenuItem icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
                Import plans
              </MenuItem>
              <div className="my-1 border-t border-line" />
              <MenuItem
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  if (confirm('Reset this scenario to the example plan?')) p.onReset()
                  setMenu(false)
                }}
              >
                Reset to example
              </MenuItem>
              <MenuItem
                icon={<Trash2 size={14} />}
                danger
                onClick={() => {
                  if (confirm(`Delete "${active?.name}"?`)) p.onDelete()
                  setMenu(false)
                }}
              >
                Delete scenario
              </MenuItem>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) p.onImport(f)
              e.target.value = ''
              setMenu(false)
            }}
          />
        </div>
      </div>
    </header>
  )
}

function IconBtn({ label, onClick, children, className = '' }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${className.includes('hidden') ? '' : 'inline-flex'} h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {children}
    </button>
  )
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 ${danger ? 'text-bad' : ''}`}>
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  )
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M6 21.5h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M9 21.5a7 7 0 0 1 14 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 9.5v2.5M8.6 12.6l1.7 1.7M23.4 12.6l-1.7 1.7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
