<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { findUngroundedNumbers } from '#shared/copy/grounding'
import { buildJsonLd } from '#shared/seo/jsonld'
import { formatMetric } from '#shared/ui/format'

const { data: blogs } = await useFetch('/api/blogs', { default: () => [] })
const origin = useSiteOrigin()

const title = `${BRAND.name}: turn a company CSV into a ranked, search-ready page`
useSeoMeta({
  title,
  description: BRAND.description,
  ogTitle: title,
  ogDescription: BRAND.description,
  ogType: 'website',
  ogSiteName: BRAND.name,
  ogImage: `${origin}/og.png`,
  twitterCard: 'summary_large_image',
})
useHead({ link: [{ rel: 'canonical', href: `${origin}/` }] })

const featured = computed(() => blogs.value.filter(b => b.seeded))
const uploaded = computed(() => blogs.value.filter(b => !b.seeded))
const { data: fintech } = await useFetch(() => `/api/blogs/${featured.value[0]?.slug}`, { immediate: Boolean(featured.value[0]) })
const fintechPath = computed(() => (featured.value[0] ? `/blog/${featured.value[0].slug}` : '/generate'))

// The bento tiles show real output from the featured page.
const topRows = computed(() => fintech.value?.dataset.rows.slice(0, 5) ?? [])
const leader = computed(() => topRows.value[0]?.metric ?? 0)
const share = (value: number | null) => (leader.value && value ? Math.max((value / leader.value) * 100, 2) : 0)
const money = (value: number | null) => (fintech.value ? formatMetric(value, fintech.value.dataset) : '')
const tile = (id: string) => fintech.value?.insights.tiles.find(t => t.id === id)

const jsonLd = computed(() => {
  if (!fintech.value) return ''
  const list = buildJsonLd(fintech.value, origin)[1] as { itemListElement: unknown[] }
  return JSON.stringify({ ...list, itemListElement: list.itemListElement.slice(0, 2) }, null, 2)
})

const NUMBER = /(?:[£$€]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|bn|m|k)\b)?/g
const checked = computed(() => {
  const doc = fintech.value
  if (!doc) return null
  const sentence = doc.copy.intro[0] ?? ''
  const bad = new Set(findUngroundedNumbers(sentence, doc.insights.allowedNumbers, [new Date(doc.provenance.generatedAt).getUTCFullYear()]))
  const parts: { text: string; figure: boolean; ok: boolean }[] = []
  let last = 0
  for (const match of sentence.matchAll(NUMBER)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: sentence.slice(last, index), figure: false, ok: true })
    parts.push({ text: match[0], figure: true, ok: !bad.has(match[0].trim()) })
    last = index + match[0].length
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), figure: false, ok: true })
  const figures = parts.filter(p => p.figure)
  return { parts, total: figures.length, passed: figures.filter(p => p.ok).length }
})

const steps = [
  { title: 'Upload', body: 'Drop in any company CSV. Columns are detected from their names and values, so nothing is tied to one industry.' },
  { title: 'Analyse', body: 'Bad rows are cleaned or reported with line numbers, then every statistic is calculated in code.' },
  { title: 'Write', body: 'An LLM writes the copy from those facts. Any figure the data cannot support is rejected.' },
  { title: 'Publish', body: 'One Nuxt template renders the page on the server, with metadata, structured data and a sitemap entry.' },
]

const proofs = [
  { title: 'Numbers come from code', body: 'The LLM never calculates anything. It only writes around facts that were computed first.' },
  { title: 'Every claim is checked', body: 'Each field of the reply is checked for figures the data cannot support, links, HTML and trend claims a snapshot cannot back.' },
  { title: 'It works without an LLM', body: 'If every provider is down, a template built from the data takes over and the page says so.' },
]

const modeLabel = { llm: 'LLM copy', hybrid: 'Mixed copy', template: 'Template copy' }
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
</script>

<template>
  <div>
    <section class="band hero-band">
      <div class="wrap hero hero--home">
        <div class="copy">
          <p class="label">Upload a CSV, publish a ranking page</p>
          <h1>One CSV in.<br>A ranked page out.</h1>
          <div class="copy-row">
            <p class="lede">{{ BRAND.name }} reads any company CSV, calculates the headline numbers in code and publishes a server-rendered page with the full table, charts and checked copy. No code changes. No rebuild.</p>
            <div class="actions">
            <NuxtLink v-if="featured[0]" :to="fintechPath" class="pill">
              Read the fintech ranking
              <svg class="arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </NuxtLink>
              <NuxtLink to="/generate" class="pill pill--line">Generate your own</NuxtLink>
            </div>
          </div>
        </div>
        <HeroDemo v-if="fintech" :doc="fintech" :to="fintechPath" class="show" />
      </div>
    </section>

    <div class="wrap">
      <section v-if="fintech && featured[0]" class="sec sec--first" aria-labelledby="output-heading">
        <div class="sec-head" v-reveal>
          <h2 id="output-heading">What every page contains</h2>
          <p>Real output from the {{ fintech.context.topic }} page. Nothing here is a mock-up.</p>
        </div>
        <div class="bento">
          <div class="cell cell--rank sheet" v-reveal>
            <p class="label">The full ranking</p>
            <p class="cell-title"><NuxtLink :to="fintechPath" class="cover">{{ fintech.dataset.rows.length }} companies, sorted by {{ fintech.dataset.metric?.label ?? 'the file order' }}</NuxtLink></p>
            <ol class="toplist">
              <li v-for="(row, i) in topRows" :key="row.rank" :style="{ '--grow-delay': `${i * 90}ms` }">
                <span class="pos mono">{{ String(row.rank).padStart(2, '0') }}</span>
                <span class="who">{{ row.name }}</span>
                <span class="amt num">{{ money(row.metric) }}</span>
                <span class="track" aria-hidden="true"><span class="fill grow" :style="{ width: `${share(row.metric)}%` }" /></span>
              </li>
            </ol>
            <p class="small muted more">Sortable and searchable, with all {{ fintech.dataset.rows.length }} rows in the first HTML response.</p>
          </div>

          <div class="cell cell--stat sheet" v-reveal style="--reveal-delay: 80ms">
            <p class="label">Calculated in code</p>
            <template v-if="tile('total')">
              <p class="big num"><span v-count>{{ tile('total')!.value }}</span></p>
              <p class="cell-sub">{{ tile('total')!.label }}</p>
            </template>
            <dl class="pairs">
              <template v-for="id in ['median', 'concentration', 'region']" :key="id">
                <div v-if="tile(id)">
                  <dt class="small muted">{{ tile(id)!.label }}</dt>
                  <dd class="num"><span v-count>{{ tile(id)!.value }}</span></dd>
                </div>
              </template>
            </dl>
          </div>

          <div v-if="checked" class="cell cell--check sheet" v-reveal style="--reveal-delay: 120ms">
            <div>
              <p class="label">Copy that is checked</p>
              <p class="cell-sub">Every figure in the copy must match a value computed from the file, at the precision it is quoted. A sentence that fails is replaced by the data template.</p>
              <ul class="checks small">
                <li>{{ checked.passed }} of {{ checked.total }} figures in this sentence match the data</li>
                <li>No links or HTML</li>
                <li>No trend claims a single snapshot cannot support</li>
              </ul>
            </div>
            <blockquote class="quote">
              <template v-for="(part, i) in checked.parts" :key="i">
                <mark v-if="part.figure" :class="{ bad: !part.ok }">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </blockquote>
          </div>
          <div class="cell cell--code sheet" v-reveal style="--reveal-delay: 160ms">
            <p class="label">Structured data</p>
            <p class="cell-sub">Four JSON-LD blocks on every page: the article, the ranked list, breadcrumbs and the FAQ.</p>
            <pre class="code" tabindex="0"><code>{{ jsonLd }}</code></pre>
            <p class="small muted more">The ranked list, cut to 2 of its {{ fintech.dataset.rows.length }} items.</p>
          </div>

        </div>
      </section>

      <section class="sec" aria-labelledby="how-heading">
        <div class="sec-head" v-reveal>
          <h2 id="how-heading">Set it up once. It works for every industry.</h2>
          <p>Nothing is tied to fintech. Columns are read from their names and values, and the same template renders every page.</p>
        </div>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="step.title" v-reveal :style="{ '--reveal-delay': `${i * 70}ms` }">
            <span class="step-no mono">0{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p class="small muted">{{ step.body }}</p>
          </li>
        </ol>
      </section>

      <section class="sec" aria-labelledby="pages-heading">
        <div class="sec-head" v-reveal>
          <h2 id="pages-heading">Published pages</h2>
          <p>Each page is one dataset, rendered through the same template. New uploads appear here and in the sitemap straight away.</p>
        </div>
        <ul class="pages">
          <li v-for="blog in [...featured, ...uploaded]" :key="blog.slug" v-reveal>
            <NuxtLink :to="`/blog/${blog.slug}`" class="page">
              <span class="page-meta">
                <span class="chip chip--accent">{{ blog.topic }}</span>
                <span class="chip">{{ modeLabel[blog.mode] }}</span>
              </span>
              <span class="page-title">{{ blog.title }}</span>
              <span class="label page-when">{{ blog.rows }} companies, {{ dateOf(blog.generatedAt) }}</span>
              <svg class="page-arrow" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>

    <section class="trust" aria-labelledby="trust-heading">
      <div class="wrap trust-grid">
        <div v-reveal>
          <p class="label label--accent ruled">Accurate by design</p>
          <h2 id="trust-heading">Your data decides what the page can say.</h2>
        </div>
        <ul class="proofs">
          <li v-for="(proof, i) in proofs" :key="proof.title" v-reveal :style="{ '--reveal-delay': `${i * 70}ms` }">
            <svg class="tick" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m8 12.5 2.6 2.5L16 9.5" /></svg>
            <div>
              <h3>{{ proof.title }}</h3>
              <p class="small muted">{{ proof.body }}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section class="wrap end" v-reveal>
      <p class="label">Try it with your own file</p>
      <h2>Bring a CSV. Leave with a page.</h2>
      <p class="muted">Any industry, any column names. You see what was found before anything is published.</p>
      <NuxtLink to="/generate" class="pill">
        Generate a page
        <svg class="arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.hero--home { display: grid; gap: 56px; padding-block: 64px 88px; }
.copy { max-width: none; }
.hero--home h1 { max-width: none; }
.copy-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-lg) var(--space-xxl); align-items: end; margin-top: 22px; }
.copy-row .lede { margin-top: 0; }
.copy-row .actions { margin-top: 0; }

.sec--first { padding-top: 96px; }
.bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--space-md); margin-top: var(--space-xxl); }
.cell { display: block; min-width: 0; padding: 28px; color: var(--ink); text-decoration: none; transition: border-color var(--motion-state-change) var(--easing), box-shadow var(--motion-state-change) var(--easing); }
.cell-title { margin-top: 10px; font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
.cell-sub { margin-top: 10px; color: var(--muted); font-size: 15px; line-height: 1.45; }
.cell--stat .cell-sub { margin-bottom: 24px; }
.cell--rank { position: relative; grid-column: span 7; }
.cover { color: inherit; text-decoration: none; }
.cover::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
.cell--rank:hover .cover { color: var(--accent); }
.cell--rank:hover { border-color: var(--line-control); box-shadow: var(--shadow-soft); }
.cell--stat { grid-column: span 5; display: flex; flex-direction: column; }
.cell--code { grid-column: span 5; display: flex; flex-direction: column; }
.cell--code .code { flex: 1 1 200px; max-height: none; min-height: 0; }
.cell--check { grid-column: span 7; display: grid; gap: var(--space-lg); align-content: start; }

.toplist { margin-top: 24px; display: grid; gap: 14px; }
.toplist li { display: grid; grid-template-columns: 3ch minmax(0, 1fr) auto; gap: 6px var(--space-md); align-items: baseline; }
.pos { font-size: 13px; color: var(--muted); }
.who { font-weight: 600; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.amt { font-weight: 500; }
.track { grid-column: 2 / -1; height: 6px; border-radius: 3px; background: var(--accent-tint); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 3px; background: var(--accent); }
.more { margin-top: 24px; }

.big { margin-top: 14px; font-size: clamp(48px, 5vw, 64px); font-weight: 600; line-height: 1; letter-spacing: -0.04em; }
.pairs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-md); margin-top: auto; padding-top: 24px; padding-top: 20px; border-top: 1px solid var(--line-soft); }
.pairs dd { margin-top: 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }

.code { margin-top: 16px; padding: 16px 18px; border-radius: var(--radius-small); background: var(--band); color: var(--band-muted); font-family: var(--mono); font-size: 12px; line-height: 1.55; overflow: auto; max-height: 240px; white-space: pre; }
:root[data-theme='dark'] .code { background: var(--page); border: 1px solid var(--line); }

.checks { margin-top: 16px; display: grid; gap: 8px; }
.checks li { display: flex; gap: 10px; align-items: start; }
.checks li::before { content: ''; flex: none; width: 16px; height: 16px; margin-top: 3px; border-radius: 50%; background: var(--accent-tint) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%232f2575' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4.5 8.5 2.3 2.2L11.5 5.5'/%3E%3C/svg%3E") center / 12px no-repeat; }
:root[data-theme='dark'] .checks li::before { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23b4b7f7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4.5 8.5 2.3 2.2L11.5 5.5'/%3E%3C/svg%3E"); }
.quote { margin: 0; padding: 24px 28px; border-left: 3px solid var(--accent); border-radius: 0 var(--radius-medium) var(--radius-medium) 0; background: var(--tint); font-size: clamp(18px, 1.6vw, 22px); line-height: 1.45; letter-spacing: -0.01em; text-wrap: pretty; }
.quote mark { padding: 0 4px; border-radius: 6px; background: var(--accent-tint); color: var(--accent); font-weight: 600; box-decoration-break: clone; }
.quote mark.bad { background: var(--note); color: var(--warn); text-decoration: line-through; }

.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-xl); margin-top: var(--space-xxl); }
.steps li { padding-top: 20px; border-top: 1px solid var(--ink); }
.step-no { display: block; font-size: 13px; color: var(--accent); }
.steps h3 { margin-top: 36px; }
.steps p { margin-top: 8px; }

.pages { margin-top: var(--space-xl); border-top: 1px solid var(--line); }
.pages li { border-bottom: 1px solid var(--line); }
.page { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto 24px; gap: var(--space-xs) var(--space-lg); align-items: center; padding-block: 22px; color: var(--ink); text-decoration: none; }
.page-meta { display: flex; gap: 6px; min-width: 200px; }
.page-title { font-size: 21px; font-weight: 600; line-height: 1.25; letter-spacing: -0.015em; transition: color var(--motion-feedback) var(--easing); }
.page:hover .page-title { color: var(--accent); }
.page-arrow { width: 24px; height: 24px; color: var(--muted); transition: transform var(--motion-state-change) var(--easing), color var(--motion-state-change) var(--easing); }
.page:hover .page-arrow { transform: translateX(4px); color: var(--accent); }

.trust { margin-top: 120px; padding-block: 96px; background: var(--accent-soft); border-block: 1px solid var(--line-soft); }
.trust-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: var(--space-xxl); align-items: start; }
.trust h2 { margin-top: var(--space-sm); max-width: 14ch; }
.proofs { display: grid; }
.proofs li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: var(--space-md); padding-block: 22px; border-top: 1px solid var(--line); }
.proofs li:last-child { border-bottom: 1px solid var(--line); }
.tick { width: 24px; height: 24px; margin-top: 2px; color: var(--accent); }
.proofs h3 { font-size: 18px; }
.proofs p { margin-top: 4px; }

.end { display: grid; justify-items: center; gap: var(--space-md); padding-top: 120px; text-align: center; }
.end h2 { max-width: 16ch; }
.end p.muted { max-width: 40ch; }

@media (min-width: 980px) {
  .copy-row { grid-template-columns: minmax(0, 1fr) auto; }
}
@media (max-width: 979px) {
  .cell--rank, .cell--stat, .cell--code { grid-column: span 12; grid-row: auto; }
  .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trust-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .hero--home { padding-block: 40px 56px; }
  .sec--first { padding-top: 72px; }
  .cell { padding: 20px; }
  .steps { grid-template-columns: 1fr; gap: var(--space-lg); }
  .steps h3 { margin-top: 20px; }
  .page { grid-template-columns: minmax(0, 1fr) 24px; }
  .page-meta { min-width: 0; flex-wrap: wrap; }
  .page-when { grid-column: 1; }
  .page-arrow { grid-column: 2; grid-row: 1 / span 3; }
  .pairs { grid-template-columns: 1fr 1fr; }
  .trust { margin-top: 80px; padding-block: 64px; }
  .end { padding-top: 80px; }
}
</style>
