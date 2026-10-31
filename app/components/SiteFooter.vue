<script setup lang="ts">
import { BRAND } from '#shared/brand'
</script>

<template>
  <footer class="foot">
    <div class="wrap grid">
      <div class="who">
        <NuxtLink to="/" class="brand" :aria-label="`${BRAND.name} home`"><BrandWordmark :size="20" /></NuxtLink>
        <p class="small muted">{{ BRAND.tagline }}.</p>
      </div>
      <nav aria-label="Footer" class="links">
        <NuxtLink to="/">Published pages</NuxtLink>
        <NuxtLink to="/generate">Generate a page</NuxtLink>
      </nav>
      <p class="small muted note">Every figure on every page is calculated from the source file. Copy from an LLM is checked against those figures, and a data template takes over if the LLM fails.</p>
    </div>
  </footer>
</template>

<style scoped>
.foot { margin-top: 120px; padding-block: 40px 48px; border-top: 1px solid var(--line); }
.grid { display: grid; grid-template-columns: 1.2fr 0.8fr 1.4fr; gap: var(--space-xl); align-items: start; }
.who { display: grid; gap: var(--space-sm); justify-items: start; }
.brand { display: inline-flex; color: inherit; text-decoration: none; }
.links { display: grid; gap: var(--space-xs); justify-items: start; }
.links a { min-height: 32px; display: inline-flex; align-items: center; color: var(--ink); font-size: 15px; font-weight: 500; text-decoration: none; }
.links a:hover { color: var(--accent); }
.note { max-width: 46ch; }
@media (max-width: 820px) { .grid { grid-template-columns: 1fr; gap: var(--space-lg); } .foot { margin-top: 88px; } }
</style>
