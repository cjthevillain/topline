import type { AllowedNumbers } from '../types/blog'
import { parseNumberish } from '../pipeline/values'

const PERCENT_TOLERANCE = 0.6
/** "Top 10", "three of the five" and similar are harmless list language. */
const SMALL_NUMBER = 20

const TOKEN = /(?:[£$€]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent\b|bn\b|billion\b|m\b|mn\b|million\b|k\b|thousand\b))?/gi

/** Returns the figures in `text` that the dataset cannot support. */
export function findUngroundedNumbers(text: string, allowed: AllowedNumbers, extraYears: number[] = []): string[] {
  const bad: string[] = []
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0].trim().replace(/,$/, '')
    if (!isSupported(token, allowed, extraYears)) bad.push(token)
  }
  return bad
}

function isSupported(token: string, allowed: AllowedNumbers, extraYears: number[]): boolean {
  const isPercent = /%|percent/i.test(token)
  const parsed = parseNumberish(token.replace(/\s?percent/i, '%').replace(/\s(?=bn|billion|m\b|mn|million|k\b|thousand)/i, ''))
  if (!parsed) return false
  const { value } = parsed
  if (isPercent) return allowed.percents.some(p => Math.abs(p - value) <= PERCENT_TOLERANCE)

  const hasUnit = Boolean(parsed.currency) || /[a-z]/i.test(token)
  if (hasUnit) {
    const margin = roundingStep(token) / 2
    return allowed.money.some(m => Math.abs(m - value) <= margin)
  }

  if (Number.isInteger(value) && value <= SMALL_NUMBER) return true
  if (extraYears.includes(value)) return true
  return allowed.plain.includes(value) || allowed.money.some(m => m === value)
}

/** `£3.4m` is honest for 3.35m but `£600m` is not for 622m: rounding is judged at the stated precision. */
function roundingStep(token: string): number {
  const decimals = /\.(\d+)/.exec(token)?.[1]?.length ?? 0
  const unit = /bn|billion/i.test(token) ? 1e9 : /m\b|mn|million/i.test(token) ? 1e6 : /k\b|thousand/i.test(token) ? 1e3 : 1
  return unit / 10 ** decimals
}
