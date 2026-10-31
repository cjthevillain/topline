<script setup lang="ts">
/**
 * The wordmark: the mark is the capital T of the name. It stands on the text
 * baseline and the o tucks under its crossbar, as a kerned T and o would.
 */
import { BRAND } from '#shared/brand'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 22 })
const rest = BRAND.name.slice(1)
const markSize = computed(() => Math.round(props.size * 0.92 * 10) / 10)
</script>

<template>
  <span class="wordmark" :style="{ '--size': `${size}px` }">
    <BrandMark :size="markSize" />
    <span class="sr-only">{{ BRAND.name }}</span>
    <span class="rest" aria-hidden="true">{{ rest }}</span>
  </span>
</template>

<style scoped>
.wordmark { display: inline-flex; align-items: baseline; font-size: var(--size); font-weight: 600; letter-spacing: -0.025em; line-height: 1; white-space: nowrap; }
.wordmark :deep(.mark) { align-self: baseline; margin-right: calc(var(--size) * -0.27); transform: translateY(calc(var(--size) * 0.06)); }
.rest { display: inline-block; }
</style>
