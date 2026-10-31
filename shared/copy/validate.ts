import type { AllowedNumbers, BlogCopy, BlogSection, FaqItem } from '../types/blog'
import { findUngroundedNumbers } from './grounding'
import { normaliseProse, truncateAtWord } from './text'

export interface CopyReview {
  /** Fields that passed. Anything absent falls back to the template. */
  accepted: Partial<BlogCopy>
  problems: string[]
}

const FORBIDDEN = /<[a-z!/][^>]*>|https?:\/\/|www\./i
/** The data is one snapshot, so it cannot show change over time or how a sector is feeling. */
const UNSUPPORTED_CLAIM = /\b(?:in recent years|recent growth|year[- ]on[- ]year|significant growth|rapid(?:ly)?|booming|thriving|surging|skyrocket\w*|revolution\w*|game[- ]chang\w*)\b/i

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? normaliseProse(value) : null
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap(v => text(v) ?? []) : []
}

/**
 * Treats the LLM reply as untrusted input. Each field is checked on its own, so
 * one invented figure costs that section, not the whole page.
 */
export function reviewCopy(reply: unknown, allowed: AllowedNumbers, currentYear: number): CopyReview {
  const accepted: Partial<BlogCopy> = {}
  const problems: string[] = []
  if (typeof reply !== 'object' || reply === null) return { accepted, problems: ['The reply was not a JSON object.'] }
  const raw = reply as Record<string, unknown>

  const clean = (field: string, value: string): boolean => {
    if (FORBIDDEN.test(value)) {
      problems.push(`${field} contains HTML or a link.`)
      return false
    }
    const claim = UNSUPPORTED_CLAIM.exec(value)
    if (claim) {
      problems.push(`${field} says "${claim[0]}", which a single snapshot of data cannot support.`)
      return false
    }
    const bad = findUngroundedNumbers(value, allowed, [currentYear])
    if (bad.length) {
      problems.push(`${field} uses figures that are not in the facts: ${bad.join(', ')}.`)
      return false
    }
    return true
  }

  const title = text(raw.title)
  if (title && title.length >= 20 && title.length <= 70 && clean('title', title)) accepted.title = title
  else if (!title || title.length < 20 || title.length > 70) problems.push(`title must be 30 to 65 characters, got ${title?.length ?? 0}.`)

  const h1 = text(raw.h1)
  if (h1 && h1.length <= 90 && clean('h1', h1)) accepted.h1 = h1

  const meta = text(raw.metaDescription)
  if (meta && meta.length >= 100 && meta.length <= 175) {
    if (clean('metaDescription', meta)) accepted.metaDescription = truncateAtWord(meta, 160)
  }
  else problems.push(`metaDescription must be 120 to 158 characters, got ${meta?.length ?? 0}.`)

  const intro = strings(raw.intro).slice(0, 3)
  if (intro.length && intro.every(p => clean('intro', p))) accepted.intro = intro
  else if (!intro.length) problems.push('intro is missing.')

  const sections: BlogSection[] = []
  for (const [i, section] of (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 6).entries()) {
    const heading = text((section as BlogSection)?.heading)
    const paragraphs = strings((section as BlogSection)?.paragraphs).slice(0, 3)
    if (heading && heading.length <= 90 && paragraphs.length && clean(`sections[${i}]`, [heading, ...paragraphs].join(' '))) {
      sections.push({ heading, paragraphs })
    }
  }
  if (sections.length >= 2) accepted.sections = sections
  else problems.push('At least 2 usable sections are needed.')

  const faq: FaqItem[] = []
  for (const [i, item] of (Array.isArray(raw.faq) ? raw.faq : []).slice(0, 6).entries()) {
    const question = text((item as FaqItem)?.question)
    const answer = text((item as FaqItem)?.answer)
    if (question && answer && clean(`faq[${i}]`, `${question} ${answer}`)) faq.push({ question, answer })
  }
  if (faq.length >= 2) accepted.faq = faq
  else problems.push('At least 2 usable FAQ items are needed.')

  const keywords = strings(raw.keywords).filter(k => k.length <= 60 && !FORBIDDEN.test(k)).slice(0, 8)
  if (keywords.length) accepted.keywords = keywords

  return { accepted, problems }
}

/** Valid LLM fields over the template. Returns which mode the page ended up in. */
export function mergeCopy(accepted: Partial<BlogCopy>, fallback: BlogCopy): { copy: BlogCopy; complete: boolean; used: number } {
  const fields = ['title', 'h1', 'metaDescription', 'intro', 'sections', 'faq'] as const
  const used = fields.filter(f => accepted[f] !== undefined).length
  return { copy: { ...fallback, ...accepted }, complete: used === fields.length, used }
}
