import type { ColumnProfile, Dataset, Insights, ParsedTable, RoleMap, TopicContext } from '../types/blog'
import { buildDataset } from './clean'
import { decodeBytes } from './decode'
import { parseTable } from './csv'
import { inferRoles, profileColumns } from './schema'
import { computeInsights } from './stats'
import { inferContext } from './topic'

export interface Analysis {
  table: ParsedTable
  profiles: ColumnProfile[]
  roles: RoleMap
  dataset: Dataset
  context: TopicContext
  insights: Insights
}

export interface AnalyseOptions {
  fileName: string
  topic?: string
  overrides?: RoleMap
}

/** The whole data layer in one call. The browser preview and the API both use it. */
export function analyseCsv(bytes: Uint8Array, options: AnalyseOptions): Analysis {
  const table = parseTable(decodeBytes(bytes))
  const profiles = profileColumns(table)
  const roles = inferRoles(profiles, options.overrides)
  const dataset = buildDataset(table, profiles, roles)
  const context = inferContext(dataset, options.fileName, options.topic)
  return { table, profiles, roles, dataset, context, insights: computeInsights(dataset, context) }
}
