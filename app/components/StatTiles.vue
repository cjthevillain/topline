<script setup lang="ts">
import type { Tile } from '#shared/types/blog'

defineProps<{ tiles: Tile[] }>()
</script>

<template>
  <dl class="stats" :style="{ '--cols': tiles.length % 3 === 0 ? 3 : Math.min(tiles.length, 4) }" v-reveal>
    <div v-for="(tile, i) in tiles" :key="tile.id" class="stat" :style="{ '--reveal-delay': `${i * 60}ms` }" v-reveal>
      <dt class="label">{{ tile.label }}</dt>
      <dd>
        <span class="value" v-count>{{ tile.value }}</span>
        <span class="small muted note">{{ tile.note }}</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 1px; border: 1px solid var(--line); border-radius: var(--radius-large); background: var(--line); overflow: hidden; }
.stat { display: grid; align-content: start; gap: var(--space-sm); padding: 28px; background: var(--sheet); }
.value { display: block; font-size: clamp(36px, 4vw, 52px); font-weight: 600; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: lining-nums; overflow-wrap: anywhere; }
.note { display: block; margin-top: 10px; text-wrap: pretty; }
@media (max-width: 900px) { .stats { grid-template-columns: repeat(min(var(--cols, 3), 2), minmax(0, 1fr)); } }
@media (max-width: 480px) { .stat { padding: 18px; } .value { font-size: 30px; } }
</style>
