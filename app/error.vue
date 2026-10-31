<script setup lang="ts">
import type { NuxtError } from '#app'
import { BRAND } from '#shared/brand'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useSeoMeta({ title: notFound.value ? `Page not found | ${BRAND.name}` : `Something went wrong | ${BRAND.name}`, robots: 'noindex' })
</script>

<template>
  <NuxtLayout>
    <section class="band hero-band">
      <div class="wrap hero box">
        <p class="label">{{ error.statusCode }}</p>
        <h1>{{ notFound ? 'We could not find that page' : 'Something went wrong' }}</h1>
        <p class="lede">{{ notFound ? 'It may have been removed, or the link may be wrong.' : 'Please try again in a moment.' }}</p>
        <div class="actions">
          <NuxtLink to="/" class="pill">Back to all pages</NuxtLink>
          <NuxtLink to="/generate" class="pill pill--line">Generate a page</NuxtLink>
        </div>
      </div>
    </section>
  </NuxtLayout>
</template>

<style scoped>
.box { padding-block: 96px 120px; }
.box h1 { max-width: 16ch; }
</style>
