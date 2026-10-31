<script setup lang="ts">
import { BRAND } from '#shared/brand'
</script>

<template>
  <header class="band top">
    <div class="wrap bar">
      <NuxtLink to="/" class="brand" :aria-label="`${BRAND.name} home`">
        <BrandWordmark :size="22" />
      </NuxtLink>
      <nav aria-label="Main" class="nav">
        <NuxtLink to="/" class="link">Pages</NuxtLink>
        <NuxtLink to="/generate" class="pill pill--line pill--small">Generate a page</NuxtLink>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid rgb(255 255 255 / 0.06); background: var(--band); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); min-height: 68px; }
.brand { display: inline-flex; align-items: center; min-height: 48px; color: inherit; text-decoration: none; }
.nav { display: flex; align-items: center; gap: var(--space-md); }
.link { font-size: 15px; font-weight: 500; text-decoration: none; color: var(--band-muted); transition: color var(--motion-feedback) var(--easing); }
.link:hover, .link.router-link-exact-active { color: var(--band-ink); }
@media (max-width: 640px) {
  .bar { min-height: 64px; }
  .link { display: none; }
  .nav { gap: var(--space-xs); }
}
</style>
