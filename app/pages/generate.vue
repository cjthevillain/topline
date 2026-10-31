<script setup lang="ts">
import type { ColumnProfile, PipelineError, PipelineWarning, Role, RoleMap } from '#shared/types/blog'
import { ROLE_LABELS } from '#shared/types/blog'
import type { Analysis } from '#shared/pipeline/analyse'
import { BRAND } from '#shared/brand'
import { formatAmount, formatCount } from '#shared/ui/format'

const title = 'Generate a ranking page from a CSV'
useSiteMeta({ title: `${title} | ${BRAND.name}`, description: 'Upload a list of companies and publish a ranked page in seconds. You check what was found before anything goes live.', path: '/generate' })

const MAPPED_ROLES: Role[] = ['name', 'metric', 'region', 'category', 'stage', 'size', 'website', 'description']

const file = ref<File | null>(null)
const bytes = ref<Uint8Array | null>(null)
const topic = ref('')
const overrides = ref<RoleMap>({})
const analysis = shallowRef<Analysis | null>(null)
const profiles = shallowRef<ColumnProfile[]>([])
const error = ref<PipelineError | null>(null)
const busy = ref(false)
const dragging = ref(false)
const input = ref<HTMLInputElement>()
const alert = ref<HTMLElement>()

const warnings = computed<PipelineWarning[]>(() => analysis.value?.dataset.warnings ?? [])
const roleOptions = computed(() => MAPPED_ROLES.map(role => ({ role, label: ROLE_LABELS[role], index: analysis.value?.roles[role] ?? overrides.value[role] ?? -1 })))
const leader = computed(() => analysis.value?.dataset.rows[0] ?? null)
const stage = computed(() => (busy.value ? 3 : analysis.value ? 2 : 1))
const sizeLabel = computed(() => (file.value ? `${Math.max(1, Math.round(file.value.size / 1024))} KB` : ''))
const stages = [
  { name: 'Upload', note: 'Any company CSV' },
  { name: 'Check', note: 'See what was found' },
  { name: 'Publish', note: 'Live in a few seconds' },
]

async function analyse() {
  if (!bytes.value || !file.value) return
  const { analyseCsv } = await import('#shared/pipeline/analyse')
  const { PipelineFailure } = await import('#shared/pipeline/errors')
  const { decodeBytes } = await import('#shared/pipeline/decode')
  const { parseTable } = await import('#shared/pipeline/csv')
  const { profileColumns } = await import('#shared/pipeline/schema')
  error.value = null
  try {
    // Kept apart from analyseCsv so the mapping stays usable when the data fails.
    try {
      profiles.value = profileColumns(parseTable(decodeBytes(bytes.value)))
    }
    catch {
      profiles.value = []
    }
    analysis.value = analyseCsv(bytes.value, { fileName: file.value.name, topic: topic.value, overrides: overrides.value })
  }
  catch (failure) {
    analysis.value = null
    error.value = failure instanceof PipelineFailure
      ? { code: failure.code, message: failure.message, hint: failure.hint }
      : { code: 'unexpected', message: 'This file could not be read.', hint: 'Check that it is a valid CSV file, then try again.' }
    await nextTick()
    alert.value?.focus()
  }
}

async function choose(chosen: File | null | undefined) {
  if (!chosen) return
  file.value = chosen
  overrides.value = {}
  analysis.value = null
  bytes.value = new Uint8Array(await chosen.arrayBuffer())
  await analyse()
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void choose(event.dataTransfer?.files[0])
}

function onChange(event: Event) {
  void choose((event.target as HTMLInputElement).files?.[0])
}

function remap(role: Role, value: string) {
  overrides.value = { ...overrides.value, [role]: Number(value) }
  void analyse()
}

async function loadSample(name: string) {
  const response = await fetch(`/samples/${name}`)
  await choose(new File([await response.blob()], name, { type: 'text/csv' }))
}

async function generate() {
  if (!file.value) return
  busy.value = true
  error.value = null
  const form = new FormData()
  form.append('file', file.value)
  form.append('topic', topic.value)
  form.append('overrides', JSON.stringify(overrides.value))
  try {
    const result = await $fetch<{ slug: string; url: string; removalToken: string }>('/api/blogs', { method: 'POST', body: form })
    saveRemovalToken(result.slug, result.removalToken)
    await navigateTo(result.url)
  }
  catch (failure) {
    const data = (failure as { data?: { data?: PipelineError } }).data?.data
    error.value = data ?? { code: 'network', message: 'The server could not be reached.', hint: 'Check your connection and try again.' }
    await nextTick()
    alert.value?.focus()
  }
  finally {
    busy.value = false
  }
}

const progress = [
  { label: 'Rows read and cleaned', state: 'Done' },
  { label: 'Statistics calculated', state: 'Done' },
  { label: 'Copy written by the LLM and checked against the data', state: 'Working' },
  { label: 'Page published', state: 'Next' },
]
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <h1>{{ title }}</h1>
      <p class="lede muted">Any company list works. Columns can have different names and values can be missing. You see what was found before anything is published.</p>
    </header>

    <ol class="stages" aria-label="Progress">
      <li v-for="(item, i) in stages" :key="item.name" :class="{ 'is-current': stage === i + 1, 'is-done': stage > i + 1 }" :aria-current="stage === i + 1 ? 'step' : undefined">
        <b>{{ i + 1 }}. {{ item.name }}</b>
        <span class="small hide-m">{{ item.note }}</span>
      </li>
    </ol>

    <form class="stack" @submit.prevent="generate">
      <div
        class="drop"
        :class="{ 'is-over': dragging, 'is-loaded': file }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div>
          <h2 class="drop-title">{{ file ? file.name : 'Drop a CSV file here' }}</h2>
          <p v-if="file" class="small muted">{{ sizeLabel }}<template v-if="analysis">, {{ formatCount(analysis.dataset.stats.rowsInFile) }} rows</template></p>
          <p v-else class="small muted">Comma, semicolon, tab or pipe separated. Up to 2 MB and 1,000 rows.</p>
        </div>
        <input ref="input" class="file" type="file" accept=".csv,.tsv,.txt,text/csv" aria-label="Choose a CSV file" @change="onChange">
        <button type="button" class="btn" :class="{ 'btn-2': file }" @click="input?.click()">{{ file ? 'Choose another file' : 'Choose a file' }}</button>
      </div>

      <p class="small muted">
        No file to hand? Try
        <button type="button" class="link sample" @click="loadSample('example-healthtech.csv')">an example healthtech file</button>
        or
        <button type="button" class="link sample" @click="loadSample('example-cleantech-messy.csv')">a messy cleantech file</button>.
        Both are made up.
      </p>

      <div v-if="error" ref="alert" class="problem" role="alert" tabindex="-1">
        <strong>{{ error.message }}</strong>
        <p>{{ error.hint }}</p>
      </div>

      <section v-if="analysis" class="panel" aria-labelledby="preview-heading">
        <h2 id="preview-heading">What we found</h2>
        <div class="found">
          <p class="found-rows">{{ formatCount(analysis.dataset.stats.rowsUsed) }} usable rows from {{ formatCount(analysis.dataset.stats.rowsInFile) }}.</p>
          <p v-if="leader && analysis.dataset.metric" class="muted">{{ leader.name }} ranks first with {{ formatAmount(leader.metric ?? 0, analysis.dataset) }}.</p>
          <p v-else-if="leader" class="muted">No ranking value was found, so the page keeps the file order.</p>
        </div>
        <ul v-if="warnings.length" class="notes">
          <li v-for="warning in warnings" :key="warning.code" class="small">{{ warning.message }}<template v-if="warning.lines?.length"> Lines: {{ warning.lines.join(', ') }}.</template></li>
        </ul>
        <p v-else class="small muted">No rows needed fixing.</p>
      </section>

      <section v-if="profiles.length" class="panel" aria-labelledby="mapping-heading">
        <div>
          <h2 id="mapping-heading">Column mapping</h2>
          <p class="small muted">Detected automatically from the headers and values. Change anything that looks wrong.</p>
        </div>
        <div class="grid">
          <div v-for="option in roleOptions" :key="option.role" class="field">
            <label class="small" :for="`role-${option.role}`">{{ option.label }}</label>
            <select :id="`role-${option.role}`" class="control" :value="option.index" @change="remap(option.role, ($event.target as HTMLSelectElement).value)">
              <option :value="-1">Not in this file</option>
              <option v-for="column in profiles" :key="column.index" :value="column.index">{{ column.header }}</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="analysis" class="panel" aria-labelledby="publish-heading">
        <h2 id="publish-heading">Publish</h2>
        <div class="field">
          <label class="small" for="topic">Topic for the page</label>
          <input id="topic" v-model="topic" class="control" type="text" maxlength="40" :placeholder="analysis.context.topic === 'company' ? 'For example healthtech' : analysis.context.topic" @change="analyse">
          <p class="small muted">Used in the title and copy. Leave blank to use "{{ analysis.context.topic }}".</p>
        </div>
        <div class="go">
          <button type="submit" class="btn" :disabled="busy" :aria-busy="busy">{{ busy ? 'Publishing' : 'Publish this page' }}</button>
          <p v-if="!busy" class="small muted">The page is public as soon as it is written, usually within a few seconds. Only upload company data you are allowed to publish, and no personal data. See the <NuxtLink to="/terms" class="link">terms</NuxtLink>.</p>
        </div>
        <ol v-if="busy" class="progress" role="status" aria-live="polite">
          <li v-for="step in progress" :key="step.label" :class="{ 'is-next': step.state === 'Next' }">
            <span>{{ step.label }}</span>
            <span class="muted">{{ step.state }}</span>
          </li>
        </ol>
      </section>
    </form>
  </div>
</template>

<style scoped>
.stages { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-md); max-width: 860px; margin-top: var(--space-lg); }
.stages li { display: grid; padding-top: 10px; border-top: 3px solid var(--line); color: var(--ink-2); font-size: 15px; transition: border-color var(--motion-feedback) ease; }
.stages b { font-weight: 500; }
.stages .is-current, .stages .is-done { border-color: var(--ink); color: var(--ink); }
.stages .is-current b { font-weight: 600; }
.stack { display: grid; gap: var(--space-lg); max-width: 860px; padding-block: var(--space-lg) var(--space-xxxl); }
/* The drop area works like a button: its rule thickens when a file is over it. */
.drop { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-md) var(--space-xl); padding: 28px var(--space-lg); border: 1px solid var(--ink); border-radius: var(--radius-button); background: var(--surface); box-shadow: inset 0 3px 0 var(--ink); transition: box-shadow var(--motion-feedback) ease; }
.drop.is-over { box-shadow: inset 0 8px 0 var(--accent); }
.drop-title { font-size: 26px; overflow-wrap: anywhere; }
.file { position: absolute; width: 1px; height: 1px; opacity: 0; }
.sample { padding: 0; border: 0; background: none; font-size: inherit; cursor: pointer; }
.problem { display: grid; gap: var(--space-xxs); padding: var(--space-md) 20px; border: 1px solid var(--warn); border-radius: var(--radius-button); background: var(--surface); box-shadow: inset 0 3px 0 var(--warn); }
.panel { display: grid; gap: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--ink); }
.panel h2 { font-size: 20px; }
.found { display: grid; gap: var(--space-xxs); }
.found-rows { font-size: 34px; font-weight: 500; line-height: 1.1; letter-spacing: -0.025em; }
.notes { border-top: 1px solid var(--line); }
.notes li { padding-block: var(--space-xs); border-bottom: 1px solid var(--line); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: var(--space-md); }
.field { display: grid; gap: var(--space-xxs); }
.field label { font-weight: 500; }
.go { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-md) var(--space-lg); }
.go p { flex: 1 1 320px; max-width: 58ch; }
.progress { border-top: 1px solid var(--line); font-size: 15px; }
.progress li { display: flex; justify-content: space-between; gap: var(--space-lg); padding-block: var(--space-xs); border-bottom: 1px solid var(--line); }
.progress .is-next { color: var(--ink-2); }
@media (max-width: 760px) {
  .drop { padding: var(--space-lg) var(--space-md); }
  .drop-title { font-size: 22px; }
  .go .btn { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .stages li, .drop { transition: none; } }
</style>
