import type { RoleMap } from '#shared/types/blog'
import { generateCopy } from '#shared/copy/generate'
import { analyseCsv } from '#shared/pipeline/analyse'
import { baseSlug, buildDocument } from '#shared/pipeline/document'
import { LIMITS, PipelineFailure } from '#shared/pipeline/errors'

const ROLES = new Set(['name', 'metric', 'rank', 'region', 'category', 'stage', 'size', 'description', 'website', 'year'])

function parseOverrides(raw: string | undefined): RoleMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter(([role, index]) => ROLES.has(role) && Number.isInteger(index))) as RoleMap
  }
  catch {
    return {}
  }
}

function fail(statusCode: number, code: string, message: string, hint: string) {
  return createError({ statusCode, statusMessage: message, data: { code, message, hint } })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > LIMITS.maxBytes + 64 * 1024) {
    throw fail(413, 'file_too_large', `This file is too large. The limit is ${LIMITS.maxBytes / 1024 / 1024} MB.`, 'Remove columns you do not need, or split the file.')
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.data.length)
  if (!file) throw fail(400, 'no_file', 'No file was uploaded.', 'Choose a CSV file and try again.')
  const field = (name: string) => parts?.find(p => p.name === name)?.data.toString('utf8')
  const fileName = (file.filename ?? 'upload.csv').slice(0, 120)

  // The browser preview ran this too, but the client is never trusted.
  let analysis
  try {
    analysis = analyseCsv(file.data, { fileName, topic: field('topic'), overrides: parseOverrides(field('overrides')) })
  }
  catch (error) {
    if (error instanceof PipelineFailure) throw fail(422, error.code, error.message, error.hint)
    console.error('Unexpected analysis failure', error)
    throw fail(500, 'analysis_failed', 'This file could not be processed.', 'Check that it is a valid CSV file, then try again.')
  }

  try {
    await claimQuota(event, config.dailyPageLimit, config.ipDailyLimit)
    const now = new Date()
    const result = await generateCopy(analysis, configuredProviders(config), {
      timeoutMs: config.llmTimeoutMs,
      budgetMs: config.llmBudgetMs,
      currentYear: now.getUTCFullYear(),
    })
    const slug = await uniqueSlug(baseSlug(analysis))
    const doc = buildDocument(analysis, result, slug, fileName, now.toISOString(), false)
    await saveBlog(doc)
    setResponseStatus(event, 201)
    return { slug, url: `/blog/${slug}`, mode: result.mode, provider: result.provider, warnings: analysis.dataset.warnings }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Could not save the page', error)
    throw fail(503, 'storage_failed', 'The page was built but could not be saved.', 'This is a problem with the server, not your file. Please try again in a minute.')
  }
})
