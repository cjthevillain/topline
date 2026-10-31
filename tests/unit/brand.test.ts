import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { headingCase, truncateAtSentence } from '#shared/copy/text'
import { analyseCsv } from '#shared/pipeline/analyse'
import { buildDocument, headlineTile, summarise } from '#shared/pipeline/document'
import { templateCopy } from '#shared/copy/template'
import { OG_FONT_FILES, renderOgImage } from '../../server/utils/ogImage'

const CSV = 'Company,Region,Funding\nAlpha,London,£3m\nBeta,Leeds,£2m\nGamma,Bristol,£1m\n'
const analyse = (csv: string, topic = '') => analyseCsv(new TextEncoder().encode(csv), { fileName: 'list.csv', topic })

describe('topics', () => {
  it('keeps a place name capitalised', () => {
    expect(analyse(CSV, 'London fintech').context.topic).toBe('London fintech')
    expect(analyse(CSV, 'london fintech').context.topic).toBe('London fintech')
  })

  it('keeps a capital that sits beside lower-case words', () => {
    expect(analyse(CSV, 'Berlin fintech').context.topic).toBe('Berlin fintech')
  })

  it('still lower-cases an ordinary topic', () => {
    expect(analyse(CSV, 'Fintech').context.topic).toBe('fintech')
    expect(analyse(CSV, 'Health Tech').context.topic).toBe('health tech')
  })
})

describe('headline case', () => {
  it('capitalises a sentence-case heading', () => {
    expect(headingCase('Top 78 UK seed-stage London fintech companies by total raised')).toBe('Top 78 UK Seed-Stage London Fintech Companies by Total Raised')
  })

  it('leaves names alone', () => {
    expect(headingCase('why McKinsey and iPhone stay')).toBe('Why McKinsey and iPhone Stay')
  })
})

describe('summaries', () => {
  const text = 'See which 22 companies have raised the most, with totals, locations and team sizes across the full list. Explore the full ranking and find out who leads it today.'

  it('leaves text that fits', () => {
    expect(truncateAtSentence('Short enough.', 160)).toBe('Short enough.')
  })

  it('stops at the end of a sentence', () => {
    expect(truncateAtSentence(text, 158)).toBe('See which 22 companies have raised the most, with totals, locations and team sizes across the full list.')
  })

  it('falls back to a word when the first sentence is too long', () => {
    const long = `${'word '.repeat(40).trim()}.`
    expect(truncateAtSentence(long, 158).endsWith('word')).toBe(true)
  })
})

describe('the headline figure', () => {
  const pageFrom = (csv: string) => {
    const analysis = analyse(csv)
    return buildDocument(analysis, { copy: templateCopy({ dataset: analysis.dataset, insights: analysis.insights, context: analysis.context }), mode: 'template', provider: null, model: null, notes: [] }, 'slug', 'list.csv', '2026-10-31T00:00:00.000Z', false)
  }

  it('is the combined total when one exists', () => {
    const doc = pageFrom(CSV)
    expect(headlineTile(doc).id).toBe('total')
    expect(summarise(doc).headline?.value).toBe('£6m')
    expect(summarise(doc).rankedBy).toBe('funding')
  })

  it('is the company count when there is nothing to add up', () => {
    const doc = pageFrom('Company,Region\nAlpha,London\nBeta,Leeds\nGamma,Bristol\n')
    expect(headlineTile(doc).id).toBe('count')
    expect(summarise(doc).headline).toBeUndefined()
    expect(summarise(doc).rankedBy).toBeNull()
  })
})

describe('sharing image', () => {
  const fonts = OG_FONT_FILES.map(({ file, weight }) => ({
    name: 'Archivo' as const,
    weight,
    style: 'normal' as const,
    data: readFileSync(new URL(`../../server/assets/og/${file}`, import.meta.url)),
  }))

  it('draws a PNG at the size sharing cards expect', async () => {
    const png = await renderOgImage({ title: 'Top 3 Companies by Funding', figure: '£6m', label: 'Combined funding', note: '3 companies' }, fonts)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })

  it('copes with a very long title and accented names', async () => {
    const png = await renderOgImage({ title: `Żółć ${'Very Long Company Ranking Title '.repeat(12)}`, figure: '£1,234,567.8m', label: 'Combined funding', note: '1,000 companies' }, fonts)
    expect(png.length).toBeGreaterThan(1000)
  })
})
