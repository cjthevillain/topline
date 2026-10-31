/**
 * Builds the pages that ship with the deployment, so the site has content with
 * no storage or LLM. Run with the LLM variables set to regenerate the copy.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { claudeProvider } from '../shared/copy/claude'
import { generateCopy, geminiProvider, openAiCompatibleProvider } from '../shared/copy/generate'
import type { LlmProvider } from '../shared/copy/generate'
import { analyseCsv } from '../shared/pipeline/analyse'
import { baseSlug, buildDocument } from '../shared/pipeline/document'

const SEEDS = [{ file: 'uk-fintech-seed-top-100.csv', topic: 'fintech' }]

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

for (const seed of SEEDS) {
  const bytes = readFileSync(new URL(`../data/${seed.file}`, import.meta.url))
  const analysis = analyseCsv(bytes, { fileName: seed.file, topic: seed.topic })
  const now = new Date()
  const result = await generateCopy(analysis, providers, {
    timeoutMs: Number(env.NUXT_LLM_TIMEOUT_MS ?? 25000),
    currentYear: now.getUTCFullYear(),
  })
  const slug = baseSlug(analysis)
  const doc = buildDocument(analysis, result, slug, seed.file, now.toISOString(), true)
  writeFileSync(new URL(`../content/${slug}.json`, import.meta.url), `${JSON.stringify(doc)}\n`)
  console.log(`${slug}: ${result.mode}${result.model ? ` (${result.model})` : ''}`)
  for (const note of result.notes) console.log(`  ${note}`)
}
