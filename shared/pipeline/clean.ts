import type {
  CellValue, ColumnProfile, Dataset, DatasetRow, MetricInfo, ParsedTable, PipelineWarning, Role, RoleMap, TableColumn,
} from '../types/blog'
import { LIMITS, PipelineFailure } from './errors'
import { isMissing, parseNumberish, parseUrl, parseYear } from './values'

const SUMMARY_ROW = /^(?:grand )?(?:sub-?)?totals?$|^(?:average|mean|median|sum|count)$/i
const TABLE_ROLE_ORDER: Role[] = ['region', 'stage', 'size', 'year', 'category']
const MAX_EXTRA_COLUMNS = 2

/** Applies the column roles to the raw table and produces the clean dataset. */
export function buildDataset(table: ParsedTable, profiles: ColumnProfile[], roles: RoleMap): Dataset {
  const nameIndex = roles.name
  if (nameIndex === undefined) {
    throw new PipelineFailure(
      'no_name_column',
      'None of the columns looks like a company name.',
      'Add a column of names, or pick the right column in the mapping below.',
    )
  }

  const warnings: PipelineWarning[] = [...table.warnings]
  const metricProfile = roles.metric === undefined ? undefined : profiles[roles.metric]
  const metric = metricProfile ? metricInfo(metricProfile) : null
  const columns = chooseColumns(profiles, roles)

  const seen = new Set<string>()
  const noName: number[] = []
  const duplicates: number[] = []
  const summaries: number[] = []
  const unreadable: number[] = []
  const otherCurrency: number[] = []
  const badUrls: number[] = []
  const kept: (Omit<DatasetRow, 'rank'> & { sourceRank: number | null; order: number })[] = []

  table.rows.forEach((cells, position) => {
    const line = table.lines[position]!
    const rawName = cells[nameIndex]!
    if (isMissing(rawName)) {
      noName.push(line)
      return
    }
    const name = rawName.replace(/\s+/g, ' ').trim()
    if (SUMMARY_ROW.test(name)) {
      summaries.push(line)
      return
    }
    // A footer note fills one cell of a row, for example "Source: Companies House".
    if (cells.filter(c => c.trim()).length === 1 && profiles.length >= 3) {
      summaries.push(line)
      return
    }
    const key = name.toLowerCase()
    if (seen.has(key)) {
      duplicates.push(line)
      return
    }
    seen.add(key)

    let metricValue: number | null = null
    if (metricProfile) {
      const raw = cells[metricProfile.index]!
      const parsed = isMissing(raw) ? null : parseNumberish(raw)
      if (!isMissing(raw) && parsed === null) unreadable.push(line)
      else if (parsed?.currency && metric?.currency && parsed.currency !== metric.currency) otherCurrency.push(line)
      else if (parsed) metricValue = parsed.value * (metricProfile.scale ?? 1)
    }

    const rawUrl = roles.website === undefined ? '' : cells[roles.website]!
    const url = isMissing(rawUrl) ? null : parseUrl(rawUrl)
    if (!isMissing(rawUrl) && url === null) badUrls.push(line)

    const rawDescription = roles.description === undefined ? '' : cells[roles.description]!
    const rawRank = roles.rank === undefined ? '' : cells[roles.rank]!
    kept.push({
      name,
      url,
      description: isMissing(rawDescription) ? null : rawDescription,
      metric: metricValue,
      cells: Object.fromEntries(columns.map(c => [c.id, readCell(cells[Number(c.id.slice(1))]!, c, profiles[Number(c.id.slice(1))]!)])),
      sourceRank: isMissing(rawRank) ? null : (parseNumberish(rawRank)?.value ?? null),
      order: position,
    })
  })

  note(warnings, 'no_name', noName, n => `Skipped ${n} row${plural(n)} with no name.`)
  note(warnings, 'duplicates', duplicates, n => `Skipped ${n} duplicate row${plural(n)}. The first entry for each name was kept.`)
  note(warnings, 'summary_rows', summaries, n => `Skipped ${n} row${plural(n)} that looked like a total or a footnote, not a company.`)
  note(warnings, 'bad_metric', unreadable, n => `${n} value${plural(n)} in "${metricProfile?.header}" could not be read and ${n === 1 ? 'is' : 'are'} shown as not disclosed.`)
  note(warnings, 'mixed_currency', otherCurrency, n => `${n} value${plural(n)} in "${metricProfile?.header}" used a different currency from the rest. ${n === 1 ? 'It is' : 'They are'} shown as not disclosed, because adding currencies together would be wrong.`)
  note(warnings, 'bad_urls', badUrls, n => `${n} website value${plural(n)} could not be read as a safe link and ${n === 1 ? 'was' : 'were'} left out.`)

  if (kept.length < LIMITS.minRows) {
    throw new PipelineFailure(
      'too_few_rows',
      `Only ${kept.length} usable row${plural(kept.length)} ${kept.length === 1 ? 'was' : 'were'} found. At least ${LIMITS.minRows} are needed to make a useful page.`,
      'Check that the file has one company per row, and that the name column is right.',
    )
  }

  const sorted = rankRows(kept, Boolean(metric))
  const rows: DatasetRow[] = sorted.map(({ sourceRank: _s, order: _o, ...row }, i) => ({ ...row, rank: i + 1 }))
  const missingMetric = rows.filter(r => r.metric === null).length

  if (metric && missingMetric === rows.length) {
    throw new PipelineFailure(
      'metric_unreadable',
      `No value in "${metric.header}" could be read as a number.`,
      'Pick a different ranking value in the mapping below, or fix the column.',
    )
  }
  if (metric && missingMetric > 0) {
    warnings.push({ code: 'missing_metric', message: `${missingMetric} row${plural(missingMetric)} had no "${metric.header}" value. ${missingMetric === 1 ? 'It is' : 'They are'} listed last and left out of the totals.` })
  }
  if (!metric) {
    warnings.push({ code: 'no_metric', message: 'No numeric column was found to rank by, so the original file order was kept.' })
  }

  const rankIndex = roles.rank
  if (metric && rankIndex !== undefined && kept.some((row, i) => row.sourceRank !== null && row.sourceRank !== sorted.findIndex(s => s.order === row.order) + 1 && i < 20)) {
    warnings.push({ code: 'rank_recalculated', message: `The "${profiles[rankIndex]!.header}" column did not match the order of "${metric.header}", so the ranks were recalculated.` })
  }

  return {
    metric,
    columns,
    rows,
    constants: findConstants(columns, profiles, rows, roles),
    stats: {
      rowsInFile: table.rows.length,
      rowsUsed: rows.length,
      rowsDropped: table.rows.length - rows.length,
      missingMetric,
    },
    warnings,
  }
}

function rankRows<T extends { metric: number | null; sourceRank: number | null; order: number }>(rows: T[], hasMetric: boolean): T[] {
  return [...rows].sort((a, b) => {
    if (hasMetric) {
      if (a.metric === null || b.metric === null) {
        if (a.metric !== b.metric) return a.metric === null ? 1 : -1
      }
      else if (a.metric !== b.metric) return b.metric - a.metric
    }
    return (a.sourceRank ?? Infinity) - (b.sourceRank ?? Infinity) || a.order - b.order
  })
}

function metricInfo(profile: ColumnProfile): MetricInfo {
  const kind = profile.kind === 'money' ? 'money' : profile.kind === 'percent' ? 'percent' : 'number'
  const label = profile.header
    .replace(/\((?:[^)]*)\)/g, '')
    .replace(/[£$€]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return { header: profile.header, label: label || 'value', kind, currency: profile.currency }
}

function chooseColumns(profiles: ColumnProfile[], roles: RoleMap): TableColumn[] {
  const columns: TableColumn[] = []
  for (const role of TABLE_ROLE_ORDER) {
    const index = roles[role]
    if (index !== undefined) columns.push(toColumn(profiles[index]!, role))
  }
  const used = new Set(Object.values(roles))
  const extras = profiles.filter(p => !used.has(p.index) && ['money', 'number', 'percent', 'category', 'band', 'year'].includes(p.kind))
  return [...columns, ...extras.slice(0, MAX_EXTRA_COLUMNS).map(p => toColumn(p))]
}

function toColumn(profile: ColumnProfile, role?: Role): TableColumn {
  const kind = role === 'category' || profile.kind === 'multi'
    ? 'tags'
    : (['money', 'number', 'percent', 'year'] as const).find(k => k === profile.kind) ?? 'text'
  return { id: `c${profile.index}`, header: profile.header, kind, role, currency: profile.currency }
}

function readCell(raw: string, column: TableColumn, profile: ColumnProfile): CellValue {
  if (isMissing(raw)) return null
  switch (column.kind) {
    case 'tags': {
      const parts = raw.split(profile.separator ?? ';').map(t => t.trim()).filter(Boolean)
      return parts.length ? parts : null
    }
    case 'year':
      return parseYear(raw) ?? raw
    case 'money':
    case 'number':
    case 'percent': {
      const parsed = parseNumberish(raw)
      return parsed ? parsed.value * (profile.scale ?? 1) : raw
    }
    default:
      return raw
  }
}

function findConstants(columns: TableColumn[], profiles: ColumnProfile[], rows: DatasetRow[], roles: RoleMap): Dataset['constants'] {
  const constants: Dataset['constants'] = []
  for (const column of columns) {
    const profile = profiles[Number(column.id.slice(1))]!
    if (column.kind === 'tags' || column.kind === 'number' || column.kind === 'money') continue
    const values = new Set(rows.map(r => r.cells[column.id]).filter(v => v !== null).map(String))
    if (values.size === 1 && profile.filled >= rows.length * 0.8) {
      constants.push({ role: column.role, header: column.header, value: [...values][0]! })
    }
  }
  return roles ? constants : []
}

function note(warnings: PipelineWarning[], code: string, lines: number[], message: (count: number) => string): void {
  if (lines.length) warnings.push({ code, message: message(lines.length), lines: lines.slice(0, LIMITS.warningLines) })
}

function plural(count: number): string {
  return count === 1 ? '' : 's'
}
