<script setup lang="ts">
import type { Card, CardScore } from '@dueldex/shared'

/**
 * Explains why the generator picked each card. Showing the reasoning is what
 * makes the recommendation trustworthy rather than opaque.
 */
const props = defineProps<{
  scores: CardScore[]
  cardsById: Map<number, Card>
  limit?: number
}>()

const expanded = ref(false)

const visible = computed(() => {
  const limit = props.limit ?? 8
  return expanded.value ? props.scores : props.scores.slice(0, limit)
})

const hasMore = computed(() => props.scores.length > (props.limit ?? 8))

function nameFor(cardId: number): string {
  return props.cardsById.get(cardId)?.name ?? `Card ${cardId}`
}

function toggleExpanded(): void {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="rounded-lg border border-ink-700 bg-ink-900">
    <div class="border-b border-ink-800 px-4 py-3">
      <h2 class="text-sm font-medium text-neutral-200">Why these cards</h2>
      <p class="mt-0.5 text-xs text-neutral-500">
        Each card is scored on how well it supports your key card.
      </p>
    </div>

    <ul class="divide-y divide-ink-800">
      <li v-for="score in visible" :key="score.cardId" class="px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <NuxtLink
            :to="`/cards/${score.cardId}`"
            class="text-sm font-medium text-neutral-200 hover:text-accent-400"
          >
            {{ nameFor(score.cardId) }}
          </NuxtLink>
          <span
            class="shrink-0 rounded bg-ink-800 px-2 py-0.5 text-xs font-medium tabular-nums text-accent-400"
          >
            {{ score.score }}
          </span>
        </div>

        <ul class="mt-1.5 space-y-0.5">
          <li
            v-for="reason in score.reasons"
            :key="reason"
            class="flex gap-1.5 text-xs text-neutral-400"
          >
            <UIcon name="i-lucide-check" class="mt-0.5 size-3 shrink-0 text-emerald-500" />
            <span>{{ reason }}</span>
          </li>
        </ul>
      </li>
    </ul>

    <div v-if="hasMore" class="border-t border-ink-800 px-4 py-2.5">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        block
        @click="toggleExpanded"
      >
        {{ expanded ? 'Show fewer' : `Show all ${scores.length} cards` }}
      </UButton>
    </div>
  </div>
</template>
