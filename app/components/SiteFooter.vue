<script setup lang="ts">
import { BRAND } from '#shared/brand'
</script>

<template>
  <footer class="foot">
    <div class="wrap grid">
      <div class="who">
        <NuxtLink to="/" class="brand" :aria-label="`${BRAND.name} home`"><BrandWordmark :size="22" /></NuxtLink>
        <p>Every figure on every page is calculated from the source file. The copy is written afterwards and checked against those figures.</p>
      </div>
      <nav aria-labelledby="foot-product">
        <h2 id="foot-product">Product</h2>
        <ul>
          <li><NuxtLink to="/blog">Rankings</NuxtLink></li>
          <li><NuxtLink to="/how-it-works">How it works</NuxtLink></li>
          <li><NuxtLink to="/generate">Generate</NuxtLink></li>
        </ul>
      </nav>
      <nav aria-labelledby="foot-legal">
        <h2 id="foot-legal">Legal</h2>
        <ul>
          <li><NuxtLink to="/privacy">Privacy</NuxtLink></li>
          <li><NuxtLink to="/terms">Terms</NuxtLink></li>
        </ul>
      </nav>
      <nav aria-labelledby="foot-more">
        <h2 id="foot-more">More</h2>
        <ul>
          <li><a href="/feed.xml">RSS feed</a></li>
          <li><a :href="BRAND.repo" rel="noopener">Source code</a></li>
          <li><ThemeToggle /></li>
        </ul>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.foot { padding-block: 36px 44px; border-top: 1px solid var(--ink); font-size: 14px; }
.grid { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 2fr) minmax(0, 2fr) minmax(0, 3fr); gap: var(--space-xl); }
.who { display: grid; align-content: start; gap: 14px; color: var(--ink-2); }
.who p { max-width: 42ch; }
.brand { display: inline-flex; justify-self: start; color: var(--ink); }
h2 { margin-bottom: var(--space-sm); font-size: 14px; font-weight: 600; letter-spacing: 0; }
ul { display: grid; gap: var(--space-xs); }
a:hover { color: var(--accent); }
@media (max-width: 760px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .who { grid-column: 1 / -1; }
}
</style>
