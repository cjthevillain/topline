<script setup lang="ts">
/**
 * The Topline mark: a T whose crossbar rises, the top line of a ranking.
 * The stem takes the text colour and the crossbar takes the accent, so it
 * works on light, dark and ink surfaces without a container.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <svg class="mark" viewBox="0 0 64 64" :width="size" :height="size" aria-hidden="true" focusable="false">
    <path d="M9 21 55 10" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" fill="none" />
    <path d="M32 20v34" stroke="currentColor" stroke-width="11" stroke-linecap="round" fill="none" />
  </svg>
</template>

<style scoped>
.mark { display: block; flex: none; }
</style>
