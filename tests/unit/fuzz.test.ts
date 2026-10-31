import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { reviewCopy } from '#shared/copy/validate'
import { templateCopy } from '#shared/copy/template'
import { analyseCsv } from '#shared/pipeline/analyse'
import { PipelineFailure } from '#shared/pipeline/errors'
import { baseSlug } from '#shared/pipeline/document'

/** Small seeded generator, so a failure can be replayed from its seed. */
function randomFrom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const source = Papa.parse<string[]>(readFileSync(new URL('../../data/uk-fintech-seed-top-100.csv', import.meta.url), 'utf8').trim()).data
const RENAMES: Record<string, string[]> = {
  Rank: ['#', 'Position', 'No.', 'Rank'],
  Company: ['Name', 'Business', 'Organisation', 'Company name'],
  Region: ['Location', 'City', 'HQ', 'Area'],
  Stage: ['Funding stage', 'Round', 'Stage'],
  Employees: ['Staff', 'Headcount', 'Team size'],
  'Total Raised': ['Funding', 'Total funding', 'Amount raised', 'Investment', 'Revenue (£m)'],
  Description: ['About', 'Summary', 'Overview'],
  Website: ['URL', 'Site', 'Homepage'],
  Industries: ['Sectors', 'Tags', 'Categories'],
}
const JUNK = ['', 'N/A', '-', 'unknown', '???', '<b>x</b>', '=SUM(A1:A9)', '£', '1e999', '0', '-5', '٣', '🚀', '"', 'null', 'a'.repeat(3000)]

function mutate(seed: number) {
  const random = randomFrom(seed)
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]!
  const headers = source[0]!
  const keep = headers.map((_, i) => i).filter(() => random() > 0.25)
  const rows = source.slice(1, 3 + Math.floor(random() * 98)).map(r => [...r])
  if (random() > 0.5) rows.sort(() => random() - 0.5)
  const header = keep.map(i => (random() > 0.3 ? pick(RENAMES[headers[i]!]!) : headers[i]!))
  const cells = rows.map(row => keep.map((i) => {
    const roll = random()
    if (roll < 0.1) return ''
    if (roll < 0.15) return pick(JUNK)
    return row[i]!
  }))
  const delimiter = pick([',', ';', '\t', '|'])
  return Papa.unparse([header, ...cells], { delimiter })
}

describe('randomly damaged versions of the real file', () => {
  it('always gives a usable page or a clear error, and never crashes', () => {
    let pages = 0
    const failures = new Map<string, number>()
    for (let seed = 1; seed <= 400; seed++) {
      const csv = mutate(seed)
      try {
        const analysis = analyseCsv(new TextEncoder().encode(csv), { fileName: `seed-${seed}.csv` })
        const copy = templateCopy(analysis)
        const text = JSON.stringify(copy)
        expect(text, `seed ${seed}`).not.toMatch(/undefined|NaN|\[object|Infinity/)
        expect(copy.title.length, `seed ${seed}`).toBeLessThanOrEqual(70)
        expect(copy.metaDescription.length, `seed ${seed}`).toBeLessThanOrEqual(160)
        expect(baseSlug(analysis), `seed ${seed}`).toMatch(/^[a-z\d-]+$/)
        expect(analysis.dataset.rows.map(r => r.rank), `seed ${seed}`).toEqual(analysis.dataset.rows.map((_, i) => i + 1))
        const review = reviewCopy(copy, analysis.insights.allowedNumbers, new Date().getUTCFullYear())
        expect(review.problems.filter(p => p.includes('figures')), `seed ${seed}`).toEqual([])
        pages += 1
      }
      catch (error) {
        if (!(error instanceof PipelineFailure)) throw new Error(`seed ${seed}: ${(error as Error).stack}`)
        failures.set(error.code, (failures.get(error.code) ?? 0) + 1)
      }
    }
    console.log('pages', pages, Object.fromEntries(failures))
    expect(pages).toBeGreaterThan(300)
  })
})

it('reads a new industry in the same format as the fintech file', () => {
  const csv = readFileSync(new URL('../../data/uk-fintech-seed-top-100.csv', import.meta.url))
  const analysis = analyseCsv(csv, { fileName: 'Top 100 UK Healthtech Companies.csv' })
  expect(analysis.context.topic).toBe('healthtech')
  expect(analysis.context.geography).toBe('UK')
  expect(templateCopy(analysis).h1).toContain('Healthtech')
})
