const gb = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

/** £12,345 */
export function money(x: number): string {
  const v = Math.round(x)
  return (v < 0 ? '−£' : '£') + gb.format(Math.abs(v))
}

/** £430k / £1.2m — for axes and tight spaces. */
export function compact(x: number): string {
  const a = Math.abs(x)
  const s = x < 0 ? '−£' : '£'
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'm'
  if (a >= 1e4) return s + Math.round(a / 1e3) + 'k'
  if (a >= 1e3) return s + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return s + Math.round(a)
}

export function pct(x: number, digits = 0): string {
  return (x * 100).toFixed(digits) + '%'
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
