import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { BlogDocument, BlogSummary } from '#shared/types/blog'
import { summarise } from '#shared/pipeline/document'

const SLUG = /^[a-z\d]+(?:-[a-z\d]+)*$/
const LIST_LIMIT = 50

function uploads() {
  return useStorage('blogs')
}

function seeds() {
  return useStorage('assets:seed')
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= 80 && SLUG.test(slug)
}

export async function getBlog(slug: string): Promise<BlogDocument | null> {
  if (!isValidSlug(slug)) return null
  return await seeds().getItem<BlogDocument>(`${slug}.json`) ?? await uploads().getItem<BlogDocument>(`pages:${slug}.json`)
}

/** Summaries live in their own keys so listing never reads whole documents. */
export async function listBlogs(): Promise<BlogSummary[]> {
  const seedKeys = (await seeds().getKeys()).filter(k => k.endsWith('.json'))
  const seeded = await Promise.all(seedKeys.map(k => seeds().getItem<BlogDocument>(k)))
  const summaries = seeded.flatMap(doc => (doc ? [summarise(doc)] : []))

  const keys = (await uploads().getKeys('summaries')).sort().reverse().slice(0, LIST_LIMIT)
  const uploaded = await Promise.all(keys.map(k => uploads().getItem<BlogSummary>(k)))
  return [...summaries, ...uploaded.flatMap(s => (s ? [s] : []))]
    .sort((a, b) => Number(b.seeded) - Number(a.seeded) || b.generatedAt.localeCompare(a.generatedAt))
}

export async function uniqueSlug(base: string): Promise<string> {
  for (let n = 1; n < 500; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!await getBlog(slug)) return slug
  }
  return `${base}-${Date.now()}`
}

export async function saveBlog(doc: BlogDocument): Promise<void> {
  const stamp = doc.provenance.generatedAt.replace(/\D/g, '')
  await uploads().setItem(`pages:${doc.slug}.json`, doc)
  await uploads().setItem(`summaries:${stamp}-${doc.slug}.json`, summarise(doc))
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

/** The token is shown once, to the person who published. Only its hash is stored, apart from the page. */
export async function issueRemovalToken(slug: string): Promise<string> {
  const token = randomBytes(24).toString('base64url')
  await uploads().setItem(`owners:${slug}.json`, hashToken(token).toString('hex'))
  return token
}

/** Seeded pages have no owner record, so they can never be removed this way. */
export async function removeBlog(slug: string, token: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false
  const stored = await uploads().getItem<string>(`owners:${slug}.json`)
  if (!stored || !timingSafeEqual(Buffer.from(stored, 'hex'), hashToken(token))) return false
  const summaries = (await uploads().getKeys('summaries')).filter(key => key.endsWith(`-${slug}.json`))
  await Promise.all([
    ...summaries.map(key => uploads().removeItem(key)),
    uploads().removeItem(`pages:${slug}.json`),
    uploads().removeItem(`owners:${slug}.json`),
  ])
  return true
}
