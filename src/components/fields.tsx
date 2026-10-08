import { ChevronDown, Info } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More information"
        className="text-muted hover:text-ink-2 inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-5 z-50 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-xs leading-relaxed text-ink-2 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}

interface NumberFieldProps {
  label: ReactNode
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  sliderMin?: number
  sliderMax?: number
  sliderStep?: number
  prefix?: string
  suffix?: string
  help?: string
  slider?: boolean
  /** Display transform, e.g. fraction → percent. */
  scale?: number
  decimals?: number
  width?: string
  marks?: { value: number; label: string }[]
}

const fmtNum = (v: number, decimals: number) =>
  decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-GB')

export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  sliderMin,
  sliderMax,
  sliderStep,
  prefix,
  suffix,
  help,
  slider = true,
  scale = 1,
  decimals = 0,
  width = 'w-28',
  marks,
}: NumberFieldProps) {
  const id = useId()
  const shown = value * scale
  const [draft, setText] = useState(fmtNum(shown, decimals))
  const [focused, setFocused] = useState(false)
  const text = focused ? draft : fmtNum(shown, decimals)

  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(/[£,%\s]/g, ''))
    if (Number.isFinite(n)) {
      const v = Math.min(max, Math.max(min, n / scale))
      onChange(v)
      setText(fmtNum(v * scale, decimals))
    } else setText(fmtNum(shown, decimals))
  }

  const sMin = sliderMin ?? (Number.isFinite(min) ? min : 0)
  const sMax = sliderMax ?? (Number.isFinite(max) ? max : 100)
  const sStep = sliderStep ?? step
  const clamped = Math.min(sMax, Math.max(sMin, value))
  const p = sMax > sMin ? ((clamped - sMin) / (sMax - sMin)) * 100 : 0

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] text-ink-2">
          {label}
          {help && <InfoTip text={help} />}
        </label>
        <div className="flex items-center gap-1 text-[13px]">
          {prefix && <span className="text-muted">{prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            className={`num-input ${width}`}
            value={text}
            onFocus={(e) => {
              setText(fmtNum(shown, decimals))
              setFocused(true)
              const el = e.currentTarget
              requestAnimationFrame(() => el.select())
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              setFocused(false)
              commit(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
          {suffix && <span className="w-6 text-muted">{suffix}</span>}
        </div>
      </div>
      {slider && (
        <div className="relative mt-1">
          <input
            type="range"
            className="slider"
            aria-label={typeof label === 'string' ? label : undefined}
            min={sMin}
            max={sMax}
            step={sStep}
            value={clamped}
            style={{ ['--pct' as string]: `${p}%` }}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          {marks && (
            <div className="relative h-4 text-[10px] text-muted">
              {marks.map((m) => {
                const mp = ((m.value - sMin) / (sMax - sMin)) * 100
                if (mp < 0 || mp > 100) return null
                return (
                  <button
                    type="button"
                    key={m.label}
                    onClick={() => onChange(m.value)}
                    className="absolute -translate-x-1/2 whitespace-nowrap hover:text-ink"
                    style={{ left: `calc(${mp}% + ${10 - mp * 0.2}px)` }}
                    title={`Set to ${m.label}`}
                  >
                    <span className="mx-auto mb-0.5 block h-1.5 w-px bg-current" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function MoneyField(props: Omit<NumberFieldProps, 'prefix'>) {
  return <NumberField prefix="£" step={1000} min={0} {...props} />
}

export function PercentField(props: Omit<NumberFieldProps, 'suffix' | 'scale'>) {
  return <NumberField suffix="%" scale={100} decimals={props.decimals ?? 1} width="w-16" {...props} />
}

export function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  help?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {label}
        {help && <InfoTip text={help} />}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-3'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  help,
  size = 'md',
}: {
  options: { value: T; label: string; title?: string }[]
  value: T
  onChange: (v: T) => void
  label?: ReactNode
  help?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="py-1.5">
      {label && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] text-ink-2">
          {label}
          {help && <InfoTip text={help} />}
        </div>
      )}
      <div role="radiogroup" className="flex rounded-lg bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 font-medium transition-colors ${size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-[13px]'} ${
              value === o.value ? 'bg-control text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  aside?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-line">
      <button
        className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left hover:bg-surface-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-accent">{icon}</span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {aside && <span className="text-xs text-muted">{aside}</span>}
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </section>
  )
}
