<script setup lang="ts">
import type { DeckSectionName } from '@dueldex/shared'
import type { DeckEntry } from '~/composables/useDeck'

/**
 * One deck section (Main, Extra or Side) with its card list.
 */
defineProps<{
  title: string
  section: DeckSectionName
  entries: DeckEntry[]
  count: number
  limit: number
  maxCopies: number
  readonly?: boolean
  breakdown?: { monster: number; spell: number; trap: number }
}>()

const emit = defineEmits<{
  increase: [cardId: number, section: DeckSectionName]
  decrease: [cardId: number, section: DeckSectionName]
  remove: [cardId: number, section: DeckSectionName]
}>()
</script>

<template>
  <section>
    <div class="mb-2 flex items-baseline justify-between">
      <h3 class="text-sm font-medium text-neutral-200">{{ title }}</h3>
      <span class="text-xs tabular-nums text-neutral-500">
        {{ count }}{{ limit > 0 ? ` / ${limit}` : '' }} cards
      </span>
    </div>

    <!-- M/S/T breakdown for main deck -->
    <div v-if="breakdown && section === 'main'" class="mb-3 flex gap-3 text-[11px]">
      <span class="text-amber-400">{{ breakdown.monster }} Monster</span>
      <span class="text-blue-400">{{ breakdown.spell }} Spell</span>
      <span class="text-rose-400">{{ breakdown.trap }} Trap</span>
    </div>

    <p
      v-if="entries.length === 0"
      class="rounded-md border border-dashed border-ink-700 px-3 py-4 text-center text-xs text-neutral-500"
    >
      No cards yet.
    </p>

    <ul v-else class="space-y-1.5">
      <DeckCard
        v-for="entry in entries"
        :key="`${entry.cardId}-${entry.section}`"
        :card="entry.card"
        :quantity="entry.quantity"
        :section="entry.section"
        :max-copies="maxCopies"
        :readonly="readonly"
        @increase="emit('increase', entry.cardId, entry.section)"
        @decrease="emit('decrease', entry.cardId, entry.section)"
        @remove="emit('remove', entry.cardId, entry.section)"
      />
    </ul>
  </section>
</template>
