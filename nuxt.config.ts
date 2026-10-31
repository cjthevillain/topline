import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  ssr: true,
  experimental: { viewTransition: true },
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  app: {
    // Set here and not under experimental, where Nuxt 4.6 writes the word unquoted and the server fails to start.
    // 'always' keeps a short crossfade for people who ask for less motion.
    viewTransition: 'always',
    head: {
      htmlAttrs: { lang: 'en-GB' },
      titleTemplate: '%s',
      meta: [{ name: 'theme-color', content: '#121417' }],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preload', href: '/fonts/archivo-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      ],
    },
  },

  runtimeConfig: {
    anthropicApiKey: '',
    anthropicModel: 'claude-haiku-5-5',
    llmName: 'groq',
    llmBaseUrl: 'https://api.groq.com/openai/v1',
    llmApiKey: '',
    llmModel: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    llmTimeoutMs: 25000,
    llmBudgetMs: 50000,
    dailyPageLimit: 100,
    ipDailyLimit: 20,
    public: { siteUrl: '', umamiOrigin: '', umamiWebsiteId: '' },
  },

  routeRules: {
    '/**': {
      headers: {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
        'cross-origin-opener-policy': 'same-origin',
      },
    },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },

  nitro: {
    compressPublicAssets: true,
    serverAssets: [
      { baseName: 'seed', dir: fileURLToPath(new URL('./content', import.meta.url)) },
      { baseName: 'og', dir: fileURLToPath(new URL('./server/assets/og', import.meta.url)) },
    ],
    storage: {
      blogs: { driver: 'fs', base: './.data/blogs' },
    },
  },

  typescript: { strict: true },
})
