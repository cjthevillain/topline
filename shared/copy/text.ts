const SMALL_WORDS = new Set(['a', 'an', 'and', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase()
      if (/[A-Z]{2,}/.test(word) || /\d/.test(word)) return word
      return word
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('-')
    })
    .join(' ')
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '')
}

/** Copy style rule for this site: no em or en dashes, and plain text only. */
export function normaliseProse(text: string): string {
  return text
    .replace(/\*\*|__|`/g, '')
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Capitalises lower-case words only, so names such as McKinsey or iPhone stay as they were written. */
export function headingCase(text: string): string {
  return text
    .split(' ')
    .map((word, i) => {
      if (word !== word.toLowerCase()) return word
      if (i > 0 && SMALL_WORDS.has(word)) return word
      return word.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-')
    })
    .join(' ')
}

export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1)
  const end = cut.lastIndexOf(' ')
  return `${(end > 0 ? cut.slice(0, end) : cut.slice(0, max)).replace(/[,;:]$/, '')}`
}

/** Cuts to the last whole sentence that fits, so a summary never stops mid-thought. Long sentences fall back to a word boundary. */
export function truncateAtSentence(text: string, max: number, min = 100): string {
  if (text.length <= max) return text
  const end = text.lastIndexOf('. ', max - 1)
  return end >= min ? text.slice(0, end + 1) : truncateAtWord(text, max)
}
