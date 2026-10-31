import type { CellValue, Dataset, TableColumn } from '../types/blog'
import { formatCompact, formatExact, formatPercent } from '../pipeline/values'

export { formatCount } from '../pipeline/values'

export function formatMetric(value: number | null, dataset: Pick<Dataset, 'metric'>): string {
  if (value === null) return 'Not disclosed'
  const { metric } = dataset
  return metric?.kind === 'percent' ? formatPercent(value) : formatExact(value, metric?.currency ?? '')
}

export function formatAmount(value: number, dataset: Pick<Dataset, 'metric'>): string {
  const { metric } = dataset
  return metric?.kind === 'percent' ? formatPercent(value) : formatCompact(value, metric?.currency ?? '')
}

export function formatCell(value: CellValue, column: TableColumn): string {
  if (value === null) return 'n/a'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') return value
  if (column.kind === 'year') return String(value)
  if (column.kind === 'percent') return formatPercent(value)
  return formatExact(value, column.currency ?? '')
}

/** `1st`, `2nd`, `3rd`, `4th`, `11th`, `22nd`, `101st`. */
export function ordinal(value: number): string {
  const lastTwo = value % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th'
  return `${value}${suffix}`
}

export function sortValue(value: CellValue): string | number | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}
