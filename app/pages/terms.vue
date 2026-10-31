<script setup lang="ts">
import { BRAND } from '#shared/brand'

useSiteMeta({
  title: `Terms | ${BRAND.name}`,
  description: 'The rules for publishing on Topline, and what we do and do not promise.',
  path: '/terms',
})
</script>

<template>
  <div class="wrap page prose">
    <h1>Terms</h1>
    <p class="muted">Last updated 31 October 2026.</p>

    <h2>Using Topline</h2>
    <p>{{ BRAND.name }} is run by {{ BRAND.operator }}. It is free to use, within the daily publishing limits. By publishing a page you agree to these terms.</p>

    <h2>What you can publish</h2>
    <p>Pages are public. Only upload data you have the right to publish. Do not upload personal data, confidential data, or anything unlawful, misleading or defamatory.</p>

    <h2>Who owns what</h2>
    <p>Your data stays yours. By publishing it you allow us to host it and show it on the page. The written copy on a page is generated for you, and you can use it freely.</p>

    <h2>Accuracy</h2>
    <p>Figures are calculated from your file, so a page is only as accurate as that file. The copy is written by an LLM and checked by software, not by a person. Read a page before you rely on it. Nothing on {{ BRAND.name }} is financial advice.</p>

    <h2>Removing pages</h2>
    <p>We can remove any page that breaks these terms, or for any other good reason, without notice. To report a page, use the link at the foot of that page or email <a :href="`mailto:${BRAND.email}`">{{ BRAND.email }}</a>.</p>

    <h2>Availability and liability</h2>
    <p>The service is provided as it is, with no guarantee that it will always be available. Nothing here limits liability that the law does not allow us to limit. Otherwise, we are not liable for any loss caused by using {{ BRAND.name }}.</p>

    <h2>Law</h2>
    <p>These terms are governed by the law of England and Wales.</p>
  </div>
</template>

<style scoped>
.page { padding-block: 64px; }
.page h2 { margin-top: var(--space-xl); font-size: 24px; }
.page h2 + p { margin-top: var(--space-xs); }
</style>
