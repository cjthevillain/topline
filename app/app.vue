<script setup lang="ts">
import { BRAND } from '#shared/brand'

// Runs before the first paint, so a saved dark theme never flashes light.
const boot = `(function(){try{if(localStorage.getItem('${BRAND.name.toLowerCase()}-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}})()`

const { umamiOrigin, umamiWebsiteId } = useRuntimeConfig().public

useHead({
  script: [
    { innerHTML: boot, tagPosition: 'head', tagPriority: 'critical' },
    ...(umamiWebsiteId ? [{ 'src': `${umamiOrigin}/script.js`, 'defer': true, 'data-website-id': umamiWebsiteId }] : []),
  ],
  meta: [
    { name: 'application-name', content: BRAND.name },
    { name: 'apple-mobile-web-app-title', content: BRAND.name },
    { name: 'format-detection', content: 'telephone=no' },
  ],
  link: [{ rel: 'alternate', type: 'application/rss+xml', title: `${BRAND.name} rankings`, href: '/feed.xml' }],
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
