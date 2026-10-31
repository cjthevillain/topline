<script setup lang="ts">
import type { Dataset, DatasetRow, TableColumn } from '#shared/types/blog'
import { formatCell, formatCount, formatMetric, sortValue } from '#shared/ui/format'

const props = defineProps<{ dataset: Dataset; caption: string }>()

const query = ref('')
const sortKey = ref('rank')
const descending = ref(false)

const metricHeader = computed(() => props.dataset.metric?.header ?? null)
// A column with one value says nothing per row, so it becomes a note instead.
const constants = computed(() => props.dataset.constants)
const shownColumns = computed(() => props.dataset.columns.filter(c => !constants.value.some(k => k.header === c.header)))

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
  return value.length > 2 ? `${value.slice(0, 2).join(', ')} and ${value.length - 2} more` : value.join(', ')
}
</script>

<template>
  <div>
    <div class="tools">
      <div class="search">
        <label class="small" for="table-search">Search the table</label>
        <input id="table-search" v-model="query" class="control" type="search" placeholder="Name, location or sector" autocomplete="off">
      </div>
      <p class="small muted" role="status">Showing {{ formatCount(visible.length) }} of {{ formatCount(dataset.rows.length) }}</p>
    </div>

    <div class="scroller" tabindex="0" role="region" :aria-label="`${caption}, scrollable table`">
      <table>
        <caption class="sr-only">{{ caption }}</caption>
        <thead>
          <tr>
            <th scope="col" class="num rank" :aria-sort="ariaSort('rank')"><button type="button" @click="sortBy('rank')">Rank</button></th>
            <th scope="col" class="name" :aria-sort="ariaSort('name')"><button type="button" @click="sortBy('name')">Company</button></th>
            <th v-if="metricHeader" scope="col" class="num" :aria-sort="ariaSort('metric')"><button type="button" @click="sortBy('metric')">{{ metricHeader }}</button></th>
            <th v-for="column in shownColumns" :key="column.id" scope="col" :class="{ num: isNumeric(column) }" :aria-sort="ariaSort(column.id)">
              <button type="button" @click="sortBy(column.id)">{{ column.header }}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.rank">
            <td class="num rank">{{ row.rank }}</td>
            <th scope="row" class="name">
              <a v-if="row.url" :href="row.url" rel="nofollow noopener" target="_blank">{{ row.name }}</a>
              <span v-else>{{ row.name }}</span>
              <span v-if="row.description" class="description">{{ row.description }}</span>
            </th>
            <td v-if="metricHeader" class="num metric" :class="{ missing: row.metric === null }">{{ formatMetric(row.metric, dataset) }}</td>
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
.tools { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--space-sm) var(--space-lg); margin-bottom: var(--space-md); }
.search { display: grid; flex: 1 1 280px; gap: var(--space-xxs); max-width: 420px; }
.search label { font-weight: 500; }
.tools > p { padding-bottom: var(--space-sm); }
.scroller { overflow-x: auto; overscroll-behavior-x: contain; }
.same { margin-top: var(--space-sm); }
table { font-size: 14px; }
thead th { padding: 0; }
thead button { width: 100%; min-height: 36px; padding: 8px var(--space-sm) 8px 0; border: 0; background: none; color: var(--ink-2); font-size: 13px; font-weight: 500; text-align: inherit; cursor: pointer; }
thead th:last-child button { padding-right: 0; }
thead button:hover { color: var(--accent); }
th[aria-sort='ascending'] button, th[aria-sort='descending'] button { color: var(--ink); font-weight: 600; }
thead th[aria-sort='ascending'] button::after { content: ' \2191'; }
thead th[aria-sort='descending'] button::after { content: ' \2193'; }
tbody tr:hover > * { background: var(--fill); }
.rank { width: 44px; color: var(--ink-2); }
.name { min-width: 250px; width: 42%; }
tbody .name a, tbody .name > span:first-child { font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
tbody .name a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.description { display: block; margin-top: 2px; color: var(--ink-2); font-size: 13px; line-height: 1.35; }
.metric { font-weight: 500; }
.missing { color: var(--ink-2); font-weight: 400; }
td:not(.num):not(.empty) { min-width: 96px; }
td.tags:not(.num) { min-width: 200px; color: var(--ink-2); }
.empty { padding-block: var(--space-lg); text-align: center; color: var(--ink-2); }
/* The first screen of a phone keeps the rank, the company and the value. A swipe brings in the rest. */
@media (max-width: 760px) {
  .name { min-width: calc(100vw - 196px); width: auto; }
  .rank { width: 32px; }
}
</style>
