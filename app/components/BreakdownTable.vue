<script setup lang="ts">
import type { Breakdown, Dataset } from '#shared/types/blog'
import { formatAmount } from '#shared/ui/format'

const props = defineProps<{ breakdown: Breakdown; dataset: Pick<Dataset, 'metric'>; overlapping?: boolean }>()
const hasValues = computed(() => props.breakdown.rows.some(row => row.total !== null))
const peak = computed(() => Math.max(...props.breakdown.rows.map(row => row.count), 1))
const amount = (value: number | null) => (value === null ? 'Not disclosed' : formatAmount(value, props.dataset))
</script>

<template>
  <div class="breakdown">
    <table>
      <caption>{{ breakdown.title }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ breakdown.header }}</th>
          <th scope="col" class="num">Companies</th>
          <th scope="col" class="num">Share</th>
          <th v-if="hasValues" scope="col" class="num">Combined</th>
          <th v-if="hasValues" scope="col" class="num hide-m">Median</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in breakdown.rows" :key="row.label">
          <th scope="row">
            {{ row.label }}
            <span class="rule" :style="{ width: `${Math.max((row.count / peak) * 100, 1.5)}%` }" aria-hidden="true" />
          </th>
          <td class="num">{{ row.count }}</td>
          <td class="num">{{ row.share }}%</td>
          <td v-if="hasValues" class="num">{{ amount(row.total) }}</td>
          <td v-if="hasValues" class="num hide-m">{{ amount(row.median) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="overlapping" class="small muted note">Companies can appear in more than one sector.</p>
    <p v-if="breakdown.folded" class="small muted note">{{ breakdown.folded }} smaller {{ breakdown.folded === 1 ? 'group is' : 'groups are' }} {{ overlapping ? 'not shown' : 'combined in Other' }}.</p>
  </div>
</template>

<style scoped>
.breakdown { min-width: 0; }
/* Fixed columns, so the figures line up from one table to the next. */
table { table-layout: fixed; }
thead .num { width: 96px; }
tbody th { overflow-wrap: anywhere; }
/* The length of the rule is the size of the group. */
.rule { display: block; height: 3px; margin-top: 6px; background: var(--accent); }
.note { margin-top: var(--space-xs); }
@media (max-width: 760px) {
  thead .num { width: 84px; }
  thead th:nth-child(3) { width: 56px; }
}
</style>
