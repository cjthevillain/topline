import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const FINTECH = '/blog/top-100-uk-seed-stage-fintech-companies-by-total-raised'
const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))

function upload(request: import('@playwright/test').APIRequestContext, name: string, buffer: Buffer, topic = '') {
  return request.post('/api/blogs', { multipart: { file: { name, mimeType: 'text/csv', buffer }, topic } })
}

test.describe('server-rendered content, read with no JavaScript', () => {
  test('the fintech page has everything in the first HTML response', async ({ request }) => {
    const html = await (await request.get(FINTECH)).text()
    expect(html).toMatch(/<html\s+lang="en-GB"/)
    expect(html).toMatch(/<h1[^>]*>Top 100 UK Seed-Stage Fintech Companies by Total Raised<\/h1>/)
    expect(html).toMatch(/<title>[^<]+<\/title>/)
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/)
    expect(html).toMatch(/<link rel="canonical" href="[^"]+top-100-uk/)
    expect(html).toMatch(/<meta property="og:type" content="article"/)
    expect(html).toContain('Nevis')
    expect(html).toContain('Ledger Rocket')
    expect(html).toContain('£30,314,247')
    expect(html.match(/<th scope="row"/g)).toHaveLength(100)
    const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]!))
    expect(blocks.map(b => b['@type'])).toEqual(['BlogPosting', 'ItemList', 'BreadcrumbList', 'FAQPage'])
    expect(blocks[1].itemListElement).toHaveLength(100)
  })

  test('there is one h1 and heading levels do not skip', async ({ page }) => {
    await page.goto(FINTECH)
    await expect(page.locator('h1')).toHaveCount(1)
    const levels = await page.locator('h1,h2,h3').evaluateAll(els => els.map(e => Number(e.tagName[1])))
    levels.slice(1).forEach((level, i) => expect(level - levels[i]!).toBeLessThanOrEqual(1))
  })

  test('sitemap and robots', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('<urlset')
    expect(sitemap).toContain(FINTECH)
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Sitemap:')
    expect(robots).toContain('Disallow: /api/')
  })

  test('unknown pages return a real 404', async ({ request }) => {
    expect((await request.get('/blog/does-not-exist')).status()).toBe(404)
    expect((await request.get('/blog/..%2f..%2fetc')).status()).toBe(404)
  })

  test('/blog redirects home', async ({ request }) => {
    const response = await request.get('/blog', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
  })
})

test.describe('ranking table', () => {
  test('search and sort work after hydration', async ({ page }) => {
    await page.goto(FINTECH)
    // The table hydrates when it scrolls into view, so the first click may land before that.
    await page.locator('#ranking').scrollIntoViewIfNeeded()
    await expect(async () => {
      await page.getByRole('button', { name: 'Company', exact: true }).click()
      await expect(page.locator('tbody tr').first()).not.toContainText('Nevis', { timeout: 500 })
    }).toPass()
    await page.getByLabel('Search the table').fill('Nevis')
    await expect(page.locator('tbody th[scope=row]')).toHaveCount(1)
    await expect(page.getByText('Showing 1 of 100')).toBeVisible()
  })

  test('nothing overflows the page on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    for (const path of ['/', FINTECH, '/generate']) {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})

test.describe('upload through the browser', () => {
  test('sample file to published page, with the LLM copy, and listed everywhere', async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/generate')
    await page.getByRole('button', { name: 'an example healthtech file' }).click()
    await expect(page.getByText('40 usable rows from 40')).toBeVisible()
    await expect(page.getByLabel('Ranking value')).toHaveValue('5')
    await page.getByRole('button', { name: 'Generate page' }).click()
    await expect(page).toHaveURL(/\/blog\/top-40-/)
    await expect(page.locator('h1')).toHaveText('Mock LLM Heading for a Ranked Company Page')
    await expect(page.locator('tbody th[scope=row]')).toHaveCount(40)
    await expect(page.getByText('Written by an LLM')).toBeVisible()
    expect(errors).toEqual([])

    const slug = new URL(page.url()).pathname
    expect(await (await request.get('/sitemap.xml')).text()).toContain(slug)
    expect(await (await request.get('/')).text()).toContain(slug)
    const direct = await (await request.get(slug)).text()
    expect(direct).toContain('Mock LLM Heading')
  })

  test('a messy file shows what was fixed before anything is published', async ({ page }) => {
    await page.goto('/generate')
    await page.getByRole('button', { name: 'a messy cleantech file' }).click()
    await expect(page.getByText('Skipped 1 row with no name')).toBeVisible()
    await expect(page.getByText('duplicate row')).toBeVisible()
    await expect(page.getByText('Lines: 8.')).toBeVisible()
  })

  test('remapping a column updates the preview', async ({ page }) => {
    await page.goto('/generate')
    await page.setInputFiles('input[type=file]', { name: 'shops.tsv', mimeType: 'text/plain', buffer: fixture('retailtech-tabs.tsv') })
    await expect(page.getByText('Shopora ranks first')).toBeVisible()
    await page.getByLabel('Ranking value').selectOption({ label: 'NPS' })
    await expect(page.getByText('Tillr ranks first')).toBeVisible()
  })

  test('an Excel file gets a clear error and no generate button', async ({ page }) => {
    await page.goto('/generate')
    await page.setInputFiles('input[type=file]', { name: 'data.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK\u0003\u0004abcdef') })
    await expect(page.getByRole('alert')).toContainText('Excel workbook')
    await expect(page.getByRole('alert')).toContainText('CSV UTF-8')
    await expect(page.getByRole('button', { name: 'Generate page' })).toHaveCount(0)
  })

  test('a wrong column choice can be recovered', async ({ page }) => {
    await page.goto('/generate')
    await page.setInputFiles('input[type=file]', { name: 'ai.csv', mimeType: 'text/csv', buffer: fixture('ai-minimal.csv') })
    await page.getByLabel('Name', { exact: true }).selectOption({ label: 'valuation' })
    await page.getByLabel('Ranking value').selectOption({ label: 'startup' })
    await expect(page.getByRole('alert')).toContainText('could be read as a number')
    await page.getByLabel('Name', { exact: true }).selectOption({ label: 'startup' })
    await page.getByLabel('Ranking value').selectOption({ label: 'valuation' })
    await expect(page.getByText('DeepMarrow ranks first')).toBeVisible()
  })
})

test.describe('upload API, no browser', () => {
  for (const name of ['healthtech-clean.csv', 'cleantech-messy.csv', 'ai-minimal.csv', 'edtech-directory.csv', 'retailtech-tabs.tsv', 'proptech-cp1252.csv', 'headerless.csv', 'stray-quote.csv', 'unquoted-thousands.csv', 'agritech-unsorted.csv']) {
    test(`${name} becomes a working page`, async ({ request }) => {
      const response = await upload(request, name, fixture(name))
      expect(response.status()).toBe(201)
      const { url } = await response.json()
      const page = await request.get(url)
      expect(page.status()).toBe(200)
      const html = await page.text()
      expect(html).toContain('application/ld+json')
      expect(html).not.toMatch(/undefined|\[object Object\]|NaN/)
    })
  }

  test('the same file twice gets two pages', async ({ request }) => {
    const first = await (await upload(request, 'ai-minimal.csv', fixture('ai-minimal.csv'), 'twice')).json()
    const second = await (await upload(request, 'ai-minimal.csv', fixture('ai-minimal.csv'), 'twice')).json()
    expect(second.slug).not.toBe(first.slug)
  })

  for (const [label, buffer, code] of [
    ['empty', Buffer.from(' '), 'empty_file'],
    ['one column', Buffer.from('Company\nA\nB\nC\n'), 'one_column'],
    ['Excel', Buffer.from('PK\u0003\u0004x'), 'excel_file'],
    ['HTML', Buffer.from('<!doctype html><p>'), 'html_file'],
    ['numbers only', Buffer.from('a,b\n1,2\n3,4\n5,6\n'), 'no_name_column'],
    ['too few rows', Buffer.from('Company,Funding\nOne,£1m\n'), 'too_few_rows'],
  ] as const) {
    test(`${label} is refused with a clear message`, async ({ request }) => {
      const response = await upload(request, 'x.csv', buffer)
      expect(response.status()).toBe(422)
      const body = await response.json()
      expect(body.data.code).toBe(code)
      expect(body.data.hint.length).toBeGreaterThan(10)
    })
  }

  test('no file at all', async ({ request }) => {
    const response = await request.post('/api/blogs', { multipart: { topic: 'x' } })
    expect(response.status()).toBe(400)
  })

  test('a file over the size limit is refused', async ({ request }) => {
    const response = await upload(request, 'big.csv', Buffer.alloc(3 * 1024 * 1024, 97))
    expect(response.status()).toBe(413)
    expect((await response.json()).data.code).toBe('file_too_large')
  })

  test('an LLM outage still publishes a page from the template', async ({ request }) => {
    const response = await upload(request, 'outage.csv', fixture('ai-minimal.csv'), 'outage')
    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.mode).toBe('template')
    expect(await (await request.get(body.url)).text()).toContain('Top 5 Outage Companies by Valuation')
  })
})

test.describe('daily caps', () => {
  test('a person over the limit gets a clear 429', async ({ request }) => {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    const cwd = mkdtempSync(join(tmpdir(), 'topline-quota-'))
    const port = await new Promise<number>((done) => {
      const probe = createServer().listen(0, '127.0.0.1', () => {
        const { port } = probe.address() as AddressInfo
        probe.close(() => done(port))
      })
    })
    const app = spawn('node', [join(root, '.output/server/index.mjs')], {
      cwd,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NUXT_IP_DAILY_LIMIT: '1', NUXT_LLM_MODEL: '' },
      stdio: 'ignore',
    })
    try {
      const base = `http://127.0.0.1:${port}`
      await expect.poll(() => fetch(`${base}/robots.txt`).then(r => r.ok, () => false)).toBe(true)
      const post = () => request.post(`${base}/api/blogs`, { multipart: { file: { name: 'ai.csv', mimeType: 'text/csv', buffer: fixture('ai-minimal.csv') } } })
      expect((await post()).status()).toBe(201)
      const blocked = await post()
      expect(blocked.status()).toBe(429)
      expect((await blocked.json()).data.code).toBe('ip_limit')

      // Behind Cloudflare a caller is counted by its header, so changing the forwarded address does not help.
      const behindCloudflare = (forwardedFor: string) => request.post(`${base}/api/blogs`, {
        headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': forwardedFor },
        multipart: { file: { name: 'ai.csv', mimeType: 'text/csv', buffer: fixture('ai-minimal.csv') } },
      })
      expect((await behindCloudflare('198.51.100.1')).status()).toBe(201)
      expect((await behindCloudflare('198.51.100.2')).status()).toBe(429)
    }
    finally {
      app.kill()
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})

test.describe('hostile content', () => {
  test('cells cannot run script or escape the JSON-LD block', async ({ page, request }) => {
    const { url } = await (await upload(request, 'hostile.csv', fixture('hostile.csv'))).json()
    const html = await (await request.get(url)).text()
    expect(html).not.toContain('<script>window.__pwned')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('javascript:alert')
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    ld.forEach(block => JSON.parse(block))
  })
})
