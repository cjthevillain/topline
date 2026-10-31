<script setup lang="ts">
/**
 * The product working, with real data: the first rows of the source file on
 * the left, and the ranked page they became on the right. Every value comes
 * from the stored document. The sequence is CSS only, so it ends in the same
 * final state with JavaScript off or motion reduced.
 */
import type { BlogDocument } from '#shared/types/blog'
import { formatAmount, formatCell, formatMetric } from '#shared/ui/format'

const props = defineProps<{ doc: BlogDocument; to: string }>()

const constants = computed(() => new Set(props.doc.dataset.constants.map(c => c.header)))
const columns = computed(() => props.doc.dataset.columns.filter(c => c.kind !== 'tags' && !constants.value.has(c.header)).slice(0, 2))
const csvHeaders = computed(() => ['Company', ...columns.value.map(c => c.header), ...(props.doc.dataset.metric ? [props.doc.dataset.metric.header] : [])])
const csvRows = computed(() => props.doc.dataset.rows.slice(0, 6).map(row => [
  row.name,
  ...columns.value.map(c => formatCell(row.cells[c.id] ?? null, c)),
  ...(props.doc.dataset.metric ? [row.metric === null ? '' : formatMetric(row.metric, props.doc.dataset)] : []),
]))

const top = computed(() => props.doc.dataset.rows.slice(0, 5))
const leader = computed(() => top.value[0]?.metric ?? 0)
const width = (value: number | null) => (leader.value && value ? Math.max((value / leader.value) * 100, 2) : 0)
const headline = computed(() => props.doc.insights.tiles.find(t => t.id === 'total') ?? props.doc.insights.tiles[0])
const amount = (value: number | null) => (value === null ? '' : formatAmount(value, props.doc.dataset))
</script>

<template>
  <div class="demo" aria-hidden="true">
    <div class="csv">
      <div class="csv-bar">
        <span class="dot" /><span class="dot" /><span class="dot" />
        <span class="file">{{ doc.provenance.sourceFile }}</span>
      </div>
      <table class="csv-table">
        <thead>
          <tr><th v-for="h in csvHeaders" :key="h">{{ h }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in csvRows" :key="i" :style="{ '--i': i }">
            <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ol class="flow">
      <li>{{ doc.dataset.stats.rowsUsed }} rows read</li>
      <li>Statistics calculated</li>
      <li>Page published</li>
    </ol>

    <NuxtLink :to="to" class="page" tabindex="-1">
      <p class="page-label">{{ doc.context.topic }} ranking</p>
      <p class="page-title">{{ doc.copy.h1 }}</p>
      <div v-if="headline" class="page-stat">
        <span class="page-stat-value">{{ headline.value }}</span>
        <span class="page-stat-label">{{ headline.label }}</span>
      </div>
      <ol class="page-rows">
        <li v-for="(row, i) in top" :key="row.rank" :style="{ '--i': i }">
          <span class="rank">{{ row.rank }}</span>
          <span class="who">{{ row.name }}</span>
          <span class="val">{{ amount(row.metric) }}</span>
          <span class="track"><span class="fill" :style="{ width: `${width(row.metric)}%` }" /></span>
        </li>
      </ol>
    </NuxtLink>
  </div>
</template>

<style scoped>
.demo { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }

.csv { overflow: hidden; border: 1px solid var(--band-line); border-radius: var(--radius-medium); background: var(--band-sheet); font-family: var(--mono); font-size: 12px; color: var(--band-muted); box-shadow: 0 30px 60px -40px rgb(0 0 0 / 0.8); animation: rise 600ms var(--easing) both; }
.csv-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--band-line); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: #3a3d48; }
.file { margin-left: 8px; color: var(--band-muted); letter-spacing: 0.02em; }
.csv-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.csv-table th, .csv-table td { padding: 7px 14px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; border-top: 1px solid rgb(255 255 255 / 0.05); }
.csv-table th { color: #8f93a6; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; font-size: 10.5px; border-top: 0; }
.csv-table td:last-child, .csv-table th:last-child { text-align: right; }
.csv-table td:first-child { color: var(--band-ink); }
.csv-table tbody tr { animation: typed 300ms var(--easing) both; animation-delay: calc(200ms + var(--i) * 110ms); }

.flow { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.flow li { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid var(--band-line); border-radius: var(--radius-full); background: var(--band); background: rgb(from var(--band) r g b / 0.6); color: var(--band-muted); font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; animation: rise 500ms var(--easing) both; }
.flow li:nth-child(1) { animation-delay: 900ms; }
.flow li:nth-child(2) { animation-delay: 1100ms; }
.flow li:nth-child(3) { animation-delay: 1300ms; }
.flow li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--band-accent); }

.demo a.page { display: block; padding: 22px 24px 20px; border: 1px solid var(--line); border-radius: var(--radius-large); background: #fff; color: #14161a; text-decoration: none; box-shadow: 0 40px 80px -40px rgb(0 0 0 / 0.7); animation: rise 700ms var(--easing) both; animation-delay: 1400ms; }
.demo a.page .page-label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #5e6175; }
.demo a.page .page-title { margin-top: 6px; font-size: 19px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; text-wrap: balance; }
.page-stat { display: flex; align-items: baseline; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #e8e9ef; }
.page-stat-value { font-size: 30px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
.demo a.page .page-stat-label { font-size: 13px; color: #5e6175; }
.page-rows { margin-top: 14px; display: grid; gap: 9px; }
.page-rows li { display: grid; grid-template-columns: 2ch minmax(0, 1fr) auto; gap: 2px 12px; align-items: baseline; font-size: 14px; animation: typed 400ms var(--easing) both; animation-delay: calc(1700ms + var(--i) * 120ms); }
.demo a.page .rank { font-family: var(--mono); font-size: 12px; color: #5e6175; }
.who { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.val { font-weight: 500; font-variant-numeric: tabular-nums; }
.track { grid-column: 2 / -1; height: 5px; border-radius: 3px; background: #eef0f5; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 3px; background: #2f2575; transform-origin: left; animation: growx 900ms var(--easing) both; animation-delay: calc(1900ms + var(--i) * 120ms); }

@keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes typed { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
@keyframes growx { from { transform: scaleX(0); } to { transform: none; } }

@media (max-width: 479px) {
  .csv-table th:nth-child(3):not(:last-child), .csv-table td:nth-child(3):not(:last-child) { display: none; }
}
@media (min-width: 980px) {
  .demo { grid-template-columns: minmax(0, 44fr) minmax(0, 18fr) minmax(0, 38fr); gap: 0; align-items: center; }
  .csv { font-size: 13px; }
  .csv-table th, .csv-table td { padding: 9px 16px; }
  .flow { flex-direction: column; align-items: stretch; justify-self: center; width: 100%; padding-inline: 10px; gap: 10px; }
  .flow li { justify-content: start; white-space: nowrap; font-size: 10.5px; letter-spacing: 0.05em; }
  .demo a.page { padding: 26px 28px 24px; }
  .demo a.page .page-title { font-size: 21px; }
  .page-stat-value { font-size: 34px; }
  .page-rows li { font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) {
  .csv, .csv-table tbody tr, .flow li, .demo a.page, .page-rows li, .fill { animation: none; }
}
</style>
