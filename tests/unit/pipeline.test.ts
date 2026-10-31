import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyseCsv } from '#shared/pipeline/analyse'
import { PipelineFailure } from '#shared/pipeline/errors'
import { templateCopy } from '#shared/copy/template'
import { reviewCopy } from '#shared/copy/validate'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
const run = (name: string, topic?: string) => analyseCsv(fixture(name), { fileName: name, topic })
const bytes = (text: string) => new TextEncoder().encode(text)
const failure = (input: Uint8Array) => {
  try {
    analyseCsv(input, { fileName: 'x.csv' })
  }
  catch (error) {
    if (error instanceof PipelineFailure) return error
    throw error
  }
  throw new Error('expected a failure')
}
const codes = (a: ReturnType<typeof run>) => a.dataset.warnings.map(w => w.code)
const names = (a: ReturnType<typeof run>) => a.dataset.rows.map(r => r.name)

describe('the real fintech file', () => {
  const a = analyseCsv(readFileSync(new URL('../../data/uk-fintech-seed-top-100.csv', import.meta.url)), { fileName: 'uk-fintech-seed-top-100.csv', topic: 'fintech' })

  it('keeps all 100 rows in rank order with no warnings', () => {
    expect(a.dataset.rows).toHaveLength(100)
    expect(a.dataset.rows[0]).toMatchObject({ rank: 1, name: 'Nevis', metric: 30314247 })
    expect(a.dataset.rows[99]).toMatchObject({ rank: 100, name: 'Ledger Rocket', metric: 2000000 })
    expect(a.dataset.warnings).toEqual([])
  })

  it('computes statistics that match the file', () => {
    expect(a.insights.tiles.find(t => t.id === 'total')?.value).toBe('£622.3m')
    expect(a.insights.tiles.find(t => t.id === 'region')?.value).toBe('78%')
  })

  it('states that every company is seed stage', () => {
    expect(a.context).toEqual({ topic: 'fintech', geography: 'UK', qualifier: 'seed-stage' })
    expect(templateCopy(a).h1).toBe('Top 100 UK Seed-Stage Fintech Companies by Total Raised')
  })
})

describe('other column layouts', () => {
  it('maps different header names and a unit in the header', () => {
    const a = run('healthtech-clean.csv')
    expect(a.dataset.metric).toMatchObject({ label: 'revenue', currency: '£', kind: 'money' })
    expect(a.dataset.rows[0]!.metric).toBeGreaterThan(1e6)
    expect(a.context.topic).toBe('healthtech')
    expect(a.dataset.columns.map(c => c.role)).toContain('year')
    expect(a.dataset.rows[0]!.url).toContain('https://')
  })

  it('works with only two columns', () => {
    const a = run('ai-minimal.csv')
    expect(a.dataset.rows[0]).toMatchObject({ name: 'DeepMarrow', metric: 1.4e9 })
    expect(a.context.topic).toBe('AI')
    expect(templateCopy(a).h1).toBe('Top 5 AI Companies by Valuation')
  })

  it('makes a directory when nothing is numeric, and does not claim the UK', () => {
    const a = run('edtech-directory.csv')
    expect(a.dataset.metric).toBeNull()
    expect(codes(a)).toContain('no_metric')
    expect(a.context.geography).toBe('')
    expect(templateCopy(a).h1).toBe('4 Edtech Companies to Know')
    expect(a.dataset.columns.find(c => c.role === 'category')?.kind).toBe('tags')
  })

  it('reads tabs, recalculates bad ranks and refuses to mix currencies', () => {
    const a = run('retailtech-tabs.tsv')
    expect(a.dataset.rows[0]!.name).toBe('Shopora')
    expect(a.dataset.rows.find(r => r.name === 'Basketry')!.metric).toBeNull()
    expect(names(a).at(-1)).toBe('Basketry')
    expect(codes(a)).toEqual(expect.arrayContaining(['mixed_currency', 'rank_recalculated']))
  })

  it('reads Windows-1252 files from Excel without corrupting the pound sign', () => {
    const a = run('proptech-cp1252.csv')
    expect(a.dataset.rows[0]!.metric).toBe(4200000)
    expect(a.dataset.metric?.currency).toBe('£')
  })

  it('handles a file with no header row', () => {
    const a = run('headerless.csv')
    expect(a.dataset.rows).toHaveLength(4)
    expect(a.dataset.rows[0]).toMatchObject({ name: 'Alpha Foods', metric: 1500000 })
    expect(codes(a)).toContain('no_header')
  })

  it('finds the name column when it is not first, and sorts unsorted data', () => {
    const a = run('agritech-unsorted.csv')
    expect(names(a)).toEqual(['BigFarm', 'MidFarm', 'SmallFarm', 'NoneFarm'])
    expect(a.dataset.rows[3]!.metric).toBeNull()
    expect(codes(a)).toEqual(expect.arrayContaining(['missing_metric', 'rank_recalculated']))
  })

  it('accepts a manual override of the ranking column', () => {
    const base = run('retailtech-tabs.tsv')
    const nps = base.profiles.find(p => p.header === 'NPS')!.index
    const a = analyseCsv(fixture('retailtech-tabs.tsv'), { fileName: 'r.tsv', overrides: { metric: nps } })
    expect(a.dataset.metric?.header).toBe('NPS')
    expect(a.dataset.rows[0]!.name).toBe('Tillr')
  })

  it('can turn the ranking column off', () => {
    const a = analyseCsv(fixture('ai-minimal.csv'), { fileName: 'a.csv', overrides: { metric: -1 } })
    expect(a.dataset.metric).toBeNull()
    expect(names(a)[0]).toBe('DeepMarrow')
  })
})

describe('bad rows', () => {
  const a = run('cleantech-messy.csv')

  it('skips the preamble and handles semicolons', () => {
    expect(a.table.delimiter).toBe(';')
    expect(codes(a)).toContain('preamble_skipped')
    expect(a.dataset.columns.find(c => c.role === 'stage')?.header).toBe('Funding Stage')
  })

  it('drops what is not a company and reports each kind', () => {
    expect(names(a)).not.toEqual(expect.arrayContaining(['Total', 'Company Name', 'Too', '']))
    expect(names(a).filter(n => n === 'SolarLoop')).toHaveLength(1)
    expect(codes(a)).toEqual(expect.arrayContaining(['no_name', 'duplicates', 'summary_rows', 'long_rows', 'repeated_header', 'short_rows', 'bad_metric', 'mixed_currency', 'bad_urls', 'missing_metric']))
  })

  it('reads mixed money formats and keeps missing values out of totals', () => {
    expect(a.dataset.rows[0]).toMatchObject({ name: 'ReCell', metric: 1.2e9 })
    expect(a.dataset.rows.find(r => r.name === 'WindKin')!.metric).toBe(900000)
    expect(a.dataset.rows.find(r => r.name === 'HeatBank')!.metric).toBe(7250000)
    expect(a.dataset.rows.find(r => r.name === 'TideWorks')!.metric).toBeNull()
  })

  it('never turns a javascript: cell into a link', () => {
    expect(a.dataset.rows.find(r => r.name === 'CarbonNest')!.url).toBeNull()
    expect(run('hostile.csv').dataset.rows.every(r => !r.url?.startsWith('javascript'))).toBe(true)
  })

  it('reports file line numbers', () => {
    expect(a.dataset.warnings.find(w => w.code === 'no_name')?.lines).toEqual([8])
  })

  it('repairs a stray quote without losing the rows after it', () => {
    const b = run('stray-quote.csv')
    expect(b.dataset.rows).toHaveLength(4)
    expect(codes(b)).toContain('quotes_repaired')
  })

  it('rejoins money split by unquoted commas', () => {
    const b = run('unquoted-thousands.csv')
    expect(b.dataset.rows.map(r => r.metric)).toEqual([12500000, 1000000, 750000, 90000])
    expect(codes(b)).toContain('split_numbers')
  })
})

describe('files that cannot be used', () => {
  it.each([
    ['empty', bytes(''), 'empty_file'],
    ['blank lines', bytes('\n\n  \n'), 'empty_file'],
    ['header only', bytes('Company,Funding\n'), 'too_few_rows'],
    ['too few rows', bytes('Company,Funding\nA Ltd,£1m\nB Ltd,£2m\n'), 'too_few_rows'],
    ['one column', bytes('Company\nA\nB\nC\n'), 'one_column'],
    ['Excel', bytes('PK\u0003\u0004rest'), 'excel_file'],
    ['PDF', bytes('%PDF-1.7 x'), 'pdf_file'],
    ['HTML', bytes('<!doctype html><html></html>'), 'html_file'],
    ['binary', new Uint8Array([1, 2, 0, 4, 5]), 'binary_file'],
    ['numbers only', bytes('a,b\n1,2\n3,4\n5,6\n'), 'no_name_column'],
    ['too many rows', bytes(`Company,Funding\n${Array.from({ length: 1001 }, (_, i) => `Co ${i},${i}`).join('\n')}`), 'too_many_rows'],
    ['too large', new Uint8Array(2 * 1024 * 1024 + 1).fill(97), 'file_too_large'],
  ])('%s', (_name, input, code) => {
    const error = failure(input)
    expect(error.code).toBe(code)
    expect(error.message.length).toBeGreaterThan(10)
    expect(error.hint.length).toBeGreaterThan(10)
  })

  it('explains a ranking column with nothing readable in it', () => {
    const input = bytes('Company,Funding\nA Ltd,£1m\nB Ltd,£2m\nC Ltd,£3m\n')
    const error = (() => {
      try {
        analyseCsv(input, { fileName: 'x.csv', overrides: { metric: 0, name: 1 } })
      }
      catch (e) {
        return e as PipelineFailure
      }
    })()
    expect(error?.code).toBe('metric_unreadable')
  })
})

describe('template copy works for every fixture', () => {
  const files = ['healthtech-clean.csv', 'cleantech-messy.csv', 'ai-minimal.csv', 'edtech-directory.csv', 'retailtech-tabs.tsv', 'proptech-cp1252.csv', 'headerless.csv', 'hostile.csv', 'stray-quote.csv', 'unquoted-thousands.csv', 'agritech-unsorted.csv']

  it.each(files)('%s', (name) => {
    const a = run(name)
    const copy = templateCopy(a)
    expect(copy.title.length).toBeLessThanOrEqual(70)
    expect(copy.metaDescription.length).toBeGreaterThanOrEqual(50)
    expect(copy.metaDescription.length).toBeLessThanOrEqual(160)
    expect(copy.sections.length).toBeGreaterThanOrEqual(1)
    expect(copy.faq.length).toBeGreaterThanOrEqual(1)
    const text = JSON.stringify(copy)
    expect(text).not.toMatch(/[\u2013\u2014]/)
    expect(text).not.toMatch(/undefined|null|NaN|\[object/)
    // The template must pass the same checks as an LLM, or the fallback could quote bad figures.
    const year = new Date().getUTCFullYear()
    const review = reviewCopy({ ...copy, title: copy.title.padEnd(21, ' x') }, a.insights.allowedNumbers, year)
    expect(review.problems.filter(p => p.includes('figures'))).toEqual([])
  })
})
