<script setup lang="ts">
/**
 * Staged progress shown while a deck is generated.
 *
 * Stages reflect real request progress and never delay the result - the deck
 * renders as soon as the API responds.
 */
defineProps<{
  stages: string[]
  activeStage: number
}>()
</script>

<template>
  <div class="rounded-lg border border-ink-700 bg-ink-900 p-6">
    <div class="flex items-center gap-2.5">
      <span
        class="size-4 animate-spin rounded-full border-2 border-ink-600 border-t-accent-500"
        aria-hidden="true"
      />
      <h2 class="text-sm font-medium text-neutral-100">Building your deck...</h2>
    </div>

    <ol class="mt-4 space-y-2" aria-live="polite">
      <li
        v-for="(stage, index) in stages"
        :key="stage"
        class="flex items-center gap-2 text-sm transition-colors"
        :class="
          index < activeStage
            ? 'text-neutral-400'
            : index === activeStage
              ? 'text-neutral-100'
              : 'text-neutral-600'
        "
      >
        <UIcon
          :name="index < activeStage ? 'i-lucide-check' : 'i-lucide-circle-dashed'"
          class="size-3.5 shrink-0"
          :class="index < activeStage ? 'text-emerald-400' : ''"
        />
        <span>{{ stage }}</span>
      </li>
    </ol>
  </div>
</template>
