<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { headlineTile } from '#shared/pipeline/document'
import { siteJsonLd, serialiseJsonLd } from '#shared/seo/jsonld'
import { formatCount, formatMetric } from '#shared/ui/format'

const { data: blogs } = await useFetch('/api/blogs', { default: () => [] })
const origin = useSiteOrigin()

useSiteMeta({ title: `${BRAND.name}: turn company data into ranked pages`, description: BRAND.description, path: '/' })
useHead({ script: siteJsonLd(origin).map(item => ({ type: 'application/ld+json', innerHTML: serialiseJsonLd(item) })) })

const leadSlug = computed(() => blogs.value.find(blog => blog.seeded)?.slug ?? blogs.value[0]?.slug)
const { data: lead } = leadSlug.value ? await useBlog(leadSlug.value) : { data: ref(null) }
const leadPath = computed(() => `/blog/${leadSlug.value}`)
const others = computed(() => blogs.value.filter(blog => blog.slug !== leadSlug.value))
const handOff = useHandOff()
const carriesLead = computed(() => handOff.value === null || handOff.value === leadSlug.value)

const figure = computed(() => (lead.value ? headlineTile(lead.value) : null))
const topRows = computed(() => lead.value?.dataset.rows.slice(0, 5) ?? [])
const regionColumn = computed(() => lead.value?.dataset.columns.find(column => column.role === 'region'))
const tile = (id: string) => lead.value?.insights.tiles.find(item => item.id === id)
const money = (value: number | null) => (lead.value ? formatMetric(value, lead.value.dataset) : '')
const summary = computed(() => {
  const median = tile('median')
  const share = tile('concentration')
  return [
    tile('total') ? `${tile('total')!.label} across the ${formatCount(lead.value?.dataset.rows.length ?? 0)} companies.` : figure.value?.label,
    median ? `Median ${median.value}.` : '',
    share ? `${share.label.replace('Share held by top', 'Top')} hold ${share.value}.` : '',
  ].filter(Boolean).join(' ')
})

const benefits = ['The full ranking table, sortable and searchable', 'Statistics calculated in code, never estimated', 'Copy checked line by line against the data', 'A page that search engines can index']
const steps = [
  { title: 'Upload', body: 'Drop in any company CSV. Columns are detected from their names and values, so nothing is tied to one industry.' },
  { title: 'Analyse', body: 'Bad rows are cleaned or reported with line numbers. Every statistic is calculated in code.' },
  { title: 'Write', body: 'A language model writes the copy from those facts. Any figure the data cannot support is rejected.' },
  { title: 'Publish', body: 'One template renders the page with its title, description and a sitemap entry.' },
]
const proofs = [
  { title: 'Numbers come from code', body: 'The language model never calculates anything. It only writes around facts that were computed first.' },
  { title: 'Every claim is checked', body: 'Each sentence is checked for figures the data cannot support, for links and for trend claims a single snapshot cannot back.' },
  { title: 'It works without a language model', body: 'If every provider is down, a template built from the data takes over and the page says so.' },
]
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
</script>

<template>
  <div>
    <div class="wrap">
      <div class="lead">
        <section v-if="lead" class="lead-main" aria-labelledby="lead-title">
          <div class="rank-head">
            <p class="meta">
              <span>Published ranking</span>
              <span><b>{{ longDate(lead.provenance.generatedAt) }}</b></span>
              <span><b>{{ formatCount(lead.dataset.rows.length) }}</b> companies</span>
              <span v-if="lead.dataset.metric">Ranked by <b>{{ lead.dataset.metric.label }}</b></span>
            </p>
            <h1 id="lead-title" :class="{ 'vt-title': carriesLead }">{{ lead.copy.h1 }}</h1>
          </div>
          <div v-if="figure" class="figure">
            <span class="figure-value" :class="{ 'vt-figure': carriesLead }">{{ figure.value }}</span>
            <span class="figure-label">{{ summary }}</span>
          </div>
          <table>
            <caption class="sr-only">The top five of {{ lead.copy.h1 }}</caption>
            <thead>
              <tr>
                <th scope="col" class="num pos">Rank</th>
                <th scope="col">Company</th>
                <th v-if="regionColumn" scope="col" class="hide-m">{{ regionColumn.header }}</th>
                <th v-if="lead.dataset.metric" scope="col" class="num">{{ lead.dataset.metric.header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topRows" :key="row.rank">
                <td class="num pos">{{ row.rank }}</td>
                <th scope="row" class="who">{{ row.name }}</th>
                <td v-if="regionColumn" class="hide-m">{{ row.cells[regionColumn.id] }}</td>
                <td v-if="lead.dataset.metric" class="num">{{ money(row.metric) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="actions">
            <NuxtLink :to="leadPath" class="btn btn-t" @click="handOff = leadSlug ?? null">See the full ranking of {{ formatCount(lead.dataset.rows.length) }}</NuxtLink>
          </div>
        </section>

        <aside class="lead-side">
          <h2>Make a page like this from your own CSV.</h2>
          <p>Upload a list of companies. {{ BRAND.name }} ranks them, works out every statistic in code and writes the page copy. Each sentence is checked against the figures before anything is published.</p>
          <p>Any industry. Any column names. No code and no rebuild.</p>
          <div class="actions">
            <NuxtLink to="/generate" class="btn">Upload a CSV</NuxtLink>
            <NuxtLink to="/how-it-works" class="btn btn-t">How it works</NuxtLink>
          </div>
          <ul class="ruled" aria-label="What you get">
            <li v-for="(benefit, i) in benefits" :key="benefit"><span>{{ i + 1 }}</span>{{ benefit }}</li>
          </ul>
        </aside>
      </div>
    </div>

    <section v-if="others.length" class="band" aria-labelledby="rankings-heading">
      <div class="wrap band-grid">
        <div>
          <h2 id="rankings-heading">Rankings</h2>
          <p class="muted">Every published page is one dataset. New uploads appear here when they are published.</p>
        </div>
        <div>
          <table class="list">
            <thead>
              <tr>
                <th scope="col">Ranking</th>
                <th scope="col" class="num hide-m">Companies</th>
                <th scope="col" class="num hide-m">Total</th>
                <th scope="col" class="num">Published</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="blog in others.slice(0, 6)" :key="blog.slug">
                <th scope="row"><NuxtLink :to="`/blog/${blog.slug}`" :class="{ 'vt-title': handOff === blog.slug }" class="title" @click="handOff = blog.slug">{{ blog.title }}</NuxtLink></th>
                <td class="num hide-m">{{ formatCount(blog.rows) }}</td>
                <td class="num hide-m"><span :class="{ 'vt-figure': handOff === blog.slug && blog.headline }" class="value">{{ blog.headline?.value ?? 'n/a' }}</span></td>
                <td class="num">{{ dateOf(blog.generatedAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="actions more"><NuxtLink to="/blog" class="btn btn-t">See every ranking</NuxtLink></div>
        </div>
      </div>
    </section>

    <section class="band" aria-labelledby="how-heading">
      <div class="wrap band-grid">
        <div>
          <h2 id="how-heading">Set it up once. It works for every industry.</h2>
          <p class="muted">Nothing is tied to fintech. Columns are read from their names and values, and the same template renders every page.</p>
        </div>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="step.title" class="step">
            <span class="step-no">0{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.body }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="band" aria-labelledby="trust-heading">
      <div class="wrap band-grid">
        <h2 id="trust-heading">Your data decides what the page can say.</h2>
        <ol class="steps">
          <li v-for="(proof, i) in proofs" :key="proof.title" class="step">
            <span class="step-no">{{ i + 1 }}</span>
            <h3>{{ proof.title }}</h3>
            <p>{{ proof.body }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="band" aria-labelledby="start-heading">
      <div class="wrap start">
        <div>
          <h2 id="start-heading">Bring a CSV. Leave with a page.</h2>
          <p class="muted">Any industry, any column names. You see what was found before anything is published.</p>
        </div>
        <NuxtLink to="/generate" class="btn">Generate a page</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lead { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); border-bottom: 1px solid var(--ink); }
.lead-main { display: flex; flex-direction: column; gap: 28px; padding: 36px var(--space-xxl) 40px 0; border-right: 1px solid var(--line); }
.lead-side { display: flex; flex-direction: column; gap: 20px; padding: 36px 0 40px var(--space-xxl); }
.lead-side h2 { font-size: 28px; }
.lead-side p { max-width: 38ch; }
.rank-head { display: flex; flex-direction: column; gap: 14px; }
.pos { width: 44px; color: var(--ink-2); }
.who { font-weight: 500; }
.list .title { display: block; width: fit-content; font-weight: 500; }
.list a:hover { color: var(--accent); }
.list tbody th, .list tbody td { padding-block: var(--space-md); }
.list .value { display: inline-block; font-weight: 500; }
.more { margin-top: var(--space-md); }
.start { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; }
.start h2 { max-width: 18ch; font-size: 36px; }
.start .muted { max-width: 44ch; margin-top: 10px; }
@media (max-width: 760px) {
  .lead { grid-template-columns: minmax(0, 1fr); }
  .lead-main { gap: 22px; padding: var(--space-lg) 0 28px; border-right: 0; border-bottom: 1px solid var(--ink); }
  .lead-side { padding: 28px 0 var(--space-xl); }
  .lead-side h2 { font-size: 24px; }
  .start { flex-direction: column; align-items: flex-start; gap: var(--space-lg); }
  .start h2 { font-size: 30px; }
}
</style>
