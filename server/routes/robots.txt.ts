export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /data/\n\nSitemap: ${siteOrigin(event)}/sitemap.xml\n`
})
