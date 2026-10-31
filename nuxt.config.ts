import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  ssr: true,
  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      titleTemplate: '%s',
      meta: [{ name: 'theme-color', content: '#14161a' }],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preload', href: '/fonts/schibsted-grotesk.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/jetbrains-mono.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
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
    serverAssets: [{ baseName: 'seed', dir: fileURLToPath(new URL('./content', import.meta.url)) }],
    storage: {
      blogs: { driver: 'fs', base: './.data/blogs' },
    },
  },

  typescript: { strict: true },
})
