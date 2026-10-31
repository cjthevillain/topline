<script setup lang="ts">
import { BRAND } from '#shared/brand'

useSiteMeta({
  title: `Privacy | ${BRAND.name}`,
  description: 'What Topline stores, who processes it, how long it is kept and how to have it removed.',
  path: '/privacy',
})
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <h1>Privacy</h1>
      <p class="muted">Last updated 31 October 2026.</p>
    </header>
    <div class="doc prose">
      <h2>Who runs Topline</h2>
      <p>{{ BRAND.name }} is run by {{ BRAND.operator }}, who is the data controller. You can reach us at <a :href="`mailto:${BRAND.email}`">{{ BRAND.email }}</a>.</p>

      <h2>What you upload</h2>
      <p>Pages are public as soon as they are published, so upload company data only, never personal data. The rows and columns in your file go onto the page. The file name is shown on the page too. The original file is not kept.</p>

      <h2>What we store about you</h2>
      <p>We keep a hash of your IP address, mixed with the date, to apply the daily publishing limit. It is deleted the next day. We do not store your IP address itself, and we do not use accounts.</p>
      <p>Your browser keeps two things on your device: your light or dark choice, and a private token for each page you publish, which lets you remove it. We do not use cookies or advertising trackers.</p>

      <h2>Who else processes data</h2>
      <p>Cloudflare carries all traffic to this site and sees your IP address while doing so. Anthropic receives the summary facts for a page and the first 10 companies, so that Claude can write the copy. It does not receive the whole file.</p>

      <h2>How long pages stay up</h2>
      <p>A page stays published until it is removed. You can remove your own page from the browser you published it with. For anything else, including a page about your company, email us and we will look at it promptly.</p>

      <h2>Your rights</h2>
      <p>Under UK data protection law you can ask to see, correct or delete data about you. You can also complain to the <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner's Office</a>.</p>

    </div>
  </div>
</template>
