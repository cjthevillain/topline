<script setup lang="ts">
/** The full logo: the mark and the name. */
import { LOGO } from '#shared/logo'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 22 })
const width = computed(() => Math.round(props.size * (LOGO.width / LOGO.height) * 10) / 10)
</script>

<template>
  <svg :viewBox="LOGO.viewBox" :width="width" :height="size" aria-hidden="true" focusable="false">
    <g :transform="LOGO.markTransform"><path fill="currentColor" :d="LOGO.mark" /></g>
    <g :transform="LOGO.wordTransform"><path fill="currentColor" :d="LOGO.word" /></g>
  </svg>
</template>

<style scoped>
svg { display: block; flex: none; }
</style>
