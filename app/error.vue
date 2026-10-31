<script setup lang="ts">
import type { NuxtError } from '#app'
import { BRAND } from '#shared/brand'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useSeoMeta({ title: notFound.value ? `Page not found | ${BRAND.name}` : `Something went wrong | ${BRAND.name}`, robots: 'noindex' })
</script>

<template>
  <NuxtLayout>
    <div class="wrap box">
      <p class="figure-value">{{ error.statusCode }}</p>
      <h1>{{ notFound ? 'We could not find that page' : 'Something went wrong' }}</h1>
      <p class="lede muted">{{ notFound ? 'It may have been removed, or the link may be wrong.' : 'Please try again in a moment.' }}</p>
      <div class="actions">
        <NuxtLink to="/blog" class="btn">See all rankings</NuxtLink>
        <NuxtLink to="/generate" class="btn btn-t">Generate a page</NuxtLink>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.box { display: grid; gap: var(--space-md); padding-block: var(--space-xxl) 96px; }
.box h1 { max-width: 18ch; }
.box .actions { margin-top: var(--space-sm); }
</style>
