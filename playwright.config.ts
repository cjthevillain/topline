import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  workers: 2,
  reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL, channel: 'chrome', trace: 'off' },
})
