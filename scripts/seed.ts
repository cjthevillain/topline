/**
 * Builds the pages that ship with the deployment, so the site has content with
 * no storage or LLM. Run with the LLM variables set to regenerate the copy.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { claudeProvider } from '../shared/copy/claude'
import { generateCopy, geminiProvider, openAiCompatibleProvider } from '../shared/copy/generate'
import type { LlmProvider } from '../shared/copy/generate'
import { analyseCsv } from '../shared/pipeline/analyse'
import { parseTable } from '../shared/pipeline/csv'
import { decodeBytes } from '../shared/pipeline/decode'
import { baseSlug, buildDocument } from '../shared/pipeline/document'

interface Seed {
  topic: string
  /** Keeps part of the file, as a real ranking of its own. Ranks are recalculated for the smaller list. */
  keep?: (row: Record<string, string>) => boolean
  note?: string
}

const FILE = 'uk-fintech-seed-top-100.csv'
const sector = (name: string) => (row: Record<string, string>) => row.Industries!.split(';').some(tag => tag.trim() === name)
const SEEDS: Seed[] = [
  { topic: 'fintech' },
  { topic: 'London fintech', keep: row => row.Region === 'London', note: 'London companies only' },
  { topic: 'regional fintech', keep: row => row.Region !== 'London', note: 'companies outside London only' },
  { topic: 'fintech data', keep: sector('Data provision and analysis'), note: 'data provision and analysis companies only' },
  { topic: 'wealthtech', keep: sector('Wealth, asset and investment management'), note: 'wealth and investment companies only' },
  { topic: 'payments', keep: sector('Payment processing'), note: 'payment processing companies only' },
]

const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)

/** Rewrites the file with only the rows a seed keeps, leaving out the old rank column. */
function subset(bytes: Uint8Array, keep: NonNullable<Seed['keep']>): Uint8Array {
  const { headers, rows } = parseTable(decodeBytes(bytes))
  const rank = headers.indexOf('Rank')
  const lines = [headers, ...rows.filter(row => keep(Object.fromEntries(headers.map((header, i) => [header, row[i]!]))))]
    .map(cells => cells.filter((_, i) => i !== rank).map(quote).join(','))
  return new TextEncoder().encode(lines.join('\n'))
}

const env = process.env
const providers: LlmProvider[] = []
if (env.NUXT_ANTHROPIC_API_KEY) {
  providers.push(claudeProvider({ apiKey: env.NUXT_ANTHROPIC_API_KEY, model: env.NUXT_ANTHROPIC_MODEL ?? 'claude-haiku-5-5' }))
}
if (env.NUXT_LLM_MODEL) {
  providers.push(openAiCompatibleProvider({
    name: env.NUXT_LLM_NAME ?? 'groq',
    baseUrl: env.NUXT_LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
    apiKey: env.NUXT_LLM_API_KEY ?? '',
    model: env.NUXT_LLM_MODEL,
  }))
}
if (env.NUXT_GEMINI_API_KEY) {
  providers.push(geminiProvider({ apiKey: env.NUXT_GEMINI_API_KEY, model: env.NUXT_GEMINI_MODEL ?? 'gemini-2.5-flash' }))
}

const source = readFileSync(new URL(`../data/${FILE}`, import.meta.url))
for (const seed of SEEDS) {
  const bytes = seed.keep ? subset(source, seed.keep) : source
  const analysis = analyseCsv(bytes, { fileName: FILE, topic: seed.topic })
  const slug = baseSlug(analysis)
  const target = new URL(`../content/${slug}.json`, import.meta.url)
  // Regenerating costs an LLM call and replaces reviewed copy, so it has to be asked for.
  if (existsSync(target) && !process.argv.includes('--force')) {
    console.log(`${slug}: kept`)
    continue
  }
  const now = new Date()
  const result = await generateCopy(analysis, providers, {
    timeoutMs: Number(env.NUXT_LLM_TIMEOUT_MS ?? 25000),
    currentYear: now.getUTCFullYear(),
  })
  const sourceFile = seed.note ? `${FILE}, ${seed.note}` : FILE
  const doc = buildDocument(analysis, result, slug, sourceFile, now.toISOString(), true)
  writeFileSync(target, `${JSON.stringify(doc)}\n`)
  console.log(`${slug}: ${result.mode}${result.model ? ` (${result.model})` : ''}`)
  for (const note of result.notes) console.log(`  ${note}`)
}
