<script setup lang="ts">
/** The Topline mark: the top line of a report over a figure 1. Together they also read as a T. */
import { LOGO } from '#shared/logo'

withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" aria-hidden="true" focusable="false">
    <path fill="currentColor" :d="LOGO.mark" />
  </svg>
</template>

<style scoped>
svg { display: block; flex: none; }
</style>
