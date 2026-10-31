/** Reading and formatting single cell values. Pure, so it runs on server and client. */

const MISSING = new Set([
  '', '-', '--', '---', '\u2013', '\u2014', '?', '.', 'n/a', 'na', 'n.a.', 'n.a', 'none', 'null', 'nil',
  'nan', 'unknown', 'undisclosed', 'not disclosed', 'not available', 'not known', 'tbc', 'tba', 'tbd', '#n/a', '#ref!', '#value!',
])

export function isMissing(raw: string | null | undefined): boolean {
  return raw === null || raw === undefined || MISSING.has(raw.trim().toLowerCase())
}

export interface ParsedNumber {
  value: number
  currency?: string
  percent: boolean
}

const CURRENCY_CODES: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
const UNITS: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mn: 1e6, mm: 1e6, mil: 1e6, million: 1e6, millions: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9, billions: 1e9,
}

/**
 * Reads `£30,314,247`, `$1.2m`, `€3bn`, `1.5 million`, `12%`, `3.03E+07`,
 * `(1,000)`, `1.234,56` and `~£5m+`. Returns null for anything else, which
 * includes ranges such as `£1m to £2m`: guessing a midpoint would invent a figure.
 */
export function parseNumberish(raw: string): ParsedNumber | null {
  let text = raw.trim()
  if (!text) return null

  let negative = false
  const bracketed = /^\((.*)\)$/.exec(text)
  if (bracketed) {
    negative = true
    text = bracketed[1]!.trim()
  }
  text = text.replace(/^(?:~|≈|>=?|<=?|c\.|ca\.|circa|approx\.?|about|over|around)\s*/i, '')
  text = text.replace(/\s*(?:\+|\(?est\.?\)?|\(?estimated\)?)$/i, '')
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = !negative
    text = text.slice(1).trim()
  }

  let currency: string | undefined
  const symbol = /^(£|\$|€)\s*/.exec(text)
  if (symbol) {
    currency = symbol[1]
    text = text.slice(symbol[0].length)
  }
  else {
    const code = /^(GBP|USD|EUR)\s*/i.exec(text) ?? /\s*(GBP|USD|EUR)$/i.exec(text)
    if (code) {
      currency = CURRENCY_CODES[code[1]!.toUpperCase()]
      text = text.replace(code[0], '')
    }
  }

  const percent = text.endsWith('%')
  if (percent) text = text.slice(0, -1).trim()

  const match = /^([\d.,\s]*\d(?:[.,]\d+)?(?:e[+-]?\d+)?)\s*([a-z]*)\.?$/i.exec(text)
  if (!match) return null
  const unitWord = match[2]!.toLowerCase()
  if (unitWord && !(unitWord in UNITS)) return null

  const digits = normaliseSeparators(match[1]!.replace(/\s/g, ''))
  if (digits === null) return null
  const value = Number(digits)
  if (!Number.isFinite(value)) return null

  const scaled = value * (unitWord ? UNITS[unitWord]! : 1)
  return { value: negative ? -scaled : scaled, currency, percent }
}

function normaliseSeparators(text: string): string | null {
  if (/e/i.test(text)) return text
  const dots = (text.match(/\./g) ?? []).length
  const commas = (text.match(/,/g) ?? []).length
  if (dots && commas) {
    // Whichever separator comes last is the decimal point.
    return text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '')
  }
  if (commas) {
    if (commas === 1 && !/,\d{3}$/.test(text)) return text.replace(',', '.')
    return /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : null
  }
  if (dots > 1) return /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : null
  return text
}

/** A size band such as `10-24`, `<5`, `1000+`, `250 to 499`. */
export function isBand(raw: string): boolean {
  return /^(?:\d[\d,]*\s*(?:-|\u2013|\u2014|to)\s*\d[\d,]*|[<>]=?\s*\d[\d,]*|\d[\d,]*\s*\+)$/i.test(raw.trim())
}

/** The lower bound of a band, used to put bands in a sensible order. */
export function bandOrder(raw: string): number {
  const text = raw.trim()
  const first = Number((/\d[\d,]*/.exec(text)?.[0] ?? '0').replace(/,/g, ''))
  return text.startsWith('<') ? first - 0.5 : first
}

/** Only http and https survive, so a `javascript:` cell can never become a link. */
export function parseUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text || /\s/.test(text)) return null
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text.replace(/^\/\//, '')}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.includes('.') ? url.href : null
  }
  catch {
    return null
  }
}

export function looksLikeUrl(raw: string): boolean {
  const text = raw.trim()
  return /^(?:https?:\/\/|www\.)/i.test(text) || /^[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}(?:\/\S*)?$/i.test(text)
}

export function parseYear(raw: string): number | null {
  const match = /\b(1[89]\d{2}|20\d{2})\b/.exec(raw)
  return match ? Number(match[1]) : null
}

function trimmed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

/** `£622.3m`, the compact form used in prose and tiles. */
export function formatCompact(value: number, currency = ''): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const body = abs >= 1e9
    ? `${trimmed(abs / 1e9, 2)}bn`
    : abs >= 1e6
      ? `${trimmed(abs / 1e6, 1)}m`
      : abs >= 1e4
        ? `${trimmed(abs / 1e3, 0)}k`
        : trimmed(abs, 2)
  return `${sign}${currency}${body}`
}

/** `£30,314,247`, the exact form used in the ranking table. */
export function formatExact(value: number, currency = ''): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}${currency}${Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
}

/** `1,000`, so a count reads the same everywhere on a page. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-GB')
}

export function formatPercent(value: number): string {
  return `${trimmed(value, 1)}%`
}
