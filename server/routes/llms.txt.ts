import { buildLlmsTxt } from '#shared/seo/feed'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return buildLlmsTxt(await listBlogs(), siteOrigin(event))
})
