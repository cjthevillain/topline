import { buildRss } from '#shared/seo/feed'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=0, s-maxage=300')
  return buildRss(await listBlogs(), siteOrigin(event))
})
