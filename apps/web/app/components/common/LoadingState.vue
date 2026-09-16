<script setup lang="ts">
/**
 * Neutral loading placeholder used while a request is in flight.
 */
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <span
      class="size-6 animate-spin rounded-full border-2 border-ink-600 border-t-accent-500"
      aria-hidden="true"
    />
    <p class="text-sm text-neutral-400">{{ label ?? 'Loading...' }}</p>
  </div>
</template>
