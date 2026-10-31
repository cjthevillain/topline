import type { H3Event } from 'h3'

/** NUXT_PUBLIC_SITE_URL wins, so previews cannot claim to be the canonical site. */
export function siteOrigin(event: H3Event): string {
  return (useRuntimeConfig(event).public.siteUrl || getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin).replace(/\/$/, '')
}
