<script setup lang="ts">
import type { Dataset, DatasetRow, TableColumn } from '#shared/types/blog'
import { formatCell, formatMetric, sortValue } from '#shared/ui/format'

const props = defineProps<{ dataset: Dataset; caption: string }>()

const query = ref('')
const sortKey = ref('rank')
const descending = ref(false)

const metricHeader = computed(() => props.dataset.metric?.header ?? null)
// A column with one value says nothing per row, so it becomes a note instead.
const constants = computed(() => props.dataset.constants)
const shownColumns = computed(() => props.dataset.columns.filter(c => !constants.value.some(k => k.header === c.header)))
const peak =computed(() => Math.max(...props.dataset.rows.map(r => r.metric ?? 0), 0))

function valueFor(row: DatasetRow, key: string): string | number | null {
  if (key === 'rank') return row.rank
  if (key === 'name') return row.name
  if (key === 'metric') return row.metric
  return sortValue(row.cells[key] ?? null)
}

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const rows = needle
    ? props.dataset.rows.filter(row => [row.name, row.description ?? '', ...props.dataset.columns.map(c => formatCell(row.cells[c.id] ?? null, c))].join(' ').toLowerCase().includes(needle))
    : props.dataset.rows
  const direction = descending.value ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = valueFor(a, sortKey.value)
    const right = valueFor(b, sortKey.value)
    if (left === null || right === null) return left === right ? a.rank - b.rank : left === null ? 1 : -1
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction || a.rank - b.rank
    return String(left).localeCompare(String(right)) * direction || a.rank - b.rank
  })
})

function sortBy(key: string) {
  if (sortKey.value === key) {
    descending.value = !descending.value
    return
  }
  sortKey.value = key
  descending.value = key === 'metric'
}

function ariaSort(key: string) {
  if (sortKey.value !== key) return 'none'
  return descending.value ? 'descending' : 'ascending'
}

function isNumeric(column: TableColumn) {
  return ['money', 'number', 'percent', 'year'].includes(column.kind)
}

function tagText(value: string[]) {
  return value.length > 2 ? `${value.slice(0, 2).join(', ')} +${value.length - 2}` : value.join(', ')
}

const barWidth = (value: number | null) => (peak.value > 0 && value && value > 0 ? Math.max((value / peak.value) * 100, 2) : 0)
</script>

<template>
  <div>
    <div class="tools">
      <label class="search">
        <span class="label">Search the table</span>
        <span class="field">
          <svg class="glass" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
          <input v-model="query" type="search" placeholder="Name, location or sector" autocomplete="off">
        </span>
      </label>
      <p class="chip" role="status">Showing {{ visible.length }} of {{ dataset.rows.length }}</p>
    </div>

    <div class="scroller sheet" tabindex="0" role="region" :aria-label="`${caption}, scrollable table`">
      <table>
        <caption class="sr-only">{{ caption }}</caption>
        <thead>
          <tr>
            <th scope="col" class="num" :aria-sort="ariaSort('rank')"><button type="button" @click="sortBy('rank')">Rank</button></th>
            <th scope="col" class="name" :aria-sort="ariaSort('name')"><button type="button" @click="sortBy('name')">Company</button></th>
            <th v-if="metricHeader" scope="col" class="num" :aria-sort="ariaSort('metric')"><button type="button" @click="sortBy('metric')">{{ metricHeader }}</button></th>
            <th v-for="column in shownColumns" :key="column.id" scope="col" :class="{ num: isNumeric(column) }" :aria-sort="ariaSort(column.id)">
              <button type="button" @click="sortBy(column.id)">{{ column.header }}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.rank">
            <td class="num rank mono">{{ row.rank }}</td>
            <th scope="row" class="name">
              <a v-if="row.url" :href="row.url" rel="nofollow noopener" target="_blank">{{ row.name }}</a>
              <span v-else>{{ row.name }}</span>
              <span v-if="metricHeader" class="phone-metric" aria-hidden="true">{{ formatMetric(row.metric, dataset) }}</span>
              <span v-if="row.description" class="description">{{ row.description }}</span>
            </th>
            <td v-if="metricHeader" class="num metric" :class="{ missing: row.metric === null }">
              {{ formatMetric(row.metric, dataset) }}
              <span class="bar" aria-hidden="true"><span class="bar-fill" :style="{ width: `${barWidth(row.metric)}%` }" /></span>
            </td>
            <td v-for="column in shownColumns" :key="column.id" :class="{ num: isNumeric(column), tags: column.kind === 'tags', missing: row.cells[column.id] === null }">
              <template v-if="Array.isArray(row.cells[column.id])">{{ tagText(row.cells[column.id] as string[]) }}</template>
              <template v-else>{{ formatCell(row.cells[column.id] ?? null, column) }}</template>
            </td>
          </tr>
          <tr v-if="!visible.length">
            <td :colspan="3 + shownColumns.length" class="empty">No rows match your search.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="constants.length" class="same small muted">
      Every company listed has the same <template v-for="(item, i) in constants" :key="item.header">{{ i ? ' and ' : '' }}{{ item.header }}: {{ item.value }}</template>.
    </p>
  </div>
</template>

<style scoped>
.tools { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--space-sm); margin-bottom: var(--space-md); }
.search { display: grid; gap: 6px; flex: 1 1 280px; max-width: 420px; }
.field { position: relative; display: block; }
.glass { position: absolute; left: 16px; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
input { width: 100%; min-height: 48px; padding: 0 18px 0 44px; border: 1px solid var(--line-control); border-radius: var(--radius-full); background: var(--sheet); color: var(--ink); font: inherit; font-size: 16px; transition: border-color var(--motion-feedback) var(--easing), box-shadow var(--motion-feedback) var(--easing); }
input:hover { border-color: var(--ink); }
input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-tint); }
.tools .chip { min-height: 36px; margin-bottom: 6px; }
/* The edge shadows show only while there is more table to scroll to. */
.scroller {
  overflow-x: auto;
  border-radius: var(--radius-large);
  overscroll-behavior-x: contain;
  background:
    linear-gradient(to right, var(--sheet) 40%, transparent) left / 36px 100% no-repeat local,
    linear-gradient(to left, var(--sheet) 40%, transparent) right / 36px 100% no-repeat local,
    linear-gradient(to right, rgb(0 0 0 / 0.1), transparent) left / 12px 100% no-repeat scroll,
    linear-gradient(to left, rgb(0 0 0 / 0.1), transparent) right / 12px 100% no-repeat scroll,
    var(--sheet);
}
.same { margin-top: var(--space-sm); }
table { width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.4; font-variant-numeric: lining-nums; }
thead th { background: var(--tint); border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
thead th:first-child { border-top-left-radius: var(--radius-large); }
thead th:last-child { border-top-right-radius: var(--radius-large); }
thead button { width: 100%; min-height: 52px; padding: 0 var(--space-md); border: 0; background: none; color: var(--muted); font: 500 12px/1.4 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; text-align: inherit; cursor: pointer; transition: color var(--motion-feedback) var(--easing); }
thead button:hover { color: var(--ink); }
th[aria-sort='ascending'] button, th[aria-sort='descending'] button { color: var(--accent); }
thead th[aria-sort='ascending'] button::after { content: ' \2191'; }
thead th[aria-sort='descending'] button::after { content: ' \2193'; }
tbody td, tbody th { padding: 14px var(--space-md); border-bottom: 1px solid var(--line-soft); vertical-align: top; text-align: left; font-weight: 400; }
tbody tr:last-child > * { border-bottom: 0; }
tbody tr:hover > * { background: var(--tint); }
.num { text-align: right; white-space: nowrap; }
thead .num button { text-align: right; }
thead th:first-child button { padding-inline: 16px 6px; }
tbody .rank { padding-inline: 16px 6px; color: var(--muted); font-size: 13px; padding-top: 16px; }
.name { min-width: 250px; max-width: 420px; }
tbody .name a, tbody .name > span:first-child { color: var(--ink); font-size: 16px; font-weight: 600; text-decoration: none; }
tbody .name a:hover { text-decoration: underline; color: var(--accent); }
.phone-metric { display: none; }
.description { display: block; margin-top: 2px; color: var(--muted); font-size: 14px; line-height: 1.4; }
.metric { font-weight: 600; min-width: 136px; }
.bar { display: block; width: 100%; max-width: 120px; height: 3px; margin: 7px 0 0 auto; border-radius: 2px; background: var(--accent-tint); overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.missing { color: var(--muted); font-weight: 400; }
.missing .bar { visibility: hidden; }
td:not(.num):not(.empty) { min-width: 96px; }
td.tags:not(.num) { min-width: 180px; }
.empty { padding: var(--space-lg); text-align: center; color: var(--muted); }
@media (max-width: 640px) {
  /* The company fills the phone screen; a swipe brings in the other columns. */
  .name { min-width: calc(100vw - 116px); }
  .phone-metric { display: block; margin-top: 2px; font-weight: 600; }
}
</style>
