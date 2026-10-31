<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { collectionJsonLd, serialiseJsonLd } from '#shared/seo/jsonld'
import { formatCount } from '#shared/ui/format'

const { data: blogs } = await useFetch('/api/blogs', { default: () => [] })
const origin = useSiteOrigin()
const route = useRoute()
const router = useRouter()
const handOff = useHandOff()

useSiteMeta({
  title: `Company rankings | ${BRAND.name}`,
  description: 'Browse company rankings built from real datasets. Every figure on every page comes from the source data.',
  path: '/blog',
})
useHead({ script: [{ type: 'application/ld+json', innerHTML: serialiseJsonLd(collectionJsonLd(blogs.value, origin)) }] })

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const shown = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return blogs.value.filter((blog) => {
    const text = `${blog.title} ${blog.topic} ${blog.description}`.toLowerCase()
    return words.every(word => text.includes(word))
  })
})
watch(query, value => router.replace({ query: value ? { q: value } : {} }))

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <h1>Rankings</h1>
      <p class="lede muted">Each page is one dataset, ranked and checked. New rankings appear here as soon as they are published.</p>
    </header>

    <form role="search" class="search" @submit.prevent>
      <div>
        <label class="small" for="search">Search rankings</label>
        <input id="search" v-model="query" class="control" type="search" autocomplete="off" placeholder="Fintech, London, seed">
      </div>
      <p class="small muted" role="status">{{ shown.length }} of {{ blogs.length }} rankings</p>
    </form>

    <table v-if="shown.length" class="list">
      <caption class="sr-only">Published rankings</caption>
      <thead>
        <tr>
          <th scope="col">Ranking</th>
          <th scope="col" class="num hide-m">Companies</th>
          <th scope="col" class="hide-m">Ranked by</th>
          <th scope="col" class="num">Total</th>
          <th scope="col" class="num hide-m">Published</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="blog in shown" :key="blog.slug">
          <th scope="row">
            <NuxtLink :to="`/blog/${blog.slug}`" class="title" :class="{ 'vt-title': handOff === blog.slug }" @click="handOff = blog.slug">{{ blog.title }}</NuxtLink>
            <span class="description">{{ blog.description }}</span>
          </th>
          <td class="num hide-m">{{ formatCount(blog.rows) }}</td>
          <td class="hide-m ranked">{{ blog.rankedBy ?? 'File order' }}</td>
          <td class="num"><span class="value" :class="{ 'vt-figure': handOff === blog.slug && blog.headline }">{{ blog.headline?.value ?? 'n/a' }}</span></td>
          <td class="num hide-m">{{ dateOf(blog.generatedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="none">Nothing matches that search. <NuxtLink to="/generate" class="link">Publish a ranking of your own</NuxtLink>.</p>
  </div>
</template>

<style scoped>
.search { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--space-sm) var(--space-lg); padding-block: var(--space-lg); }
.search > div { display: grid; flex: 1 1 280px; gap: var(--space-xxs); max-width: 420px; }
.search label { font-weight: 500; }
.search > p { padding-bottom: var(--space-sm); }
.list { margin-bottom: var(--space-xxxl); }
.list tbody th, .list tbody td { padding-block: var(--space-md); }
.title { display: block; width: fit-content; font-size: 20px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.title:hover { color: var(--accent); }
.description { display: block; max-width: 66ch; margin-top: var(--space-xxs); color: var(--ink-2); font-size: 14px; line-height: 1.4; }
.value { display: inline-block; font-size: 20px; font-weight: 500; letter-spacing: -0.01em; }
.ranked::first-letter { text-transform: uppercase; }
.none { padding-block: var(--space-lg) var(--space-xxxl); }
</style>
