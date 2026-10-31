<script setup lang="ts">
/** The podium and the spread of values: real rows, read straight from the dataset. */
import type { BlogDocument } from '#shared/types/blog'
import { formatAmount, formatMetric, ordinal } from '#shared/ui/format'

const props = defineProps<{ doc: BlogDocument }>()

const rows = computed(() => props.doc.dataset.rows)
const podium = computed(() => rows.value.slice(0, 3))
const leader = computed(() => podium.value[0]?.metric ?? 0)
const width = (value: number | null) => (leader.value && value ? Math.max((value / leader.value) * 100, 2) : 0)
const regionColumn = computed(() => props.doc.dataset.columns.find(c => c.role === 'region'))
const place = (row: BlogDocument['dataset']['rows'][number]) => {
  const cell = regionColumn.value ? row.cells[regionColumn.value.id] : null
  return typeof cell === 'string' ? cell : null
}

// One bar per company, or one per group of companies when the list is long.
const valued = computed(() => rows.value.filter(r => r.metric !== null))
const per = computed(() => Math.max(1, Math.ceil(valued.value.length / 100)))
const manyEnough = computed(() => valued.value.length > 10)
const bars = computed(() => {
  const out: { value: number; top: boolean; label: string }[] = []
  for (let i = 0; i < valued.value.length; i += per.value) {
    const group = valued.value.slice(i, i + per.value)
    const value = group.reduce((sum, r) => sum + (r.metric ?? 0), 0) / group.length
    const first = group[0]!
    const label = per.value === 1
      ? `${first.rank}. ${first.name}: ${formatMetric(first.metric, props.doc.dataset)}`
      : `Ranks ${first.rank} to ${group[group.length - 1]!.rank}: average ${formatAmount(value, props.doc.dataset)}`
    out.push({ value, top: !manyEnough.value || first.rank <= 10, label })
  }
  return out
})
const max = computed(() => Math.max(...bars.value.map(b => b.value), 1))
// Two paths instead of one element per bar, so a 1,000-row page stays light.
const paths = computed(() => {
  const n = bars.value.length
  const slot = 1000 / n
  const width = Math.max(slot * 0.72, 1)
  const parts = { top: '', rest: '' }
  bars.value.forEach((bar, i) => {
    const h = Math.max((bar.value / max.value) * 100, 1.5)
    parts[bar.top ? 'top' : 'rest'] += `M${(i * slot).toFixed(2)} ${(100 - h).toFixed(2)}h${width.toFixed(2)}V100H${(i * slot).toFixed(2)}Z`
  })
  return parts
})
const concentration = computed(() => props.doc.insights.tiles.find(t => t.id === 'concentration'))
const last = computed(() => valued.value[valued.value.length - 1])
const metricLabel = computed(() => props.doc.dataset.metric?.label ?? 'value')
</script>

<template>
  <section class="top sheet sheet--lift" aria-labelledby="top-heading">
    <div class="podium">
      <h2 id="top-heading" class="label">Top three by {{ metricLabel }}</h2>
      <ol class="cards">
        <li v-for="(row, i) in podium" :key="row.rank" class="card" :class="`card--${i + 1}`" :style="{ '--grow-delay': `${i * 120}ms` }" v-reveal>
          <span class="rank mono">{{ String(row.rank).padStart(2, '0') }}</span>
          <p class="name" :title="row.name">
            <a v-if="row.url" :href="row.url" rel="nofollow noopener" target="_blank">{{ row.name }}</a>
            <template v-else>{{ row.name }}</template>
          </p>
          <p class="value num">{{ row.metric === null ? 'Not disclosed' : formatAmount(row.metric, doc.dataset) }}</p>
          <p v-if="row.description" class="desc small muted">{{ row.description }}</p>
          <p v-if="place(row)" class="place chip">{{ place(row) }}</p>
          <span class="track" aria-hidden="true"><span class="fill grow" :style="{ width: `${width(row.metric)}%` }" /></span>
        </li>
      </ol>
    </div>

    <figure v-if="bars.length >= 3" class="spread" v-reveal>
      <figcaption>
        <p class="label">How {{ metricLabel }} is spread</p>
        <p class="spread-title">
          <template v-if="concentration && manyEnough">The top 10 hold {{ concentration.value }} of the total.</template>
          <template v-else>{{ valued.length }} companies with a value.</template>
        </p>
      </figcaption>
      <svg class="bars" viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" :aria-label="`${bars.length} bars showing ${metricLabel} for every company, highest first`">
        <path class="bar-rest" :d="paths.rest" />
        <path class="bar-top" :d="paths.top" />
      </svg>
      <div class="axis label">
        <span>1st, {{ formatAmount(leader, doc.dataset) }}</span>
        <span v-if="last">{{ ordinal(valued.length) }}, {{ formatAmount(last.metric ?? 0, doc.dataset) }}</span>
      </div>
      <p class="small muted">{{ per === 1 ? 'Each bar is one company' : `Each bar is the average of ${per} companies` }}, in rank order.<template v-if="manyEnough"> The darker bars are the top 10.</template></p>
    </figure>
  </section>
</template>

<style scoped>
.top { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: var(--space-xxl); padding: 36px; }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-md); margin-top: var(--space-md); }
.card { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 20px 20px 24px; border: 1px solid var(--line); border-radius: var(--radius-medium); background: var(--sheet); }
.card--1 { border-color: var(--accent); background: var(--accent-soft); }
.rank { font-size: 13px; color: var(--muted); }
.card--1 .rank { color: var(--accent); }
.name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; flex: none; font-size: 18px; font-weight: 600; line-height: 1.2; letter-spacing: -0.015em; overflow-wrap: anywhere; }
.name a { color: inherit; text-decoration: none; }
.name a:hover { text-decoration: underline; }
.value { font-size: clamp(22px, 2.2vw, 28px); font-weight: 600; letter-spacing: -0.03em; line-height: 1.05; overflow-wrap: anywhere; }
.card--1 .value { font-size: clamp(26px, 2.8vw, 36px); }
.card > :nth-last-child(2) { margin-bottom: 12px; }
.desc { flex: none; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.place { align-self: start; margin-top: 4px; }
.track { display: block; flex: none; height: 6px; margin-top: auto; border-radius: 3px; background: var(--accent-tint); overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 3px; background: var(--accent); }

.spread { display: grid; align-content: start; gap: var(--space-sm); min-width: 0; padding-left: var(--space-xxl); border-left: 1px solid var(--line); }
.spread-title { font-size: 20px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; margin-top: 4px; }
.bars { display: block; width: 100%; height: 150px; margin-top: var(--space-sm); border-bottom: 1px solid var(--line); overflow: visible; }
.bar-rest { fill: color-mix(in oklab, var(--accent) 38%, var(--sheet)); }
.bar-top { fill: var(--accent); }
html.js .is-in .bars path { animation: rise-y 900ms var(--easing) both; }
@keyframes rise-y { from { transform: scaleY(0); } to { transform: none; } }
.bars path { transform-origin: 50% 100%; }
.axis { display: flex; justify-content: space-between; gap: var(--space-md); }

@media (max-width: 1023px) {
  .top { grid-template-columns: 1fr; gap: var(--space-xl); }
  .spread { padding-left: 0; padding-top: var(--space-xl); border-left: 0; border-top: 1px solid var(--line); }
}
@media (max-width: 720px) {
  .top { padding: 20px; }
  .cards { grid-template-columns: 1fr; }
  .card { min-height: 0; }
}
@media (prefers-reduced-motion: reduce) { html.js .is-in .bars path { animation: none; } }
</style>
