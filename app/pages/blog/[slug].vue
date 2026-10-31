<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { headlineTile } from '#shared/pipeline/document'
import { buildJsonLd, serialiseJsonLd } from '#shared/seo/jsonld'
import { formatCount } from '#shared/ui/format'

definePageMeta({ middleware: 'load-ranking' })

const route = useRoute()
const slug = route.params.slug as string
const { data: blog } = await useBlog(slug)
if (!blog.value) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

const doc = blog.value
const origin = useSiteOrigin()

useSiteMeta({
  title: doc.copy.title,
  description: doc.copy.metaDescription,
  path: `/blog/${doc.slug}`,
  image: `/og/${doc.slug}.png`,
  imageAlt: doc.copy.h1,
  type: 'article',
  publishedAt: doc.provenance.generatedAt,
})

useHead({
  script: buildJsonLd(doc, origin).map(item => ({ type: 'application/ld+json', innerHTML: serialiseJsonLd(item) })),
})

if (import.meta.server) {
  useResponseHeader('cache-control').value = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'
}

useHandOff().value = doc.slug

const published = new Date(doc.provenance.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const headingId = (text: string) => text.toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '')
const figure = headlineTile(doc)
const tiles = doc.insights.tiles.filter(tile => tile.id !== figure?.id)
const toc = computed(() => [
  { id: 'ranking', label: 'The full ranking' },
  ...doc.copy.sections.map(s => ({ id: headingId(s.heading), label: s.heading })),
  ...(doc.insights.breakdowns.length ? [{ id: 'breakdowns', label: 'The figures by group' }] : []),
  { id: 'faq', label: 'Questions about this ranking' },
  { id: 'about', label: 'About this page' },
])
const copyLabel = { llm: 'Written by an LLM from the computed facts, then checked', hybrid: 'Written by an LLM, with some sections replaced by the data template after checks', template: 'Written by the data template' }
const warnings = computed(() => doc.dataset.warnings)

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
  <article class="wrap">
    <header class="head">
      <div class="head-main">
        <NuxtLink to="/blog" class="btn btn-t back">All rankings</NuxtLink>
        <h1 class="vt-title">{{ doc.copy.h1 }}</h1>
        <p class="meta">
          <span>Published <b><time :datetime="doc.provenance.generatedAt">{{ published }}</time></b></span>
          <span><b>{{ formatCount(doc.dataset.rows.length) }}</b> companies</span>
          <span v-if="doc.dataset.metric">Ranked by <b>{{ doc.dataset.metric.label }}</b></span>
          <span>Source <b>{{ doc.provenance.sourceFile }}</b></span>
        </p>
      </div>
      <div class="figure">
        <span class="figure-value vt-figure">{{ figure.value }}</span>
        <span class="figure-label">{{ figure.label }}</span>
      </div>
    </header>

    <StatTiles v-if="tiles.length" :tiles="tiles" />

    <div class="summary">
      <div class="intro">
        <p v-for="paragraph in doc.copy.intro" :key="paragraph" class="lede">{{ paragraph }}</p>
      </div>
      <aside class="provenance" aria-label="Where the figures come from">
        <p class="small muted">Figures were calculated from the file on {{ published }}. The copy was written afterwards and checked against them.</p>
        <a :href="`/data/${doc.slug}.csv`" class="btn btn-2" download>Download CSV</a>
      </aside>
    </div>

    <section id="ranking" class="ranking" aria-labelledby="ranking-heading">
      <div class="block-head">
        <h2 id="ranking-heading">The full ranking</h2>
        <p class="small muted">{{ doc.dataset.metric ? `Sorted by ${doc.dataset.metric.label}.` : 'In the order of the source file.' }} Select a column heading to sort.</p>
      </div>
      <LazyRankingTable hydrate-on-visible :dataset="doc.dataset" :caption="doc.copy.h1" />
    </section>

    <div class="body">
      <div class="content">
        <section v-for="section in doc.copy.sections" :id="headingId(section.heading)" :key="section.heading" class="block prose">
          <h2>{{ section.heading }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </section>

        <section v-if="doc.insights.breakdowns.length" id="breakdowns" class="block" aria-labelledby="breakdowns-heading">
          <h2 id="breakdowns-heading">The figures by group</h2>
          <div class="groups">
            <BreakdownTable
              v-for="breakdown in doc.insights.breakdowns"
              :key="breakdown.id"
              :breakdown="breakdown"
              :dataset="doc.dataset"
              :overlapping="breakdown.id === 'category'"
            />
          </div>
        </section>

        <section id="faq" class="block" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Questions about this ranking</h2>
          <ul class="faqs">
            <li v-for="item in doc.copy.faq" :key="item.question" class="faq">
              <h3>{{ item.question }}</h3>
              <p>{{ item.answer }}</p>
            </li>
          </ul>
        </section>

        <aside id="about" class="block about" aria-labelledby="about-heading">
          <h2 id="about-heading">About this page</h2>
          <ul class="ruled small">
            <li><span>Source</span>{{ doc.provenance.sourceFile }}</li>
            <li><span>Rows</span>{{ formatCount(doc.dataset.stats.rowsUsed) }} of {{ formatCount(doc.dataset.stats.rowsInFile) }} used</li>
            <li><span>Copy</span><span>{{ copyLabel[doc.provenance.mode] }}<template v-if="doc.provenance.model"> ({{ doc.provenance.provider }}, {{ doc.provenance.model }})</template>.</span></li>
            <li v-for="warning in warnings" :key="warning.code"><span>Note</span>{{ warning.message }}</li>
          </ul>
          <div class="actions">
            <a :href="`mailto:${BRAND.email}?subject=${encodeURIComponent(`Report: ${doc.slug}`)}`" class="btn btn-t">Report this page</a>
          </div>
          <PageOwner v-if="!doc.seeded" :slug="doc.slug" />
        </aside>
      </div>

      <nav class="rail" aria-labelledby="rail-heading">
        <p id="rail-heading" class="small">On this page</p>
        <ul class="ruled">
          <li v-for="item in toc" :key="item.id">
            <a :href="`#${item.id}`" :aria-current="current === item.id ? 'location' : undefined">{{ item.label }}</a>
          </li>
        </ul>
      </nav>
    </div>
  </article>
</template>

<style scoped>
.head { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: var(--space-xxl); align-items: end; padding-block: 28px 36px; border-bottom: 1px solid var(--ink); }
.back { margin-bottom: 22px; }
.head h1 { font-size: 48px; }
.head .meta { margin-top: var(--space-md); }
.summary { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 3fr); gap: 56px; padding-block: 40px; }
.intro { display: grid; gap: var(--space-sm); }
.provenance { display: grid; gap: var(--space-md); align-content: start; justify-items: start; }
.body { display: grid; grid-template-columns: minmax(0, 8fr) minmax(0, 3fr); gap: 56px; padding-block: var(--space-sm) var(--space-xxxl); }
.content { min-width: 0; }
.block { margin-top: var(--space-xxl); }
.block > h2 { margin-bottom: var(--space-sm); }
.block-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-xxs) var(--space-lg); margin-bottom: var(--space-md); }
.groups { display: grid; gap: var(--space-xl); margin-top: var(--space-md); }
.faqs { margin-top: var(--space-xs); border-top: 1px solid var(--ink); }
.faq { padding-block: 18px; border-bottom: 1px solid var(--line); }
.faq h3 { margin-bottom: 6px; }
.faq p { max-width: 66ch; }
.about .ruled { margin-top: var(--space-xs); }
.about .ruled > li { grid-template-columns: 64px minmax(0, 1fr); overflow-wrap: anywhere; font-size: 14px; }
.about .actions { margin-top: var(--space-md); }
.rail { position: sticky; top: var(--space-lg); display: grid; gap: var(--space-sm); align-self: start; max-height: calc(100vh - 48px); overflow: auto; }
.rail .ruled > li { grid-template-columns: minmax(0, 1fr); padding-block: 0; font-size: 14px; }
.rail a { display: block; padding-block: 9px; color: var(--ink-2); line-height: 1.35; }
.rail a:hover { color: var(--accent); }
.rail a[aria-current='location'] { color: var(--ink); font-weight: 600; }
@media (max-width: 1000px) {
  .summary, .body { grid-template-columns: minmax(0, 1fr); }
  .summary { gap: var(--space-lg); }
  .rail { display: none; }
}
@media (max-width: 760px) {
  .head { grid-template-columns: minmax(0, 1fr); gap: var(--space-lg); padding-block: 20px 28px; }
  .head h1 { font-size: 32px; }
  .summary { padding-block: 28px; }
  .body { padding-block: 0 var(--space-xxl); }
  .block { margin-top: 40px; }
}
</style>
