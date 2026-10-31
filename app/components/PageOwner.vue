<script setup lang="ts">
/** Shown only in the browser that published the page, because only that browser holds the token. */
const props = defineProps<{ slug: string }>()

const token = ref<string | null>(null)
const confirming = ref(false)
const busy = ref(false)
const failed = ref(false)

onMounted(() => {
  token.value = loadRemovalToken(props.slug)
})

async function remove() {
  busy.value = true
  failed.value = false
  try {
    await $fetch(`/api/blogs/${props.slug}`, { method: 'DELETE', body: { token: token.value } })
    forgetRemovalToken(props.slug)
    await navigateTo('/blog')
  }
  catch {
    failed.value = true
    busy.value = false
  }
}
</script>

<template>
  <aside v-if="token" class="owner" aria-label="Your page">
    <p class="small">You published this page from this browser.</p>
    <div class="acts">
      <template v-if="confirming">
        <button type="button" class="pill pill--small" :disabled="busy" @click="remove">{{ busy ? 'Removing' : 'Remove for good' }}</button>
        <button type="button" class="pill pill--line pill--small" :disabled="busy" @click="confirming = false">Keep it</button>
      </template>
      <button v-else type="button" class="pill pill--line pill--small" @click="confirming = true">Remove this page</button>
    </div>
    <p v-if="failed" class="small" role="alert">The page could not be removed. Please try again.</p>
  </aside>
</template>

<style scoped>
.owner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-sm) var(--space-lg); margin-top: var(--space-xl); padding: var(--space-md) var(--space-lg); border: 1px solid var(--line); background: var(--sheet); }
.acts { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
</style>
