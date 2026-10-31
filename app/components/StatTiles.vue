<script setup lang="ts">
import type { Tile } from '#shared/types/blog'

defineProps<{ tiles: Tile[] }>()
</script>

<template>
  <dl class="stats" :style="{ '--cols': Math.min(tiles.length, 6) }">
    <div v-for="tile in tiles" :key="tile.id" class="stat">
      <dd class="value">{{ tile.value }}</dd>
      <dt class="name">{{ tile.label }}</dt>
      <dd class="note">{{ tile.note }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
.stat { display: flex; flex-direction: column; gap: var(--space-xxs); min-width: 0; padding: 18px var(--space-md); border-right: 1px solid var(--line); overflow-wrap: anywhere; }
.stat:first-child { padding-left: 0; }
.stat:last-child { padding-right: 0; border-right: 0; }
.value { font-size: 34px; font-weight: 500; line-height: 1.05; letter-spacing: -0.025em; }
.name { margin-top: var(--space-xxs); font-size: 14px; font-weight: 500; }
.note { color: var(--ink-2); font-size: 13px; }
@media (max-width: 1000px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .stat:nth-child(3n) { padding-right: 0; border-right: 0; }
  .stat:nth-child(3n + 1) { padding-left: 0; }
  .stat:nth-child(n + 4) { border-top: 1px solid var(--line); }
  .stat:last-child:nth-child(3n + 1) { grid-column: 1 / -1; }
  .stat:last-child:nth-child(3n + 2) { grid-column: span 2; }
}
@media (max-width: 760px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat, .stat:nth-child(3n), .stat:nth-child(3n + 1) { padding: 14px var(--space-sm); border-right: 1px solid var(--line); }
  .stat:nth-child(2n) { padding-right: 0; border-right: 0; }
  .stat:nth-child(2n + 1) { padding-left: 0; }
  .stat:nth-child(n + 3) { border-top: 1px solid var(--line); }
  .stat:last-child:nth-child(3n + 1), .stat:last-child:nth-child(3n + 2) { grid-column: auto; }
  .stat:last-child:nth-child(odd) { grid-column: 1 / -1; padding-right: 0; border-right: 0; }
  .value { font-size: 28px; }
}
</style>
