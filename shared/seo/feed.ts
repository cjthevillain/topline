import { BRAND } from '../brand'
import type { BlogSummary } from '../types/blog'

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]!)
}

/** RSS 2.0, newest first, because the store lists seeded pages before uploads. */
export function buildRss(blogs: BlogSummary[], origin: string): string {
  const newest = [...blogs].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
  const items = newest.map((blog) => {
    const url = `${origin}/blog/${blog.slug}`
    return [
      '    <item>',
      `      <title>${escapeXml(blog.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${new Date(blog.generatedAt).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(blog.description)}</description>`,
      '    </item>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(`${BRAND.name} rankings`)}</title>`,
    `    <link>${escapeXml(`${origin}/blog`)}</link>`,
    `    <description>${escapeXml(BRAND.tagline)}</description>`,
    '    <language>en-gb</language>',
    `    <atom:link href="${escapeXml(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...(newest[0] ? [`    <lastBuildDate>${new Date(newest[0].generatedAt).toUTCString()}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

/** A plain summary for AI search tools, in the format proposed at llmstxt.org. */
export function buildLlmsTxt(blogs: BlogSummary[], origin: string): string {
  return [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.description}`,
    '',
    '## Rankings',
    '',
    ...blogs.map(blog => `- [${blog.title}](${origin}/blog/${blog.slug}): ${blog.description}`),
    '',
    '## About',
    '',
    `- [How it works](${origin}/how-it-works): how the figures are calculated and how the copy is checked.`,
    '',
  ].join('\n')
}
