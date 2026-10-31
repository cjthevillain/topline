import { STATIC_PAGES } from '#shared/brand'
import { escapeXml } from '#shared/seo/feed'

export default defineEventHandler(async (event) => {
  const origin = siteOrigin(event)
  const blogs = await listBlogs()
  const newest = blogs.map(b => b.generatedAt).sort().at(-1)
  const urls = [
    ...STATIC_PAGES.map(path => ({ loc: `${origin}${path}`, lastmod: path === '/' || path === '/blog' ? newest : undefined })),
    ...blogs.map(b => ({ loc: `${origin}/blog/${b.slug}`, lastmod: b.generatedAt })),
  ]
  const body = urls
    .map(u => `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=0, s-maxage=300')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
})
