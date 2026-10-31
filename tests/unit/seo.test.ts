import { describe, expect, it } from 'vitest'
import { datasetToCsv } from '#shared/pipeline/export'
import { buildLlmsTxt, buildRss, escapeXml } from '#shared/seo/feed'
import { buildJsonLd, collectionJsonLd, siteJsonLd } from '#shared/seo/jsonld'
import type { BlogDocument, BlogSummary, Dataset } from '#shared/types/blog'
import fintech from '../../content/top-100-uk-seed-stage-fintech-companies-by-total-raised.json'

const doc = fintech as unknown as BlogDocument
const ORIGIN = 'https://example.com'

const summary: BlogSummary = {
  slug: 'top-3-a-b-companies',
  title: 'Top 3 <A&B> companies',
  description: 'Cats & dogs',
  rows: 3,
  topic: 'a&b',
  generatedAt: '2026-10-31T10:00:00.000Z',
  seeded: false,
  mode: 'llm',
}

describe('structured data', () => {
  it('names one organisation that the website points back to', () => {
    const [organisation, website] = siteJsonLd(ORIGIN) as Record<string, any>[]
    expect(organisation!['@type']).toBe('Organization')
    expect(website!.publisher['@id']).toBe(organisation!['@id'])
    expect(website!.potentialAction.target.urlTemplate).toContain('/blog?q={search_term_string}')
  })

  it('gives a ranking page article, list, breadcrumb, FAQ and dataset blocks', () => {
    const types = buildJsonLd(doc, ORIGIN).map(block => (block as { '@type': string })['@type'])
    expect(types).toEqual(['BlogPosting', 'ItemList', 'BreadcrumbList', 'FAQPage', 'Dataset'])
  })

  it('counts the words in the copy, not in the data', () => {
    const [article] = buildJsonLd(doc, ORIGIN) as { wordCount: number }[]
    expect(article!.wordCount).toBeGreaterThan(100)
    expect(article!.wordCount).toBeLessThan(2000)
  })

  it('links the dataset to its download', () => {
    const dataset = buildJsonLd(doc, ORIGIN).at(-1) as { distribution: { contentUrl: string } }
    expect(dataset.distribution.contentUrl).toBe(`${ORIGIN}/data/${doc.slug}.csv`)
  })

  it('lists every ranking in the collection page', () => {
    const page = collectionJsonLd([summary], ORIGIN) as { mainEntity: { numberOfItems: number } }
    expect(page.mainEntity.numberOfItems).toBe(1)
  })
})

describe('feeds', () => {
  it('escapes all five XML characters', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;')
  })

  it('writes a valid item with an RFC 822 date', () => {
    const rss = buildRss([summary], ORIGIN)
    expect(rss).toContain('<title>Top 3 &lt;A&amp;B&gt; companies</title>')
    expect(rss).toContain('<pubDate>Sat, 31 Oct 2026 10:00:00 GMT</pubDate>')
    expect(rss).toContain(`<guid isPermaLink="true">${ORIGIN}/blog/${summary.slug}</guid>`)
  })

  it('puts the newest page first, whatever order it is given', () => {
    const older = { ...summary, slug: 'older', generatedAt: '2025-01-01T00:00:00.000Z' }
    const rss = buildRss([older, summary], ORIGIN)
    expect(rss.indexOf(summary.slug)).toBeLessThan(rss.indexOf('/blog/older'))
  })

  it('still builds with no pages', () => {
    expect(buildRss([], ORIGIN)).toContain('</channel>')
    expect(buildLlmsTxt([], ORIGIN)).toContain('## Rankings')
  })
})

describe('csv download', () => {
  const dataset: Dataset = {
    metric: { header: 'Funding', label: 'funding', kind: 'money', currency: '£' },
    columns: [{ id: 'c1', header: 'Region', kind: 'text' }, { id: 'c2', header: 'Tags', kind: 'tags' }],
    rows: [
      { rank: 1, name: '=HYPERLINK("http://x","y")', url: null, description: 'Says "hi", twice', metric: 100, cells: { c1: '+44', c2: ['A', 'B'] } },
      { rank: 2, name: 'Plain', url: 'https://plain.example', description: null, metric: null, cells: { c1: null, c2: null } },
    ],
    constants: [],
    stats: { rowsInFile: 2, rowsUsed: 2, rowsDropped: 0, missingMetric: 1 },
    warnings: [],
  }
  const lines = datasetToCsv(dataset).replace('\uFEFF', '').trim().split('\r\n')

  it('starts with a byte order mark and the headers', () => {
    expect(datasetToCsv(dataset).startsWith('\uFEFF')).toBe(true)
    expect(lines[0]).toBe('Rank,Name,Funding,Region,Tags,Website,Description')
  })

  it('stops a cell running as a formula in a spreadsheet', () => {
    expect(lines[1]).toContain('"\'=HYPERLINK(""http://x"",""y"")"')
    expect(lines[1]).toContain(',\'+44,')
  })

  it('leaves numbers, even negative ones, as numbers', () => {
    const negative = { ...dataset, rows: [{ ...dataset.rows[1]!, metric: -5 }] }
    expect(datasetToCsv(negative)).toContain(',-5,')
  })

  it('quotes commas and doubles quotes', () => {
    expect(lines[1]).toContain('"Says ""hi"", twice"')
  })

  it('writes missing values as empty cells', () => {
    expect(lines[2]).toBe('2,Plain,,,,https://plain.example,')
  })

  it('round-trips the real dataset with one row per company', () => {
    expect(datasetToCsv(doc.dataset).trim().split('\r\n')).toHaveLength(doc.dataset.rows.length + 1)
  })
})
