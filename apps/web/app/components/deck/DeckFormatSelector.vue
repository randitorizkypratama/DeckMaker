<script setup lang="ts">
import type { DeckFormat } from '@dueldex/shared'
import { DECK_FORMATS, getFormatRules } from '@dueldex/shared'

/**
 * Format picker. Rules text is read from the shared rules layer so it can
 * never drift from the rules actually enforced.
 */
const model = defineModel<DeckFormat>({ required: true })

defineProps<{
  disabled?: boolean
}>()

const options = computed(() =>
  DECK_FORMATS.map((format) => {
    const rules = getFormatRules(format)
    const parts = [`${rules.mainDeckMin}-${rules.mainDeckMax} Main`]
    if (rules.hasExtraDeck) parts.push(`${rules.extraDeckMax} Extra`)
    else parts.push('No Extra Deck')
    if (rules.hasSideDeck) parts.push(`${rules.sideDeckMax} Side`)
    return { format, label: rules.label, summary: parts.join(' - ') }
  }),
)
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <button
      v-for="option in options"
      :key="option.format"
      type="button"
      :disabled="disabled"
      class="rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        model === option.format
          ? 'border-accent-500 bg-ink-800'
          : 'border-ink-700 bg-ink-900 hover:border-ink-500'
      "
      :aria-pressed="model === option.format"
      @click="model = option.format"
    >
      <span class="block text-sm font-medium text-neutral-100">{{ option.label }}</span>
      <span class="mt-0.5 block text-xs text-neutral-400">{{ option.summary }}</span>
    </button>
  </div>
</template>
