<script setup lang="ts">
import type { Card, DeckSectionName } from '@dueldex/shared'

/**
 * A single row in the deck list, with quantity controls.
 */
const props = defineProps<{
  card: Card
  quantity: number
  section: DeckSectionName
  maxCopies: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  increase: []
  decrease: []
  remove: []
}>()

const atLimit = computed(() => props.quantity >= props.maxCopies)

const banlistBadge = computed(() => {
  const ban = props.card.banlist?.tcg
  if (!ban) return null
  if (ban === 'Forbidden') return { label: 'Forbidden', symbol: '⊘', class: 'bg-red-600 text-white' }
  if (ban === 'Limited') return { label: 'Limited', symbol: '●', class: 'bg-amber-500 text-white' }
  if (ban === 'Semi-Limited') return { label: 'Semi', symbol: '●', class: 'bg-sky-500 text-white' }
  return null
})
</script>

<template>
  <li
    class="flex items-center gap-2.5 rounded-md border border-ink-800 bg-ink-900 p-2 transition-colors hover:border-ink-700"
  >
    <NuxtLink :to="`/cards/${card.id}`" class="w-9 shrink-0" :aria-label="card.name">
      <CardsCardImage :card="card" />
    </NuxtLink>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <NuxtLink
          :to="`/cards/${card.id}`"
          class="block truncate text-sm text-neutral-200 hover:text-accent-400"
        >
          {{ card.name }}
        </NuxtLink>
        <span
          v-if="banlistBadge"
          :class="['inline-flex shrink-0 items-center justify-center rounded-full w-4 h-4 text-[8px] font-bold', banlistBadge.class]"
          :title="banlistBadge.label"
        >
          {{ banlistBadge.symbol }}
        </span>
      </div>
      <p class="truncate text-xs text-neutral-500">{{ card.type }}</p>
    </div>

    <div v-if="!readonly" class="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <UButton
        icon="i-lucide-minus"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Remove one copy of ${card.name}`"
        @click="emit('decrease')"
      />
      <span class="w-5 text-center text-xs font-medium tabular-nums text-neutral-200 sm:w-6 sm:text-sm">
        {{ quantity }}
      </span>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="atLimit"
        :aria-label="`Add one copy of ${card.name}`"
        @click="emit('increase')"
      />
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Remove ${card.name} from deck`"
        @click="emit('remove')"
      />
    </div>

    <span
      v-else
      class="shrink-0 rounded bg-ink-800 px-2 py-0.5 text-sm font-medium tabular-nums text-neutral-200"
    >
      x{{ quantity }}
    </span>
  </li>
</template>
