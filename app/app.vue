<script setup lang="ts">
import { BRAND } from '#shared/brand'

// Runs before the first paint: restores the saved theme and marks that
// JavaScript is on, which is what turns the scroll reveals on. Light is the
// default whatever the device prefers, and there is no flash either way.
// If the app has not started after four seconds, the reveals are switched off
// again, so a failed script download can never leave content hidden.
const boot = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${BRAND.name.toLowerCase()}-theme');if(t==='dark'){d.setAttribute('data-theme','dark')}}catch(e){}d.classList.add('js');setTimeout(function(){if(!d.classList.contains('ready'))d.classList.remove('js')},4000)})()`

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
