<script setup lang="ts">
import { BRAND } from '#shared/brand'
import { collectionJsonLd, serialiseJsonLd } from '#shared/seo/jsonld'

const { data: blogs } = await useFetch('/api/blogs', { default: () => [] })
const origin = useSiteOrigin()
const route = useRoute()
const router = useRouter()

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

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
</script>

<template>
  <div class="wrap index">
    <h1>Rankings</h1>
    <p class="lede muted">Each page is one dataset, ranked and checked. New rankings appear here as soon as they are published.</p>

    <form role="search" class="search" @submit.prevent>
      <label class="small" for="search">Search rankings</label>
      <input id="search" v-model="query" class="control" type="search" autocomplete="off" placeholder="Fintech, London, seed">
    </form>

    <p class="small muted count" role="status">{{ shown.length }} of {{ blogs.length }} rankings</p>
    <ul v-if="shown.length" class="list">
      <li v-for="blog in shown" :key="blog.slug">
        <NuxtLink :to="`/blog/${blog.slug}`">{{ blog.title }}</NuxtLink>
        <p class="small muted">{{ blog.description }}</p>
        <p class="small muted">{{ blog.rows }} companies, published {{ dateOf(blog.generatedAt) }}</p>
      </li>
    </ul>
    <p v-else class="none">Nothing matches that search. <NuxtLink to="/generate">Publish a ranking of your own</NuxtLink>.</p>
  </div>
</template>

<style scoped>
.index { padding-block: 64px; }
.lede { max-width: 56ch; margin-top: var(--space-md); }
.search { display: grid; gap: var(--space-xs); max-width: 420px; margin-top: var(--space-xl); }
.count { margin-top: var(--space-lg); }
.list { margin-top: var(--space-md); border-top: 1px solid var(--line); }
.list li { padding-block: var(--space-lg); border-bottom: 1px solid var(--line); }
.list a { font-size: 22px; font-weight: 600; line-height: 1.25; }
.none { margin-top: var(--space-lg); }
</style>
