// Series colours are CSS variables (light/dark steps live in index.css).
// Order is fixed and validated for colour-vision deficiency; never cycle it.
import type { WrapperKey } from '../engine/types'

export const WRAPPER_META: Record<WrapperKey, { label: string; short: string; color: string; help: string }> = {
  pension: { label: 'Pension (SIPP / workplace)', short: 'Pension', color: 'var(--s-pension)', help: 'Defined-contribution pensions. Locked until 55 (57 from April 2028). 25% tax-free, rest taxed as income.' },
  isa: { label: 'Stocks & Shares ISA', short: 'ISA', color: 'var(--s-isa)', help: 'Tax-free growth and withdrawals, accessible any time. £20,000 a year allowance each.' },
  gia: { label: 'General investment account', short: 'GIA', color: 'var(--s-gia)', help: 'Taxable investments: dividends and interest taxed yearly, capital gains above £3,000 when sold.' },
  cash: { label: 'Cash savings', short: 'Cash', color: 'var(--s-cash)', help: 'Easy-access savings, premium bonds, cash ISAs. Interest above your savings allowance is taxed.' },
  lisa: { label: 'Lifetime ISA', short: 'LISA', color: 'var(--s-lisa)', help: 'Pay in up to £4,000 a year until 50 and get a 25% bonus. Free to withdraw from 60.' },
}

export const INCOME_META = {
  other: { label: 'DB pension & work', color: 'var(--s-other)' },
  statePension: { label: 'State Pension', color: 'var(--s-sp)' },
  pension: { label: 'Pension', color: 'var(--s-pension)' },
  isa: { label: 'ISA', color: 'var(--s-isa)' },
  gia: { label: 'GIA', color: 'var(--s-gia)' },
  cash: { label: 'Cash', color: 'var(--s-cash)' },
  lisa: { label: 'LISA', color: 'var(--s-lisa)' },
} as const

export const INCOME_ORDER = ['other', 'statePension', 'pension', 'isa', 'gia', 'cash', 'lisa'] as const
