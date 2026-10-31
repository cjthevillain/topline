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
    expect(html).toMatch(/<html\s[^>]*lang="en-GB"/)
    expect(html).toMatch(/<h1[^>]*>Top 100 UK Seed-Stage Fintech Companies by Total Raised<\/h1>/)
    expect(html).toMatch(/<title>[^<]+<\/title>/)
    expect(html).toMatch(/<meta name="description" content="[^"]{50,}"/)
    expect(html).toMatch(/<link rel="canonical" href="[^"]+top-100-uk/)
    expect(html).toMatch(/<meta property="og:type" content="article"/)
    expect(html).toContain('Nevis')
    expect(html).toContain('Ledger Rocket')
    expect(html).toContain('£30,314,247')
    expect(html.match(/<th scope="row" class="name/g)).toHaveLength(100)
    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]!))
    expect(blocks.map(b => b['@type'])).toEqual(['BlogPosting', 'ItemList', 'BreadcrumbList', 'FAQPage', 'Dataset'])
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

  test('the rankings index is rendered on the server and lists every page', async ({ request }) => {
    const html = await (await request.get('/blog')).text()
    expect(html).toContain(`href="${FINTECH}"`)
    expect(html).toContain('CollectionPage')
  })

  test('the sitemap lists the static pages', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    for (const path of ['/blog<', '/generate<', '/how-it-works<', '/privacy<', '/terms<']) expect(sitemap).toContain(path)
  })

  test('the feeds and well-known files answer with the right type', async ({ request }) => {
    const feed = await request.get('/feed.xml')
    expect(feed.headers()['content-type']).toContain('application/rss+xml')
    expect(await feed.text()).toContain(FINTECH)
    expect(await (await request.get('/llms.txt')).text()).toContain(FINTECH)
    const security = await (await request.get('/.well-known/security.txt')).text()
    expect(security).toContain('Contact: mailto:')
    expect(security).toMatch(/Expires: \d{4}-/)
  })

  test('the ranking downloads as a CSV', async ({ request }) => {
    const slug = FINTECH.split('/').pop()
    const response = await request.get(`/data/${slug}.csv`)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain(`${slug}.csv`)
    expect((await response.text()).split('\r\n')[1]).toContain('Nevis')
    expect((await request.get('/data/does-not-exist.csv')).status()).toBe(404)
    expect((await request.get(`/data/${slug}.txt`)).status()).toBe(404)
  })

  for (const path of ['/', '/blog', '/generate', '/how-it-works', '/privacy', '/terms', FINTECH]) {
    test(`${path} has complete metadata`, async ({ request }) => {
      const html = await (await request.get(path)).text()
      const content = (name: string) => new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]+)"`).exec(html)?.[1]
      expect(html).toMatch(/<title>[^<]{10,70}<\/title>/)
      expect(html).toMatch(/<link rel="canonical" href="[^"]*"/)
      expect(content('description')?.length).toBeGreaterThan(50)
      expect(content('description')?.length).toBeLessThanOrEqual(165)
      expect(content('og:title')).toBeTruthy()
      expect(content('og:url')).toBeTruthy()
      expect(content('og:image')).toContain('http')
      expect(content('og:image:alt')).toBeTruthy()
      expect(content('og:locale')).toBe('en_GB')
      expect(content('twitter:card')).toBe('summary_large_image')
      expect(content('twitter:image')).toContain('http')
    })
  }
})

test.describe('brand files', () => {
  test('the web manifest describes an installable app with a maskable icon', async ({ request }) => {
    const manifest = await (await request.get('/site.webmanifest')).json()
    for (const field of ['id', 'name', 'short_name', 'description', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'lang']) expect(manifest[field], field).toBeTruthy()
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200)
  })

  test('every icon and font linked from the page exists', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const links = [...html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon|manifest|preload)"[^>]*>/g)].map(tag => /href="([^"]+)"/.exec(tag[0])?.[1])
    expect(links.length).toBeGreaterThanOrEqual(5)
    for (const href of links) expect((await request.get(href!)).status(), href).toBe(200)
    expect(html).not.toContain('schibsted')
  })

  test('each ranking has its own sharing image', async ({ request }) => {
    const slug = FINTECH.split('/').pop()
    const html = await (await request.get(FINTECH)).text()
    expect(html).toContain(`/og/${slug}.png`)
    const image = await request.get(`/og/${slug}.png`)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')
    expect((await image.body()).subarray(1, 4).toString()).toBe('PNG')
    expect((await request.get('/og/does-not-exist.png')).status()).toBe(404)
    expect((await request.get('/og/../secret.png')).status()).toBe(404)
  })
})

test.describe('page changes', () => {
  const watchTransitions = () => {
    const start = document.startViewTransition.bind(document)
    const seen: string[] = []
    Object.assign(window, { transitions: seen })
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const transition = start(update)
      transition.ready.then(() => seen.push('ran'), error => seen.push(String(error)))
      return transition
    }) as typeof document.startViewTransition
  }
  const seen = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { transitions: string[] }).transitions)

  test('the title and figure travel from the home page to the ranking, and the page starts at the top', async ({ page }) => {
    await page.addInitScript(watchTransitions)
    await page.goto('/', { waitUntil: 'networkidle' })
    const heading = await page.locator('h1').textContent()
    await page.getByRole('link', { name: /See the full ranking/ }).click()
    await page.waitForURL(`**${FINTECH}`)
    await expect(page.locator('h1')).toHaveText(heading!)
    await expect.poll(() => seen(page)).toEqual(['ran'])
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).viewTransitionName)).toBe('ranking-title')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('going from a list to a ranking and back never duplicates a transition name', async ({ page }) => {
    await page.addInitScript(watchTransitions)
    for (const start of ['/', '/blog']) {
      await page.goto(start, { waitUntil: 'networkidle' })
      await page.getByRole('link', { name: /Top 24 UK Seed-Stage Payments/ }).click()
      await page.waitForURL('**/blog/top-24-**')
      await page.getByRole('link', { name: 'All rankings' }).click()
      await page.waitForURL('**/blog')
      await expect(page.locator('.vt-title')).toHaveCount(1)
      await expect.poll(() => seen(page)).toEqual(['ran', 'ran'])
    }
  })

  test('a page change from the bottom of a long page lands at the top', async ({ page }) => {
    await page.addInitScript(watchTransitions)
    await page.goto(FINTECH, { waitUntil: 'networkidle' })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.getByRole('contentinfo').getByRole('link', { name: 'How it works' }).click()
    await page.waitForURL('**/how-it-works')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    expect(await seen(page)).toEqual(['ran'])
  })

  test('with reduced motion the page still crossfades, and nothing travels', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript(watchTransitions)
    await page.goto(FINTECH, { waitUntil: 'networkidle' })
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).viewTransitionName)).toBe('none')
    await page.getByRole('link', { name: 'All rankings' }).click()
    await page.waitForURL('**/blog')
    await expect.poll(() => seen(page)).toEqual(['ran'])
    await context.close()
  })
})

test.describe('buttons', () => {
  const rule = (page: import('@playwright/test').Page, selector: string) => page.locator(selector).first().evaluate(el => /0px (\d+)px 0px 0px inset/.exec(getComputedStyle(el).boxShadow)?.[1] ?? '')

  test('the rule is the state, and nothing moves', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('main .btn:not(.btn-t)').first()
    await button.scrollIntoViewIfNeeded()
    const rest = await button.boundingBox()
    expect(await rule(page, 'main .btn:not(.btn-t)')).toBe('3')
    await button.hover()
    await expect.poll(() => rule(page, 'main .btn:not(.btn-t)')).toBe('5')
    await page.mouse.down()
    await expect.poll(() => rule(page, 'main .btn:not(.btn-t)')).toBe('8')
    expect(await button.boundingBox()).toEqual(rest)
    expect(await button.evaluate(el => getComputedStyle(el).transform)).toBe('none')
  })

  test('publishing shows a busy button that cannot be pressed twice', async ({ page }) => {
    await page.route('**/api/blogs', async (route) => {
      if (route.request().method() === 'POST') await new Promise(done => setTimeout(done, 600))
      await route.continue()
    })
    await page.goto('/generate')
    await page.getByRole('button', { name: 'an example healthtech file' }).click()
    await page.getByLabel('Topic for the page').fill(`busy ${Date.now()}`)
    await page.getByRole('button', { name: 'Publish this page' }).click()
    const busy = page.getByRole('button', { name: 'Publishing' })
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    await expect(busy).toBeDisabled()
    await page.waitForURL('**/blog/**')
  })
})

test.describe('security', () => {
  test('every response carries the security headers, and no framework banner', async ({ request }) => {
    for (const path of ['/', '/api/blogs', '/favicon.svg']) {
      const headers = (await request.get(path)).headers()
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['x-frame-options']).toBe('DENY')
      expect(headers['strict-transport-security']).toContain('max-age=')
      expect(headers['referrer-policy']).toBeTruthy()
      expect(headers['permissions-policy']).toBeTruthy()
    }
    expect((await request.get('/')).headers()['x-powered-by']).toBeUndefined()
  })

  test('each page gets its own nonce, and every inline script carries it', async ({ request }) => {
    const read = async () => {
      const response = await request.get('/')
      return { policy: response.headers()['content-security-policy'] ?? '', html: await response.text() }
    }
    const [first, second] = [await read(), await read()]
    const nonce = /'nonce-([^']+)'/.exec(first.policy)?.[1]
    expect(nonce).toBeTruthy()
    expect(second.policy).not.toContain(nonce)
    const scripts = first.html.match(/<script\b[^>]*>/g) ?? []
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`)
  })

  for (const path of ['/', '/blog', '/generate', FINTECH]) {
    test(`${path} runs with no policy violations`, async ({ page }) => {
      const problems: string[] = []
      page.on('console', (message) => {
        if (/content security policy/i.test(message.text())) problems.push(message.text())
      })
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(problems).toEqual([])
      // The theme button only works once the app has started, so this proves the scripts ran.
      await expect(async () => {
        await page.getByRole('button', { name: 'Dark theme' }).click({ timeout: 500 })
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 500 })
      }).toPass()
    })
  }
})

test.describe('removing a page', () => {
  test('the person who published it can remove it, and it goes everywhere', async ({ page, request }) => {
    await page.goto('/generate')
    await page.getByRole('button', { name: 'an example healthtech file' }).click()
    await page.getByLabel('Topic for the page').fill(`removal ${Date.now()}`)
    await page.getByRole('button', { name: 'Publish this page' }).click()
    await page.waitForURL('**/blog/**')
    const path = new URL(page.url()).pathname

    const image = path.replace('/blog/', '/og/').concat('.png')
    expect((await request.get(image)).status()).toBe(200)
    await page.getByRole('button', { name: 'Remove this page' }).click()
    await page.getByRole('button', { name: 'Remove for good' }).click()
    await page.waitForURL('**/blog')
    expect((await request.get(path)).status()).toBe(404)
    expect((await request.get(image)).status()).toBe(404)
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain(path)
    expect(await (await request.get('/feed.xml')).text()).not.toContain(path)
  })

  test('a wrong token, or a seeded page, is refused', async ({ request }) => {
    const created = await (await upload(request, 'ai.csv', fixture('ai-minimal.csv'), `token ${Date.now()}`)).json()
    expect(created.removalToken.length).toBeGreaterThan(20)
    const wrong = await request.delete(`/api/blogs/${created.slug}`, { data: { token: 'x'.repeat(32) } })
    expect(wrong.status()).toBe(403)
    expect((await request.get(created.url)).status()).toBe(200)
    expect((await request.delete(`/api/blogs/${created.slug}`, { data: {} })).status()).toBe(403)
    const seeded = await request.delete(`/api/blogs/${FINTECH.split('/').pop()}`, { data: { token: 'x' } })
    expect(seeded.status()).toBe(403)
    expect((await request.delete(`/api/blogs/${created.slug}`, { data: { token: created.removalToken } })).status()).toBe(204)
    expect((await request.get(created.url)).status()).toBe(404)
  })

  test('the public document never contains the token', async ({ request }) => {
    const created = await (await upload(request, 'ai.csv', fixture('ai-minimal.csv'), `secret ${Date.now()}`)).json()
    const document = await (await request.get(`/api/blogs/${created.slug}`)).text()
    expect(document).not.toContain(created.removalToken)
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
    await expect(page.locator('#ranking tbody th[scope=row]')).toHaveCount(1)
    await expect(page.getByText('Showing 1 of 100')).toBeVisible()
  })

  test('nothing overflows the page on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    for (const path of ['/', FINTECH, '/blog', '/generate', '/how-it-works', '/privacy', '/terms']) {
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
    await page.getByRole('button', { name: 'Publish this page' }).click()
    await expect(page).toHaveURL(/\/blog\/top-40-/)
    await expect(page.locator('h1')).toHaveText('Mock LLM Heading for a Ranked Company Page')
    await expect(page.locator('#ranking tbody th[scope=row]')).toHaveCount(40)
    await expect(page.getByText('Written by an LLM')).toBeVisible()
    expect(errors).toEqual([])

    const slug = new URL(page.url()).pathname
    expect(await (await request.get('/sitemap.xml')).text()).toContain(slug)
    expect(await (await request.get('/blog')).text()).toContain(slug)
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
    await expect(page.getByRole('button', { name: 'Publish this page' })).toHaveCount(0)
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
      const limited = await behindCloudflare('198.51.100.2')
      expect(limited.status()).toBe(429)
      expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
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
