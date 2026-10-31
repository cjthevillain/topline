<script setup lang="ts">
import { BRAND } from '#shared/brand'

const route = useRoute()
const navigating = useNavigating()
const inRankings = computed(() => route.path.startsWith('/blog'))
</script>

<template>
  <header class="masthead">
    <div class="wrap bar">
      <NuxtLink to="/" class="brand" :aria-label="`${BRAND.name} home`"><BrandWordmark :size="22" /></NuxtLink>
      <nav aria-label="Main" class="nav">
        <NuxtLink to="/blog" :class="{ 'is-current': inRankings }">Rankings</NuxtLink>
        <NuxtLink to="/how-it-works" active-class="is-current">How it works</NuxtLink>
      </nav>
      <NuxtLink to="/generate" class="btn cta">Generate a page</NuxtLink>
    </div>
    <span v-if="navigating" class="loading" aria-hidden="true" />
  </header>
</template>

<style scoped>
.masthead { position: relative; border-top: 4px solid var(--ink); border-bottom: 1px solid var(--ink); background: var(--page); }
.bar { display: flex; align-items: center; gap: 40px; min-height: 60px; }
.brand { display: inline-flex; align-items: center; min-height: 44px; margin-right: var(--space-xs); color: var(--ink); }
.nav { display: flex; flex: 1; gap: 28px; font-size: 15px; font-weight: 500; }
.nav a { position: relative; display: inline-flex; align-items: center; min-height: 59px; }
.nav a:hover { color: var(--accent); }
.nav .is-current::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--ink); view-transition-name: nav-rule; }
.loading { position: absolute; left: 0; right: 0; bottom: -1px; height: 3px; overflow: hidden; }
.loading::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 30%; background: var(--accent); animation: rule-run 900ms linear infinite; }
@media (max-width: 760px) {
  .bar { flex-wrap: wrap; gap: 0 var(--space-md); justify-content: space-between; min-height: 0; padding-top: 8px; }
  .cta { min-height: 40px; padding: 9px 14px; font-size: 14px; }
  .nav { order: 3; flex-basis: 100%; gap: var(--space-lg); margin-top: var(--space-xxs); border-top: 1px solid var(--line); font-size: 14px; }
  .nav a { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .loading::before { width: 100%; animation: none; } }
</style>
