<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { buildJsonLd, serialiseJsonLd } from '#shared/seo/jsonld'

const route = useRoute()
const slug = route.params.slug as string
const { data: blog } = await useFetch(`/api/blogs/${slug}`)
if (!blog.value) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

const doc = blog.value
const origin = useSiteOrigin()
const url = `${origin}/blog/${doc.slug}`

useSeoMeta({
  title: doc.copy.title,
  description: doc.copy.metaDescription,
  ogTitle: doc.copy.title,
  ogDescription: doc.copy.metaDescription,
  ogType: 'article',
  ogUrl: url,
  ogSiteName: BRAND.name,
  ogImage: `${origin}/og.png`,
  ogImageAlt: doc.copy.h1,
  twitterCard: 'summary_large_image',
  articlePublishedTime: doc.provenance.generatedAt,
  articleModifiedTime: doc.provenance.generatedAt,
  robots: 'index, follow, max-snippet:-1',
})

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: buildJsonLd(doc, origin).map(item => ({ type: 'application/ld+json', innerHTML: serialiseJsonLd(item) })),
})

if (import.meta.server) {
  useResponseHeader('cache-control').value = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'
}

const published = new Date(doc.provenance.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const headingId = (text: string) => text.toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '')
const toc = computed(() => [
  ...(doc.dataset.metric ? [{ id: 'top', label: 'Top three' }] : []),
  { id: 'statistics', label: 'Key statistics' },
  { id: 'ranking', label: 'Full ranking' },
  ...doc.copy.sections.map(s => ({ id: headingId(s.heading), label: s.heading })),
  { id: 'faq', label: 'FAQs' },
  { id: 'about', label: 'About this page' },
])
const copyLabel = { llm: 'Written by an LLM from the computed facts, then checked', hybrid: 'Written by an LLM, with some sections replaced by the data template after checks', template: 'Written by the data template' }
const modeChip = { llm: 'LLM copy, checked', hybrid: 'Mixed copy, checked', template: 'Template copy' }
const warnings = computed(() => doc.dataset.warnings)
const topic = doc.context.topic === 'company' ? 'Ranking' : doc.context.topic

// Marks the section the reader is in, in the contents rail.
const current = ref('')
onMounted(() => {
  const ids = toc.value.map(item => item.id)
  let ticking = false
  const update = () => {
    ticking = false
    const line = 140
    let found = ''
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el && el.getBoundingClientRect().top <= line) found = id
    }
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    current.value = atEnd ? ids[ids.length - 1]! : found
  }
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
})
</script>

<template>
  <article>
    <header class="band hero-band">
      <div class="wrap hero hero--blog" :class="{ 'hero--flat': !doc.dataset.metric }">
        <nav aria-label="Breadcrumb" class="crumbs label">
          <NuxtLink to="/">Home</NuxtLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ topic }}</span>
        </nav>
        <h1>{{ doc.copy.h1 }}</h1>
        <p class="lede">{{ doc.copy.intro[0] }}</p>
        <dl class="facts">
          <div>
            <dt class="label">Updated</dt>
            <dd><time :datetime="doc.provenance.generatedAt">{{ published }}</time></dd>
          </div>
          <div>
            <dt class="label">Companies</dt>
            <dd class="num">{{ doc.dataset.rows.length }}</dd>
          </div>
          <div v-if="doc.dataset.metric">
            <dt class="label">Ranked by</dt>
            <dd>{{ doc.dataset.metric.header }}</dd>
          </div>
          <div>
            <dt class="label">Copy</dt>
            <dd>{{ modeChip[doc.provenance.mode] }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <div class="wrap">
      <div id="top" class="anchor">
        <TopThree v-if="doc.dataset.metric" :doc="doc" class="over" />
      </div>

      <div class="layout" :class="{ 'layout--flush': !doc.dataset.metric }">
        <nav class="rail" aria-label="On this page">
          <p class="label">On this page</p>
          <ol>
            <li v-for="item in toc" :key="item.id">
              <a :href="`#${item.id}`" :aria-current="current === item.id ? 'location' : undefined">{{ item.label }}</a>
            </li>
          </ol>
        </nav>

        <div class="content">
          <section id="statistics" class="block">
            <div class="sec-head">
              <h2>Key statistics</h2>
              <p>Calculated in code from the {{ doc.dataset.stats.rowsUsed }} rows used.</p>
            </div>
            <StatTiles class="after" :tiles="doc.insights.tiles" />
            <div v-if="doc.insights.breakdowns.length" class="charts sheet">
              <BarList
                v-for="breakdown in doc.insights.breakdowns"
                :key="breakdown.id"
                :breakdown="breakdown"
                :dataset="doc.dataset"
                :overlapping="breakdown.id === 'category'"
              />
            </div>
          </section>

          <div v-if="doc.copy.intro.length > 1" class="prose block block--tight">
            <p v-for="paragraph in doc.copy.intro.slice(1)" :key="paragraph">{{ paragraph }}</p>
          </div>

          <section id="ranking" class="block">
            <div class="sec-head">
              <h2>The full ranking</h2>
              <p v-if="doc.dataset.metric">Sorted by {{ doc.dataset.metric.label }}. Select a column heading to sort by something else.</p>
              <p v-else>In the order of the source file. Select a column heading to sort.</p>
            </div>
            <LazyRankingTable hydrate-on-visible class="after" :dataset="doc.dataset" :caption="doc.copy.h1" />
          </section>

          <section v-for="section in doc.copy.sections" :id="headingId(section.heading)" :key="section.heading" class="block prose">
            <h2>{{ section.heading }}</h2>
            <p v-for="paragraph in section.paragraphs" :key="paragraph" class="para">{{ paragraph }}</p>
          </section>

          <section id="faq" class="block">
            <h2>Frequently asked questions</h2>
            <ul class="faqs after">
              <li v-for="item in doc.copy.faq" :key="item.question" class="faq">
                <h3>{{ item.question }}</h3>
                <p class="muted">{{ item.answer }}</p>
              </li>
            </ul>
          </section>

          <aside id="about" class="block source" aria-labelledby="source-heading">
            <h2 id="source-heading" class="label">About this page</h2>
            <ul class="small muted">
              <li>Source file: {{ doc.provenance.sourceFile }}</li>
              <li>Rows used: {{ doc.dataset.stats.rowsUsed }} of {{ doc.dataset.stats.rowsInFile }}</li>
              <li>{{ copyLabel[doc.provenance.mode] }}<template v-if="doc.provenance.model"> ({{ doc.provenance.provider }}, {{ doc.provenance.model }})</template>.</li>
              <li v-for="warning in warnings" :key="warning.code">{{ warning.message }}</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.hero--blog { padding-bottom: 140px; }
.hero--flat { padding-bottom: 72px; }
.crumbs { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
.crumbs a { text-decoration: none; color: var(--band-muted); }
.crumbs a:hover { color: var(--band-ink); }
.hero--blog h1 { max-width: 22ch; }
.facts { display: flex; flex-wrap: wrap; gap: var(--space-md) var(--space-xxl); margin-top: var(--space-xl); padding-top: var(--space-lg); border-top: 1px solid var(--band-line); }
.facts dd { margin-top: 4px; font-size: 17px; font-weight: 500; }

.layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-xl) 64px; margin-top: 24px; }
.layout--flush { margin-top: 0; }
.rail { display: none; }
.rail ol { display: grid; gap: 2px; margin-top: var(--space-sm); border-left: 1px solid var(--line); }
.rail a { display: block; padding: 7px 0 7px 14px; margin-left: -1px; border-left: 2px solid transparent; color: var(--muted); font-size: 14px; line-height: 1.35; text-decoration: none; transition: color var(--motion-feedback) var(--easing), border-color var(--motion-feedback) var(--easing); }
.rail a:hover { color: var(--ink); }
.rail a[aria-current='location'] { color: var(--accent); border-color: var(--accent); font-weight: 500; }
.content { min-width: 0; }

.block { margin-top: 88px; }
.block--tight { margin-top: 56px; }
.after { margin-top: var(--space-xl); }
.para { margin-top: var(--space-md); }
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: var(--space-xl) var(--space-xxl); margin-top: var(--space-md); padding: 32px; }
.faqs { display: grid; gap: 0; border-top: 1px solid var(--line); }
.faq { padding-block: 22px; border-bottom: 1px solid var(--line); }
.faq h3 { font-size: 19px; }
.faq p { margin-top: 6px; max-width: 66ch; }
.source { padding: 24px 28px; border: 1px solid var(--line); border-radius: var(--radius-medium); background: var(--tint); }
.source ul { display: grid; gap: var(--space-xxs); margin-top: var(--space-xs); overflow-wrap: anywhere; }

@media (min-width: 1100px) {
  .layout { grid-template-columns: 200px minmax(0, 1fr); margin-top: 32px; }
  .rail { display: block; position: sticky; top: 92px; align-self: start; max-height: calc(100vh - 110px); overflow: auto; padding-top: 88px; }
  .layout--flush .rail { padding-top: 64px; }
  .layout--flush .block:first-child { margin-top: 64px; }
}
@media (max-width: 640px) {
  .charts { padding: var(--space-lg); }
  .block { margin-top: 64px; }
  .hero--blog { padding-bottom: 120px; }
  .facts { gap: var(--space-md) var(--space-xl); }
}
</style>
