import type {
  AllowedNumbers, Breakdown, BreakdownRow, Dataset, DatasetRow, Insights, TableColumn, Tile, TopicContext,
} from '../types/blog'
import { bandOrder, formatCompact, formatPercent, isBand } from './values'

const MAX_BREAKDOWN_ROWS = 8
const MAX_BREAKDOWNS = 4
/** A tag on nearly every row tells a reader nothing, for example "Application software". */
const GENERIC_TAG_SHARE = 90

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits))
}

/** Derives every number on the page. Nothing here depends on one industry. */
export function computeInsights(dataset: Dataset, context: TopicContext): Insights {
  const { rows, metric } = dataset
  const money = (value: number) => (metric?.kind === 'percent' ? formatPercent(value) : formatCompact(value, metric?.currency ?? ''))
  const valued = rows.filter(r => r.metric !== null) as (DatasetRow & { metric: number })[]
  const noun = nounFor(context)
  const tiles: Tile[] = [{ id: 'count', label: `${capitalise(noun)} ranked`, value: rows.length.toLocaleString('en-GB'), note: scopeNote(context) }]
  const facts: string[] = [`The dataset covers ${rows.length} ${noun}.`]
  const allowed: AllowedNumbers = { money: [], percents: [], plain: [rows.length] }

  const addMoney = (value: number) => allowed.money.push(value)
  const addPercent = (value: number) => allowed.percents.push(value)

  let total: number | null = null
  if (metric && valued.length) {
    const values = valued.map(r => r.metric)
    const leader = valued[0]!
    const canSum = metric.kind !== 'percent' && values.every(v => v >= 0)
    if (canSum) total = values.reduce((sum, v) => sum + v, 0)

    if (total !== null) {
      tiles.push({ id: 'total', label: capitalise(`combined ${metric.label}`), value: money(total), note: `Across ${valued.length} ${noun}` })
      facts.push(`Combined ${metric.label} across ${valued.length} ${noun} is ${money(total)}.`)
      addMoney(total)
      allowed.plain.push(valued.length)
    }
    const mid = median(values)!
    tiles.push({ id: 'median', label: capitalise(`median ${metric.label}`), value: money(mid), note: 'The midpoint, less skewed by outliers' })
    facts.push(`Median ${metric.label} is ${money(mid)}.`)
    addMoney(mid)

    if (total) {
      const mean = total / valued.length
      facts.push(`Mean ${metric.label} is ${money(mean)}.`)
      addMoney(mean)
    }

    facts.push(`${leader.name} ranks first with ${money(leader.metric)} ${metric.label}.`)
    addMoney(leader.metric)
    const second = valued[1]
    if (second) {
      facts.push(`${second.name} ranks second with ${money(second.metric)}.`)
      addMoney(second.metric)
    }
    const smallest = valued.at(-1)!
    facts.push(`The lowest value in the ranking is ${money(smallest.metric)} (${smallest.name}).`)
    addMoney(smallest.metric)
    if (smallest.metric > 0 && valued.length > 1) {
      const multiple = roundTo(leader.metric / smallest.metric, 1)
      facts.push(`First place is ${multiple} times the value of last place.`)
      allowed.plain.push(multiple)
    }

    if (total && valued.length >= 10) {
      const topCount = valued.length >= 40 ? 10 : Math.max(3, Math.round(valued.length / 4))
      const topSum = valued.slice(0, topCount).reduce((sum, r) => sum + r.metric, 0)
      const share = roundTo((topSum / total) * 100, 1)
      tiles.push({ id: 'concentration', label: `Share held by top ${topCount}`, value: formatPercent(share), note: `${money(topSum)} of ${money(total)}` })
      facts.push(`The top ${topCount} hold ${formatPercent(share)} of the combined total (${money(topSum)}).`)
      addPercent(share)
      addMoney(topSum)
      allowed.plain.push(topCount)
    }

    for (const row of valued.slice(0, 10)) addMoney(row.metric)
    if (metric.kind === 'money' || total) {
      for (const threshold of thresholds(values)) {
        const count = values.filter(v => v >= threshold).length
        facts.push(`${count} of ${valued.length} have at least ${money(threshold)}.`)
        allowed.plain.push(count)
        addMoney(threshold)
      }
    }
  }

  const breakdowns = buildBreakdowns(dataset)
  for (const breakdown of breakdowns) {
    const leader = breakdown.rows[0]
    if (!leader) continue
    const describe = breakdown.rows.slice(0, 4).map(r => `${r.label}: ${r.count} (${formatPercent(r.share)})${r.total !== null && total ? `, ${money(r.total)} combined` : ''}`).join('; ')
    facts.push(`${breakdown.title}. ${describe}.`)
    for (const row of breakdown.rows) {
      allowed.plain.push(row.count)
      addPercent(row.share)
      if (row.total !== null) addMoney(row.total)
      if (row.median !== null) addMoney(row.median)
      if (row.total !== null && total) addPercent(roundTo((row.total / total) * 100, 1))
    }
  }

  const location = breakdowns.find(b => b.id === 'region')
  if (location?.rows[0] && location.rows[0].label !== 'Other') {
    tiles.push({ id: 'region', label: `Based in ${location.rows[0].label}`, value: formatPercent(location.rows[0].share), note: `${location.rows[0].count} of ${rows.length} ${noun}` })
  }
  const sector = breakdowns.find(b => b.id === 'category')
  if (sector?.rows[0]) {
    tiles.push({ id: 'category', label: 'Most common sector', value: `${sector.rows[0].count}`, note: sector.rows[0].label })
  }
  const size = breakdowns.find(b => b.id === 'size')
  if (size?.rows.length) {
    const largest = [...size.rows].sort((a, b) => b.count - a.count)[0]!
    tiles.push({ id: 'size', label: `Most common ${size.header.toLowerCase()}`, value: largest.label, note: `${largest.count} of ${rows.length} ${noun}` })
  }

  const yearColumn = dataset.columns.find(c => c.kind === 'year')
  if (yearColumn) {
    const years = rows.map(r => r.cells[yearColumn.id]).filter((v): v is number => typeof v === 'number')
    const mid = median(years)
    if (mid !== null && years.length >= 3) {
      const rounded = Math.round(mid)
      tiles.push({ id: 'year', label: `Median ${yearColumn.header.toLowerCase()}`, value: String(rounded), note: `From ${years.length} ${noun}` })
      facts.push(`The median ${yearColumn.header.toLowerCase()} is ${rounded}. The earliest is ${Math.min(...years)} and the latest is ${Math.max(...years)}.`)
      allowed.plain.push(rounded, Math.min(...years), Math.max(...years))
    }
  }

  for (const row of rows) allowed.plain.push(row.rank, ...digitsIn(row.name))
  for (const breakdown of breakdowns) for (const row of breakdown.rows) allowed.plain.push(...digitsIn(row.label))
  return {
    tiles: tiles.slice(0, 6),
    breakdowns,
    facts,
    allowedNumbers: {
      money: unique(allowed.money),
      percents: unique(allowed.percents),
      plain: unique(allowed.plain),
    },
  }
}

/** Names and band labels can quote numbers: `3D Labs`, `10-24`. */
function digitsIn(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number)
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

/** Round thresholds that split the ranking usefully. */
function thresholds(values: number[]): number[] {
  const max = Math.max(...values)
  const out: number[] = []
  for (const step of [1e3, 1e4, 1e5, 1e6, 5e6, 1e7, 2e7, 5e7, 1e8, 1e9]) {
    const count = values.filter(v => v >= step).length
    if (step <= max && count > 1 && count < values.length) out.push(step)
  }
  return out.slice(-2)
}

function buildBreakdowns(dataset: Dataset): Breakdown[] {
  const order = ['region', 'category', 'size', 'stage']
  const candidates = [...dataset.columns]
    .filter(c => ['text', 'tags'].includes(c.kind))
    .filter(c => !dataset.constants.some(k => k.header === c.header))
    .sort((a, b) => rankOf(a, order) - rankOf(b, order))

  const out: Breakdown[] = []
  for (const column of candidates) {
    if (out.length === MAX_BREAKDOWNS) break
    const breakdown = breakdownFor(column, dataset)
    if (breakdown) out.push(breakdown)
  }
  return out
}

function rankOf(column: TableColumn, order: string[]): number {
  const index = order.indexOf(column.role ?? '')
  return index === -1 ? order.length : index
}

function breakdownFor(column: TableColumn, dataset: Dataset): Breakdown | null {
  const { rows, metric } = dataset
  const groups = new Map<string, DatasetRow[]>()
  for (const row of rows) {
    const value = row.cells[column.id]
    const labels = Array.isArray(value) ? value : value === null ? [] : [String(value)]
    for (const label of labels) groups.set(label, [...(groups.get(label) ?? []), row])
  }
  if (groups.size < 2 || groups.size > rows.length * 0.8) return null

  const canTotal = metric !== null && metric.kind !== 'percent' && !rows.some(r => (r.metric ?? 0) < 0)
  const toRow = (label: string, members: DatasetRow[]): BreakdownRow => {
    const values = members.flatMap(m => (m.metric === null ? [] : [m.metric]))
    return {
      label,
      count: members.length,
      share: roundTo((members.length / rows.length) * 100, 1),
      total: canTotal && values.length ? values.reduce((sum, v) => sum + v, 0) : null,
      median: metric ? median(values) : null,
    }
  }

  let entries = [...groups.entries()].map(([label, members]) => toRow(label, members))
  const isTags = column.kind === 'tags'
  if (isTags) entries = entries.filter(e => e.share < GENERIC_TAG_SHARE)

  const ordered = [...groups.keys()].every(isBand)
  entries.sort(ordered
    ? (a, b) => bandOrder(a.label) - bandOrder(b.label)
    : (a, b) => b.count - a.count || a.label.localeCompare(b.label))
  if (entries.length < 2) return null

  let folded = 0
  if (entries.length > MAX_BREAKDOWN_ROWS && !ordered) {
    const rest = entries.slice(MAX_BREAKDOWN_ROWS - 1)
    folded = rest.length
    entries = entries.slice(0, MAX_BREAKDOWN_ROWS - 1)
    // Tags overlap, so a folded tag total would count companies twice.
    if (!isTags) {
      const members = rest.flatMap(r => groups.get(r.label)!)
      entries.push(toRow('Other', members))
    }
  }

  const title = column.role === 'region'
    ? 'Where they are based'
    : column.role === 'category'
      ? 'Most common sectors'
      : column.role === 'size'
        ? `By ${column.header.toLowerCase()}`
        : column.role === 'stage'
          ? 'By stage'
          : `By ${column.header.toLowerCase()}`

  return {
    id: column.role ?? column.id,
    title,
    header: column.header,
    rows: entries,
    folded,
    measure: 'count',
  }
}

function nounFor(context: TopicContext): string {
  return `${context.topic === 'company' ? '' : `${context.topic} `}companies`.trim()
}

function scopeNote(context: TopicContext): string {
  return [context.geography, context.qualifier].filter(Boolean).join(', ') || 'From the uploaded dataset'
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
