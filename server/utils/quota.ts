import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * IPs are hashed with the date, so nothing personal is stored and nothing lasts
 * past the day. Behind Cloudflare the first forwarded address can be set by the
 * caller, so its own header comes first. Faking either one only moves that
 * caller's own count: the daily page limit still holds.
 */
function clientKey(event: H3Event): string {
  const ip = getRequestHeader(event, 'cf-connecting-ip') ?? getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  return createHash('sha256').update(`${today()}:${ip}`).digest('hex').slice(0, 24)
}

/** The counts restart at midnight UTC, so that is what Retry-After gives. */
function limitReached(event: H3Event, code: string, message: string) {
  const midnight = new Date()
  midnight.setUTCHours(24, 0, 0, 0)
  setResponseHeader(event, 'retry-after', Math.ceil((midnight.getTime() - Date.now()) / 1000))
  return createError({ statusCode: 429, data: { code, message, hint: 'Publishing opens again at midnight UTC.' } })
}

/**
 * The upload is public and each page costs storage and LLM quota, so it has
 * daily caps. The counter is read then written, so two uploads in the same
 * instant can both pass. For a soft abuse limit that is an acceptable trade.
 * The first upload of each day clears earlier days, so no hash outlives its day.
 */
export async function claimQuota(event: H3Event, pageLimit: number, ipLimit: number): Promise<void> {
  const storage = useStorage('blogs')
  const day = today()
  const dayKey = `quota:${day}:all.json`
  const ipKey = `quota:${day}:${clientKey(event)}.json`
  const [all, ip] = await Promise.all([storage.getItem<number>(dayKey), storage.getItem<number>(ipKey)])

  if (all === null) {
    const old = (await storage.getKeys('quota')).filter(key => !key.startsWith(`quota:${day}:`))
    await Promise.all(old.map(key => storage.removeItem(key)))
  }
  if ((ip ?? 0) >= ipLimit) {
    throw limitReached(event, 'ip_limit', `You have reached today's limit of ${ipLimit} pages.`)
  }
  if ((all ?? 0) >= pageLimit) {
    throw limitReached(event, 'daily_limit', 'Topline has reached its publishing limit for today.')
  }
  await Promise.all([storage.setItem(dayKey, (all ?? 0) + 1), storage.setItem(ipKey, (ip ?? 0) + 1)])
}
