/** Runs the copy step on CSV files and prints what passed the checks. Usage: tsx scripts/try-llm.ts a.csv b.csv */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { claudeProvider } from '../shared/copy/claude'
import { generateCopy, openAiCompatibleProvider } from '../shared/copy/generate'
import { analyseCsv } from '../shared/pipeline/analyse'

const env = process.env
const providers = [env.NUXT_ANTHROPIC_API_KEY
  ? claudeProvider({ apiKey: env.NUXT_ANTHROPIC_API_KEY, model: env.NUXT_ANTHROPIC_MODEL ?? 'claude-haiku-5-5' })
  : openAiCompatibleProvider({
      name: env.NUXT_LLM_NAME ?? 'groq',
      baseUrl: env.NUXT_LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
      apiKey: env.NUXT_LLM_API_KEY ?? '',
      model: env.NUXT_LLM_MODEL ?? '',
    })]

for (const file of process.argv.slice(2)) {
  const analysis = analyseCsv(readFileSync(file), { fileName: basename(file) })
  const started = Date.now()
  const result = await generateCopy(analysis, providers, { timeoutMs: Number(env.NUXT_LLM_TIMEOUT_MS ?? 25000), currentYear: new Date().getUTCFullYear() })
  console.log(JSON.stringify({ file, seconds: (Date.now() - started) / 1000, mode: result.mode, model: result.model, notes: result.notes, copy: result.copy }, null, 1))
}
