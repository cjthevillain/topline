<script setup lang="ts">
import type { ColumnProfile, PipelineError, PipelineWarning, Role, RoleMap } from '#shared/types/blog'
import { ROLE_LABELS } from '#shared/types/blog'
import type { Analysis } from '#shared/pipeline/analyse'
import { BRAND } from '#shared/brand'
import { formatAmount } from '#shared/ui/format'

const title = 'Generate a blog page from a CSV'
useSeoMeta({ title: `${title} | ${BRAND.name}`, description: 'Upload a company CSV and generate a new SEO blog page, with no code changes.', robots: 'noindex, follow' })

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
const stages = ['Upload', 'Check', 'Publish']

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
    const result = await $fetch<{ url: string }>('/api/blogs', { method: 'POST', body: form })
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

const progress = computed(() => [
  { label: 'Rows read and cleaned', state: 'done' },
  { label: 'Statistics calculated', state: 'done' },
  { label: 'Copy written by the LLM and checked against the data', state: 'active' },
  { label: 'Page published', state: 'pending' },
])
</script>

<template>
  <div>
    <section class="band hero-band">
      <div class="wrap hero hero--gen hero--over">
        <div>
          <p class="label">New page</p>
          <h1>{{ title }}</h1>
          <p class="lede">Any company list works. Columns can have different names and values can be missing. You see what was found before anything is published.</p>
        </div>
        <ol class="stages" aria-label="Progress">
          <li v-for="(name, i) in stages" :key="name" :class="{ 'is-current': stage === i + 1, 'is-done': stage > i + 1 }" :aria-current="stage === i + 1 ? 'step' : undefined">
            <span class="stage-no mono">{{ stage > i + 1 ? '' : i + 1 }}</span>
            <span>{{ name }}</span>
          </li>
        </ol>
      </div>
    </section>

    <div class="wrap layout">
      <form class="stack" @submit.prevent="generate">
        <div
          class="drop sheet sheet--lift over"
          :class="{ 'drop--active': dragging, 'drop--loaded': file }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <svg class="glyph" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 8h26l10 10v38H14z" />
            <path d="M40 8v10h10" />
            <path d="M22 30h20M22 38h20M22 46h12" />
          </svg>
          <p class="label">CSV up to 2 MB and 1,000 rows</p>
          <p class="drop-title">{{ file ? file.name : 'Drop a CSV file here' }}</p>
          <p v-if="file" class="chip">{{ sizeLabel }}<template v-if="analysis">, {{ analysis.dataset.stats.rowsInFile }} rows</template></p>
          <p v-else class="small muted">Comma, semicolon, tab or pipe separated.</p>
          <input ref="input" class="file" type="file" accept=".csv,.tsv,.txt,text/csv" aria-label="Choose a CSV file" @change="onChange">
          <button type="button" class="pill" :class="{ 'pill--line': file }" @click="input?.click()">{{ file ? 'Choose another file' : 'Choose a file' }}</button>
        </div>

        <p class="small muted try">
          No file to hand? Try
          <button type="button" class="link" @click="loadSample('example-healthtech.csv')">an example healthtech file</button>
          or
          <button type="button" class="link" @click="loadSample('example-cleantech-messy.csv')">a messy cleantech file</button>.
          Both are made up.
        </p>

        <div v-if="error" ref="alert" class="problem" role="alert" tabindex="-1">
          <svg class="problem-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
          <div><strong>{{ error.message }}</strong><br>{{ error.hint }}</div>
        </div>

        <section v-if="analysis" class="panel sheet" aria-labelledby="preview-heading">
          <h2 id="preview-heading" class="label">What we found</h2>
          <div class="found">
            <p class="found-rows">{{ analysis.dataset.stats.rowsUsed }} usable rows from {{ analysis.dataset.stats.rowsInFile }}.</p>
            <p v-if="leader && analysis.dataset.metric" class="found-lead">{{ leader.name }} ranks first with {{ formatAmount(leader.metric ?? 0, analysis.dataset) }}.</p>
            <p v-else-if="leader" class="found-lead">No ranking value was found, so the page keeps the file order.</p>
          </div>
          <ul v-if="warnings.length" class="warnings">
            <li v-for="warning in warnings" :key="warning.code" class="warning small">
              <span class="tick" aria-hidden="true" />
              <span>{{ warning.message }}<template v-if="warning.lines?.length"> Lines: {{ warning.lines.join(', ') }}.</template></span>
            </li>
          </ul>
          <p v-else class="small muted">No rows needed fixing.</p>
        </section>

        <section v-if="profiles.length" class="panel sheet" aria-labelledby="mapping-heading">
          <div>
            <h2 id="mapping-heading" class="label">Column mapping</h2>
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

        <section v-if="analysis" class="panel sheet" aria-labelledby="publish-heading">
          <h2 id="publish-heading" class="label">Publish</h2>
          <div class="field">
            <label class="small" for="topic">Topic for the page</label>
            <input id="topic" v-model="topic" class="control" type="text" maxlength="40" :placeholder="analysis.context.topic === 'company' ? 'For example healthtech' : analysis.context.topic" @change="analyse">
            <p class="small muted">Used in the title and copy. Leave blank to use "{{ analysis.context.topic }}".</p>
          </div>
          <div class="go">
            <button type="submit" class="pill submit" :disabled="busy">{{ busy ? 'Writing your page' : 'Generate page' }}</button>
            <p v-if="!busy" class="small muted">The page is live as soon as it is written, usually within a few seconds.</p>
          </div>
          <ol v-if="busy" class="progress" role="status" aria-live="polite">
            <li v-for="step in progress" :key="step.label" :class="`is-${step.state}`">
              <span class="mark" aria-hidden="true" />
              <span>{{ step.label }}</span>
            </li>
          </ol>
        </section>
      </form>
    </div>
  </div>
</template>

<style scoped>
.hero--gen { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-xl); align-items: end; }
.hero--gen h1 { max-width: 16ch; }
.stages { display: flex; gap: var(--space-xs); }
.stages li { display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 14px 0 6px; border: 1px solid var(--band-line); border-radius: var(--radius-full); color: var(--band-muted); font-size: 14px; font-weight: 500; transition: color var(--motion-state-change) var(--easing), border-color var(--motion-state-change) var(--easing); }
.stage-no { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--band-line); color: var(--band-ink); font-size: 12px; }
.stages li.is-current { color: var(--band-ink); border-color: var(--band-accent); }
.stages li.is-current .stage-no { background: var(--band-accent); color: var(--band); }
.stages li.is-done { color: var(--band-ink); }
.stages li.is-done .stage-no { background: var(--band-accent); color: var(--band); }
.stages li.is-done .stage-no::before { content: ''; width: 10px; height: 6px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-1px) rotate(-45deg); }

.layout { max-width: 920px; }
.stack { display: grid; gap: var(--space-md); }
.drop { position: relative; display: grid; justify-items: center; gap: var(--space-xs); padding: 48px var(--space-lg); text-align: center; transition: border-color var(--motion-state-change) var(--easing), background var(--motion-state-change) var(--easing), transform var(--motion-state-change) var(--easing); }
.drop::after { content: ''; position: absolute; inset: 12px; border: 1.5px dashed var(--line); border-radius: calc(var(--radius-large) - 10px); pointer-events: none; transition: border-color var(--motion-state-change) var(--easing); }
.drop--active { border-color: var(--accent); background: var(--accent-soft); transform: scale(1.01); }
.drop--active::after { border-color: var(--accent); }
.drop--loaded::after { border-style: solid; border-color: var(--line-soft); }
.glyph { width: 44px; height: 44px; margin-bottom: 6px; color: var(--accent); }
.drop-title { font-size: clamp(24px, 3.6vw, 34px); font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; overflow-wrap: anywhere; max-width: 100%; }
.drop .pill { margin-top: var(--space-sm); }
.file { position: absolute; width: 1px; height: 1px; opacity: 0; }
.try { text-align: center; }
.link { padding: 0; border: 0; background: none; color: var(--accent); font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; min-height: 32px; }
.problem { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: var(--space-sm); padding: var(--space-md) 20px; border: 1px solid var(--warn); border-radius: var(--radius-medium); background: var(--note); color: var(--ink); }
.problem-icon { width: 22px; height: 22px; color: var(--warn); }
.panel { display: grid; gap: var(--space-lg); padding: var(--space-xl); }
.found { display: grid; gap: var(--space-xs); }
.found-rows { font-size: clamp(28px, 3.4vw, 40px); font-weight: 600; line-height: 1.05; letter-spacing: -0.03em; }
.found-lead { font-size: 19px; line-height: 1.35; color: var(--muted); }
.warnings { display: grid; gap: 10px; padding-top: var(--space-md); border-top: 1px solid var(--line-soft); }
.warning { display: flex; gap: var(--space-sm); }
.tick { flex: none; width: 4px; min-height: 18px; margin-top: 2px; border-radius: var(--radius-full); background: var(--day); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: var(--space-md); }
.field { display: grid; gap: 6px; }
.field label { font-weight: 500; }
.go { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-md); }
.progress { display: grid; gap: 10px; padding-top: var(--space-md); border-top: 1px solid var(--line-soft); font-size: 15px; }
.progress li { display: flex; align-items: center; gap: 12px; color: var(--muted); }
.progress .mark { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line-control); }
.progress .is-done { color: var(--ink); }
.progress .is-done .mark { border-color: var(--accent); background: var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4.5 8.5 2.3 2.2L11.5 5.5'/%3E%3C/svg%3E") center / 12px no-repeat; }
.progress .is-active { color: var(--ink); font-weight: 500; }
.progress .is-active .mark { border-color: var(--accent); border-top-color: transparent; animation: spin 900ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.submit { min-width: 180px; }
@media (min-width: 900px) { .hero--gen { grid-template-columns: minmax(0, 1fr) auto; } }
@media (max-width: 640px) {
  .panel { padding: var(--space-lg); }
  .drop { padding: 36px var(--space-md); }
  .submit { white-space: normal; min-height: 56px; width: 100%; }
  .stages { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { .progress .is-active .mark { animation: none; border-top-color: var(--accent); border-style: dashed; } }
</style>
