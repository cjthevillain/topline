import { BRAND } from '#shared/brand'

/** The format is RFC 9116. It requires an expiry date, so this one always sits a year ahead. */
export default defineEventHandler((event) => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `Contact: mailto:${BRAND.email}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${siteOrigin(event)}/.well-known/security.txt\n`
})
