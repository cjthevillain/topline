/** Everything the pipeline passes between its layers. No Vue or server imports. */

export type ColumnKind =
  | 'empty'
  | 'money'
  | 'percent'
  | 'number'
  | 'year'
  | 'band'
  | 'url'
  | 'category'
  | 'multi'
  | 'text'

export type Role =
  | 'name'
  | 'metric'
  | 'rank'
  | 'region'
  | 'category'
  | 'stage'
  | 'size'
  | 'description'
  | 'website'
  | 'year'

export const ROLE_LABELS: Record<Role, string> = {
  name: 'Name',
  metric: 'Ranking value',
  rank: 'Original rank',
  region: 'Location',
  category: 'Sector or tags',
  stage: 'Stage',
  size: 'Company size',
  description: 'Description',
  website: 'Website',
  year: 'Founded year',
}

export interface PipelineError {
  code: string
  message: string
  hint: string
}

export interface PipelineWarning {
  code: string
  message: string
  /** File line numbers, capped so a bad file cannot bloat the response. */
  lines?: number[]
}

export interface ParsedTable {
  headers: string[]
  /** Parallel to `lines`. Every row has exactly `headers.length` cells. */
  rows: string[][]
  lines: number[]
  delimiter: string
  warnings: PipelineWarning[]
}

export interface ColumnProfile {
  index: number
  header: string
  kind: ColumnKind
  filled: number
  distinct: number
  samples: string[]
  /** ISO-like symbol such as `£`, when the column is money. */
  currency?: string
  /** Multiplier taken from the header, for example `Funding (£m)` gives 1,000,000. */
  scale?: number
  separator?: string
}

export type RoleMap = Partial<Record<Role, number>>

export type TableColumnKind = 'text' | 'number' | 'money' | 'percent' | 'year' | 'tags'

export interface TableColumn {
  id: string
  header: string
  kind: TableColumnKind
  role?: Role
  currency?: string
}

export type CellValue = string | number | string[] | null

export interface DatasetRow {
  rank: number
  name: string
  url: string | null
  description: string | null
  metric: number | null
  cells: Record<string, CellValue>
}

export interface MetricInfo {
  header: string
  /** Lower-case phrase for prose, for example `total raised`. */
  label: string
  kind: 'money' | 'number' | 'percent'
  currency?: string
}

export interface Dataset {
  metric: MetricInfo | null
  columns: TableColumn[]
  rows: DatasetRow[]
  /** Filled in when a column holds one value for every row, for example Stage = Seed. */
  constants: { role?: Role; header: string; value: string }[]
  stats: {
    rowsInFile: number
    rowsUsed: number
    rowsDropped: number
    missingMetric: number
  }
  warnings: PipelineWarning[]
}

export interface Tile {
  id: string
  label: string
  value: string
  note: string
}

export interface BreakdownRow {
  label: string
  count: number
  /** Share of rows, 0 to 100. */
  share: number
  total: number | null
  median: number | null
}

export interface Breakdown {
  id: string
  title: string
  /** Column header it came from. */
  header: string
  rows: BreakdownRow[]
  /** How many values were folded into the last `Other` row. */
  folded: number
  /** Which number the chart should draw. */
  measure: 'count' | 'total'
}

export interface Insights {
  tiles: Tile[]
  breakdowns: Breakdown[]
  /** Plain, checkable sentences. The LLM sees these and the template reuses them. */
  facts: string[]
  /** Every number the copy may quote. See `shared/copy/grounding.ts`. */
  allowedNumbers: AllowedNumbers
}

export interface AllowedNumbers {
  money: number[]
  percents: number[]
  plain: number[]
}

export interface TopicContext {
  /** As used in a sentence: `fintech`, `AI`, `clean energy`. */
  topic: string
  /** `UK`, or an empty string when the data does not establish one. */
  geography: string
  /** `seed-stage`, or an empty string. */
  qualifier: string
}

export interface BlogSection {
  heading: string
  paragraphs: string[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface BlogCopy {
  title: string
  h1: string
  metaDescription: string
  intro: string[]
  sections: BlogSection[]
  faq: FaqItem[]
  keywords: string[]
}

export type CopyMode = 'llm' | 'hybrid' | 'template'

export interface Provenance {
  mode: CopyMode
  provider: string | null
  model: string | null
  /** Short reasons, for the page footer and for debugging the demo. */
  notes: string[]
  sourceFile: string
  generatedAt: string
}

export interface BlogDocument {
  version: 1
  slug: string
  context: TopicContext
  dataset: Dataset
  insights: Insights
  copy: BlogCopy
  provenance: Provenance
  /** True for pages built into the deployment, false for uploads. */
  seeded: boolean
}

export interface BlogSummary {
  slug: string
  title: string
  description: string
  rows: number
  topic: string
  generatedAt: string
  seeded: boolean
  mode: CopyMode
}
