import { randomBytes } from 'node:crypto'

/**
 * A Content Security Policy for every rendered page. Nuxt writes inline script
 * tags, so each response gets its own nonce and only those tags can run. Inline
 * styles stay allowed because Vue writes them as style attributes.
 */
function policy(nonce: string, https: boolean, analytics: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${analytics ? ` ${analytics}` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'${analytics ? ` ${analytics}` : ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(16).toString('base64')
    const stamp = (part: string) => part.replaceAll('<script', `<script nonce="${nonce}"`)
    // Only these two hold script tags. The body holds uploaded text, so it is left alone.
    html.head = html.head.map(stamp)
    html.bodyAppend = html.bodyAppend.map(stamp)
    const { siteUrl, umamiOrigin } = useRuntimeConfig(event).public
    setResponseHeader(event, 'content-security-policy', policy(nonce, siteUrl.startsWith('https:'), umamiOrigin))
  })
  nitroApp.hooks.hook('render:response', (response) => {
    if (response.headers) delete response.headers['x-powered-by']
  })
})
