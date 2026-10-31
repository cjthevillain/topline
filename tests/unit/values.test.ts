import { describe, expect, it } from 'vitest'
import { formatCompact, isBand, isMissing, parseNumberish, parseUrl, parseYear } from '#shared/pipeline/values'
import { normaliseProse, slugify, titleCase } from '#shared/copy/text'
import { ordinal } from '#shared/ui/format'

describe('parseNumberish', () => {
  it.each<[string, number, string?]>([
    ['£30,314,247', 30314247, '£'],
    ['$1.2m', 1200000, '$'],
    ['€3bn', 3e9, '€'],
    ['1.5 million', 1500000],
    ['£900k', 900000, '£'],
    ['GBP 2,500', 2500, '£'],
    ['2500 USD', 2500, '$'],
    ['3.03E+07', 30300000],
    ['(1,000)', -1000],
    ['-4', -4],
    ['1.234,56', 1234.56],
    ['1.234.567', 1234567],
    ['1,5', 1.5],
    ['~£5m', 5000000, '£'],
    ['£5m+', 5000000, '£'],
    ['c. £2m', 2000000, '£'],
    ['12 345', 12345],
  ])('%s', (raw, value, currency) => {
    const parsed = parseNumberish(raw)
    expect(parsed?.value).toBeCloseTo(value)
    expect(parsed?.currency).toBe(currency)
  })

  it('reads percentages', () => expect(parseNumberish('12.5%')).toMatchObject({ value: 12.5, percent: true }))

  it.each(['abc', 'abc123', '£1m to £2m', '£1m-£2m', '12 apples', '1,2,3', ''])('rejects %s', (raw) => {
    expect(parseNumberish(raw)).toBeNull()
  })
})

describe('other values', () => {
  it('knows missing markers', () => {
    for (const v of ['', ' ', 'N/A', 'na', '-', '\u2013', 'None', 'null', 'Unknown', 'TBC', '#N/A']) expect(isMissing(v)).toBe(true)
    for (const v of ['0', 'No', 'Nano']) expect(isMissing(v)).toBe(false)
  })

  it('knows bands', () => {
    for (const v of ['10-24', '<5', '250 to 499', '1000+', '1,000-4,999']) expect(isBand(v)).toBe(true)
    for (const v of ['10', 'ten', '2019']) expect(isBand(v)).toBe(false)
  })

  it('only allows web links', () => {
    expect(parseUrl('example.com')).toBe('https://example.com/')
    expect(parseUrl('http://a.example/x')).toBe('http://a.example/x')
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'not a url', 'mailto:a@b.co', 'localhost']) expect(parseUrl(v)).toBeNull()
  })

  it('reads years', () => {
    expect(parseYear('2015-06-01')).toBe(2015)
    expect(parseYear('not sure')).toBeNull()
  })

  it('formats compactly', () => {
    expect(formatCompact(622301270, '£')).toBe('£622.3m')
    expect(formatCompact(1200000000, '$')).toBe('$1.2bn')
    expect(formatCompact(2000000, '£')).toBe('£2m')
    expect(formatCompact(45000)).toBe('45k')
  })
})

describe('text helpers', () => {
  it('title-cases', () => expect(titleCase('top 100 UK seed-stage fintech')).toBe('Top 100 UK Seed-Stage Fintech'))
  it('slugifies', () => expect(slugify('Top 10: Café & Co!')).toBe('top-10-cafe-and-co'))
  it('removes dashes and Markdown', () => {
    expect(normaliseProse('Top \u2014 **bold** 5\u201310')).toBe('Top, bold 5 to 10')
  })
})

describe('ordinal', () => {
  it.each<[number, string]>([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [100, '100th'], [101, '101st'], [111, '111th'], [1000, '1000th'],
  ])('writes %i as %s', (value, expected) => {
    expect(ordinal(value)).toBe(expected)
  })
})
