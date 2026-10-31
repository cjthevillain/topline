<script setup lang="ts">
const { theme, toggle } = useTheme()
</script>

<template>
  <button type="button" class="toggle" @click="toggle">{{ theme === 'dark' ? 'Light theme' : 'Dark theme' }}</button>
</template>

<style scoped>
.toggle { border: 0; background: none; font-size: inherit; cursor: pointer; }
.toggle:hover { color: var(--accent); }
</style>
