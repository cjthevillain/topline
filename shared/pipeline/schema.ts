import type { ColumnKind, ColumnProfile, ParsedTable, Role, RoleMap } from '../types/blog'
import { isBand, isMissing, looksLikeUrl, parseNumberish, parseYear } from './values'

const MAJORITY = 0.8

const HEADER_PATTERNS: Record<Role, RegExp> = {
  name: /\b(company|companies|organi[sz]ation|business|start-?up|scale-?up|brand|firm|provider|employer|entity|vendor|name)\b/i,
  metric: /\b(raised|funding|funds?|investment|invested|capital|revenue|turnover|sales|valuation|arr|mrr|market cap|profit|amount|value|score|total)\b/i,
  rank: /^(?:#|no\.?|num(?:ber)?|rank(?:ing)?|position|pos\.?)$/i,
  region: /\b(region|location|city|town|county|country|hq|head ?quarters?|area|nation|based|geography|office|postcode)\b/i,
  category: /\b(industr(?:y|ies)|sectors?|sub-?sectors?|categor(?:y|ies)|verticals?|tags?|segments?|themes?|markets?|focus(?: areas?)?|specialisms?|technolog(?:y|ies))\b/i,
  stage: /\b(stage|round|series|phase|maturity)\b/i,
  size: /\b(employees?|staff|head ?count|team(?: size)?|fte|people|workforce|size)\b/i,
  description: /\b(description|about|summary|overview|bio|profile|what they do|activity|details?|tagline)\b/i,
  website: /\b(website|web site|url|domain|home ?page|link|site)\b/i,
  year: /\b(founded|established|incorporated|inception|started|year)\b/i,
}

/** Measures make a better default ranking than these, in this order of preference. */
const METRIC_PRIORITY = [
  /raised|funding|investment|invested|capital/i,
  /revenue|turnover|sales|arr|mrr/i,
  /valuation|market cap/i,
  /profit|amount|value/i,
]

export function profileColumns(table: ParsedTable): ColumnProfile[] {
  return table.headers.map((header, index) => {
    const values = table.rows.map(r => r[index]!).filter(v => !isMissing(v))
    return profile(header, index, values)
  })
}

function profile(header: string, index: number, values: string[]): ColumnProfile {
  const distinct = new Set(values.map(v => v.toLowerCase())).size
  const base = { index, header, filled: values.length, distinct, samples: [...new Set(values)].slice(0, 3) }
  if (values.length === 0) return { ...base, kind: 'empty' }

  const share = (test: (value: string) => boolean) => values.filter(test).length / values.length
  const parsed = values.map(parseNumberish)
  const numeric = parsed.filter(p => p !== null).length / values.length
  const fromHeader = headerUnit(header)

  if (share(isBand) >= MAJORITY) return { ...base, kind: 'band' }
  if (numeric >= MAJORITY) {
    const symbols = parsed.flatMap(p => (p?.currency ? [p.currency] : []))
    const currency = dominant(symbols) ?? fromHeader.currency
    if (currency || (fromHeader.scale && /raised|funding|revenue|turnover|sales|valuation/i.test(header))) {
      return { ...base, kind: 'money', currency, scale: fromHeader.scale }
    }
    if (parsed.filter(p => p?.percent).length / values.length >= MAJORITY) return { ...base, kind: 'percent' }
    const looksLikeYears = parsed.every(p => !p || (Number.isInteger(p.value) && p.value >= 1800 && p.value <= 2100))
    if (looksLikeYears && !/\b(employees?|staff|head ?count)\b/i.test(header)) return { ...base, kind: 'year' }
    return { ...base, kind: 'number', scale: fromHeader.scale }
  }
  if (share(looksLikeUrl) >= MAJORITY) return { ...base, kind: 'url' }
  if (HEADER_PATTERNS.year.test(header) && share(v => parseYear(v) !== null) >= MAJORITY) return { ...base, kind: 'year' }

  const separator = [';', '|'].find(s => share(v => v.includes(s)) >= 0.2)
  if (separator) return { ...base, kind: 'multi', separator }
  if (HEADER_PATTERNS.category.test(header) && share(v => v.includes(',')) >= 0.3) return { ...base, kind: 'multi', separator: ',' }

  const averageLength = values.reduce((sum, v) => sum + v.length, 0) / values.length
  const repeats = distinct <= Math.max(12, values.length * 0.5)
  return { ...base, kind: averageLength <= 40 && repeats ? 'category' : 'text' }
}

function dominant(values: string[]): string | undefined {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** `Funding (£m)` means every value is in millions of pounds. */
function headerUnit(header: string): { currency?: string; scale?: number } {
  const currency = /(£|\$|€)/.exec(header)?.[1] ?? { gbp: '£', usd: '$', eur: '€' }[/\b(gbp|usd|eur)\b/i.exec(header)?.[1]?.toLowerCase() ?? '']
  const unit = /\(?\b(?:£|\$|€)?\s*(k|m|mn|bn|thousands?|millions?|billions?)\b\)?/i.exec(header.replace(/(£|\$|€)/g, ' '))?.[1]?.toLowerCase()
  const scale = !unit ? undefined : unit.startsWith('k') || unit.startsWith('t') ? 1e3 : unit.startsWith('b') ? 1e9 : 1e6
  return { currency, scale }
}

/** Assigns each role to its best column. Explicit choices from the UI always win. */
export function inferRoles(columns: ColumnProfile[], overrides: RoleMap = {}): RoleMap {
  const roles: RoleMap = {}
  const taken = new Set<number>()
  // -1 means the person chose "not in this file", so auto-detection must leave it alone.
  const blocked = new Set(Object.entries(overrides).filter(([, index]) => index === -1).map(([role]) => role))
  const assign = (role: Role, column: ColumnProfile | undefined) => {
    if (column && roles[role] === undefined && !blocked.has(role) && !taken.has(column.index)) {
      roles[role] = column.index
      taken.add(column.index)
    }
  }
  const byIndex = (index: number) => columns.find(c => c.index === index)

  for (const [role, index] of Object.entries(overrides) as [Role, number | undefined][]) {
    if (index !== undefined && index >= 0) assign(role, byIndex(index))
  }
  const live = columns.filter(c => c.kind !== 'empty' && !taken.has(c.index))
  const named = (role: Role, kinds?: ColumnKind[]) =>
    live.find(c => !taken.has(c.index) && HEADER_PATTERNS[role].test(c.header) && (!kinds || kinds.includes(c.kind)))

  assign('rank', named('rank', ['number']) ?? live.find(c => isSequence(c)))
  assign('website', named('website', ['url', 'text', 'category']) ?? live.find(c => c.kind === 'url'))
  assign('size', named('size', ['band', 'number', 'category']) ?? live.find(c => c.kind === 'band'))
  assign('year', named('year', ['year', 'number', 'category']) ?? live.find(c => c.kind === 'year'))

  const measures = live.filter(c => ['money', 'number', 'percent'].includes(c.kind) && !taken.has(c.index))
  const preferred = METRIC_PRIORITY.map(p => measures.find(c => p.test(c.header))).find(Boolean)
  assign('metric', preferred ?? measures.find(c => c.kind === 'money') ?? named('metric', ['money', 'number', 'percent']) ?? measures[0])

  assign('category', named('category', ['multi', 'category', 'text']) ?? live.find(c => c.kind === 'multi' && !taken.has(c.index)))
  assign('stage', named('stage', ['category']))
  assign('region', named('region', ['category', 'text']))
  assign('description', named('description', ['text', 'category']))
  assign('name', named('name', ['text', 'category']) ?? bestNameColumn(live, taken))
  assign('description', [...live].filter(c => c.kind === 'text' && !taken.has(c.index)).sort((a, b) => avg(b) - avg(a))[0])
  if (roles.metric === undefined && !blocked.has('metric') && roles.size !== undefined && byIndex(roles.size)?.kind === 'number') {
    roles.metric = roles.size
    delete roles.size
  }
  return roles
}

function avg(column: ColumnProfile): number {
  return column.samples.reduce((sum, s) => sum + s.length, 0) / (column.samples.length || 1)
}

function isSequence(column: ColumnProfile): boolean {
  return column.kind === 'number' && column.distinct === column.filled && column.samples[0] === '1' && column.samples[1] === '2'
}

function bestNameColumn(live: ColumnProfile[], taken: Set<number>): ColumnProfile | undefined {
  return live
    .filter(c => ['text', 'category'].includes(c.kind) && !taken.has(c.index))
    .sort((a, b) => b.distinct / b.filled - a.distinct / a.filled || a.index - b.index)[0]
}
