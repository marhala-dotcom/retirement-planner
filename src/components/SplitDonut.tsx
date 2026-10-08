import type { WrapperKey } from '../engine/types'
import { WRAPPER_META } from '../lib/colors'
import { compact } from '../lib/format'

/** Household pot split by wrapper. 2px surface gaps between segments. */
export function SplitDonut({ data, total, size = 92 }: { data: { key: WrapperKey; value: number }[]; total: number; size?: number }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const gap = 2
  let offset = 0
  const segs = data.filter((d) => d.value > 0)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Total ${compact(total)}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={12} />
      {total > 0 &&
        segs.map((d) => {
          const len = (d.value / total) * c
          const dash = Math.max(0, len - (segs.length > 1 ? gap : 0))
          const el = (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={WRAPPER_META[d.key].color}
              strokeWidth={12}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>
                {WRAPPER_META[d.key].short}: {compact(d.value)}
              </title>
            </circle>
          )
          offset += len
          return el
        })}
      <text x="50%" y="47%" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink)">
        {compact(total)}
      </text>
      <text x="50%" y="63%" textAnchor="middle" fontSize="10" fill="var(--muted)">
        today
      </text>
    </svg>
  )
}
