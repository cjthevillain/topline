<script setup lang="ts">
const { theme, toggle } = useTheme()
const label = computed(() => (theme.value === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'))
</script>

<template>
  <button type="button" class="toggle" :aria-label="label" :title="label" @click="toggle">
    <svg class="icon icon--sun" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
    <svg class="icon icon--moon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  </button>
</template>

<style scoped>
.toggle {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--line-control);
  border-radius: var(--radius-full);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background var(--motion-feedback) var(--easing), border-color var(--motion-feedback) var(--easing);
}
.toggle:hover { background: var(--tint); border-color: var(--ink); }
.icon { grid-area: 1 / 1; transition: opacity var(--motion-state-change) var(--easing), transform var(--motion-state-change) var(--easing); }
.icon--sun { opacity: 0; transform: rotate(-40deg) scale(0.6); }
:root[data-theme='dark'] .icon--sun { opacity: 1; transform: none; }
:root[data-theme='dark'] .icon--moon { opacity: 0; transform: rotate(40deg) scale(0.6); }
@media (max-width: 640px) { .toggle { width: 48px; height: 48px; } }
</style>
