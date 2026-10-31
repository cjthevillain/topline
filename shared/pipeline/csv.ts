import Papa from 'papaparse'
import type { ParsedTable, PipelineWarning } from '../types/blog'
import { LIMITS, PipelineFailure } from './errors'
import { looksLikeUrl, parseNumberish } from './values'

interface RawRow {
  cells: string[]
  line: number
}

/** Reads CSV text into a rectangular table, repairing what it safely can. */
export function parseTable(text: string): ParsedTable {
  const clean = text.replace(/^﻿/, '').replace(/^sep=.\r?\n/i, '')
  if (!clean.trim()) {
    throw new PipelineFailure('empty_file', 'This file is empty.', 'Choose a CSV file that has a header row and at least a few rows of data.')
  }
  if (/^\s*<(?:!doctype|html)/i.test(clean)) {
    throw new PipelineFailure('html_file', 'This file contains a web page, not CSV data.', 'Download the raw CSV, not the page that links to it.')
  }

  const warnings: PipelineWarning[] = []
  let parsed = runPapa(clean)
  if (parsed.errors.some(e => e.type === 'Quotes')) {
    parsed = runPapa(repairQuotes(clean))
    warnings.push({ code: 'quotes_repaired', message: 'Some cells had a stray quote mark. These were removed so the rows could be read.' })
  }

  const raw = withLineNumbers(parsed.data, clean)
  if (raw.length === 0) {
    throw new PipelineFailure('empty_file', 'This file has no rows of data.', 'Check that the file has a header row and at least a few rows of data.')
  }

  const modal = modalWidth(raw)
  if (modal < 2) {
    throw new PipelineFailure(
      'one_column',
      'Only one column was found, so there is nothing to rank or compare.',
      'Use a file with at least a name column and one other column, separated by commas, semicolons, tabs or pipes.',
    )
  }
  if (modal > LIMITS.maxColumns) {
    throw new PipelineFailure('too_many_columns', `This file has ${modal} columns. The limit is ${LIMITS.maxColumns}.`, 'Remove the columns you do not need.')
  }

  const { headers, dataStart, headerless, skipped } = findHeader(raw, modal)
  const width = headers.length
  if (skipped > 0) {
    warnings.push({ code: 'preamble_skipped', message: `Skipped ${skipped} line${skipped === 1 ? '' : 's'} above the header row.` })
  }
  if (headerless) {
    warnings.push({ code: 'no_header', message: 'No header row was found, so the columns were given generic names. Check the column mapping before you generate the page.' })
  }

  const rows: string[][] = []
  const lines: number[] = []
  const padded: number[] = []
  const rejected: number[] = []
  const merged: number[] = []
  const repeated: number[] = []

  for (const row of raw.slice(dataStart)) {
    if (row.cells.every(c => !c.trim())) continue
    let cells = row.cells.map(c => c.trim())
    if (cells.length > width) {
      const fixed = mergeSplitNumbers(cells, width)
      if (fixed) {
        cells = fixed
        merged.push(row.line)
      }
      else if (cells.slice(width).every(c => !c)) {
        cells = cells.slice(0, width)
      }
      else {
        rejected.push(row.line)
        continue
      }
    }
    if (cells.length < width) {
      padded.push(row.line)
      cells = [...cells, ...Array.from({ length: width - cells.length }, () => '')]
    }
    if (cells.every((c, i) => c.toLowerCase() === headers[i]!.toLowerCase())) {
      repeated.push(row.line)
      continue
    }
    rows.push(cells)
    lines.push(row.line)
  }

  note(warnings, 'split_numbers', merged, n => `${n} row${n === 1 ? ' had a' : 's had a'} number split by an unquoted comma. It was joined back together.`)
  note(warnings, 'short_rows', padded, n => `${n} row${n === 1 ? ' had' : 's had'} too few cells. The missing cells were left empty.`)
  note(warnings, 'long_rows', rejected, n => `${n} row${n === 1 ? ' had' : 's had'} more cells than the header and could not be repaired, so ${n === 1 ? 'it was' : 'they were'} skipped.`)
  note(warnings, 'repeated_header', repeated, n => `Removed ${n} repeated header row${n === 1 ? '' : 's'}.`)

  if (rows.length === 0) {
    throw new PipelineFailure('too_few_rows', 'A header row was found, but no rows of data.', 'Add at least a few rows below the header.')
  }
  if (rows.length > LIMITS.maxRows) {
    throw new PipelineFailure('too_many_rows', `This file has ${rows.length.toLocaleString('en-GB')} rows. The limit is ${LIMITS.maxRows.toLocaleString('en-GB')}.`, 'Keep the top rows, or split the file.')
  }

  return { headers, rows, lines, delimiter: parsed.meta.delimiter, warnings }
}

function runPapa(text: string) {
  return Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimitersToGuess: [',', ';', '\t', '|'],
  })
}

/** Drops quote marks from lines that have an odd number, which closes a runaway cell. */
function repairQuotes(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => ((line.match(/"/g) ?? []).length % 2 === 1 ? line.replace(/"/g, '') : line))
    .join('\n')
}

/** Papa drops physical line numbers, so rebuild them from embedded newlines. */
function withLineNumbers(data: string[][], text: string): RawRow[] {
  const multiline = text.includes('"')
  const out: RawRow[] = []
  let line = 1
  for (const cells of data) {
    if (cells.length > 1 || (cells[0] ?? '').trim()) out.push({ cells, line })
    line += 1
    if (multiline) line += cells.reduce((sum, c) => sum + (c.match(/\n/g) ?? []).length, 0)
  }
  return out
}

function modalWidth(rows: RawRow[]): number {
  const counts = new Map<number, number>()
  for (const row of rows) {
    const width = lastFilled(row.cells) + 1
    counts.set(width, (counts.get(width) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  for (const [width, count] of counts) {
    if (count > bestCount || (count === bestCount && width > best)) {
      best = width
      bestCount = count
    }
  }
  return best
}

function lastFilled(cells: string[]): number {
  for (let i = cells.length - 1; i >= 0; i--) if (cells[i]!.trim()) return i
  return -1
}

function isDataCell(cell: string): boolean {
  const text = cell.trim()
  return parseNumberish(text) !== null || looksLikeUrl(text)
}

function findHeader(rows: RawRow[], modal: number) {
  const scan = rows.slice(0, 10)
  const minFilled = Math.max(2, Math.ceil(modal * 0.6))
  for (let i = 0; i < scan.length; i++) {
    const cells = scan[i]!.cells
    const filled = cells.filter(c => c.trim())
    if (filled.length < minFilled) continue
    if (filled.some(isDataCell)) {
      // A full row of data with nothing above it means the file has no header.
      return { headers: uniqueHeaders([], modal), dataStart: i, headerless: true, skipped: i }
    }
    return { headers: uniqueHeaders(cells, tableWidth(rows.slice(i + 1), lastFilled(cells) + 1, modal)), dataStart: i + 1, headerless: false, skipped: i }
  }
  throw new PipelineFailure('no_header', 'No header row could be found in the first 10 lines.', 'Put the column names on the first line of the file.')
}

/**
 * The header sets the width, because unquoted `£1,000,000` cells can make the
 * most common row length wrong. Only a clear majority of wider rows overrides
 * it, which means the header really is missing some column names.
 */
function tableWidth(rows: RawRow[], headerWidth: number, modal: number): number {
  if (modal <= headerWidth) return headerWidth
  const wider = rows.filter(row => lastFilled(row.cells) + 1 >= modal).length
  return wider > rows.length * 0.6 ? modal : headerWidth
}

function uniqueHeaders(cells: string[], width: number): string[] {
  const seen = new Map<string, number>()
  return Array.from({ length: width }, (_, i) => {
    const base = (cells[i] ?? '').replace(/\s+/g, ' ').trim() || `Column ${i + 1}`
    const count = (seen.get(base.toLowerCase()) ?? 0) + 1
    seen.set(base.toLowerCase(), count)
    return count === 1 ? base : `${base} (${count})`
  })
}

/** Rejoins `£1,000,000` that a hand-made file left unquoted. */
function mergeSplitNumbers(cells: string[], width: number): string[] | null {
  const out = [...cells]
  let i = 0
  while (i < out.length - 1 && out.length > width) {
    if (/^(?:£|\$|€)?\d{1,3}(?:,\d{3})*$/.test(out[i]!) && /^\d{3}$/.test(out[i + 1]!)) {
      out.splice(i, 2, `${out[i]},${out[i + 1]}`)
    }
    else {
      i++
    }
  }
  return out.length === width ? out : null
}

function note(warnings: PipelineWarning[], code: string, lines: number[], message: (count: number) => string): void {
  if (lines.length) warnings.push({ code, message: message(lines.length), lines: lines.slice(0, LIMITS.warningLines) })
}
