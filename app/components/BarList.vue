<script setup lang="ts">
import type { Breakdown, Dataset } from '#shared/types/blog'
import { formatAmount } from '#shared/ui/format'

const props = defineProps<{ breakdown: Breakdown; dataset: Pick<Dataset, 'metric'>; overlapping?: boolean }>()
const peak = computed(() => Math.max(...props.breakdown.rows.map(r => r.count), 1))
const describe = (row: Breakdown['rows'][number]) =>
  `${row.label}: ${row.count} (${row.share}%)${row.total !== null ? `, ${formatAmount(row.total, props.dataset)} combined` : ''}`
</script>

<template>
  <figure class="chart" v-reveal>
    <figcaption>
      <h3>{{ breakdown.title }}</h3>
      <p class="label">From the {{ breakdown.header }} column</p>
    </figcaption>
    <ul>
      <li v-for="(row, i) in breakdown.rows" :key="row.label" :title="describe(row)" :style="{ '--grow-delay': `${i * 60}ms` }">
        <span class="name">{{ row.label }}</span>
        <span class="count num">{{ row.count }}<span class="share muted"> {{ row.share }}%</span><span class="sr-only"> companies</span></span>
        <span class="track" aria-hidden="true"><span class="fill grow" :style="{ width: `${Math.max((row.count / peak) * 100, 1.5)}%` }" /></span>
      </li>
    </ul>
    <p v-if="overlapping" class="small muted foot">Companies can appear in more than one sector.</p>
    <p v-if="breakdown.folded" class="small muted foot">{{ breakdown.folded }} smaller {{ breakdown.folded === 1 ? 'group is' : 'groups are' }} {{ overlapping ? 'not shown' : 'combined in Other' }}.</p>
  </figure>
</template>

<style scoped>
.chart { min-width: 0; }
figcaption .label { margin-top: 4px; }
ul { margin-top: var(--space-md); }
li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px var(--space-sm); padding-block: 10px; font-size: 15px; line-height: 1.3; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { font-weight: 600; }
.share { margin-left: 6px; font-weight: 400; font-size: 13px; }
.track { grid-column: 1 / -1; display: block; height: 8px; border-radius: 4px; background: var(--accent-tint); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
.foot { margin-top: var(--space-sm); }
</style>
