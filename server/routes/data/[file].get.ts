import { datasetToCsv } from '#shared/pipeline/export'

export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  const doc = file.endsWith('.csv') ? await getBlog(file.slice(0, -4)) : null
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'File not found' })
  setResponseHeaders(event, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${doc.slug}.csv"`,
    'x-robots-tag': 'noindex',
  })
  return datasetToCsv(doc.dataset)
})
