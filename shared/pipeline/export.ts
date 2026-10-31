import type { CellValue, Dataset } from '../types/blog'

/** A spreadsheet treats a cell that starts with one of these as a formula. */
const FORMULA = /^[=+\-@\t\r]/

function csvCell(value: CellValue): string {
  if (value === null) return ''
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  const safe = typeof value === 'number' ? text : text.replace(FORMULA, '\'$&')
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** The ranking as a file, with a byte order mark so Excel reads £ correctly. */
export function datasetToCsv({ columns, metric, rows }: Dataset): string {
  const headers = ['Rank', 'Name', ...(metric ? [metric.header] : []), ...columns.map(c => c.header), 'Website', 'Description']
  const lines = rows.map(row => [
    row.rank,
    row.name,
    ...(metric ? [row.metric] : []),
    ...columns.map(c => row.cells[c.id] ?? null),
    row.url,
    row.description,
  ])
  return `﻿${[headers, ...lines].map(line => line.map(csvCell).join(',')).join('\r\n')}\r\n`
}
