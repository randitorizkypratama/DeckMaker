<script setup lang="ts">
import type { Card } from '@dueldex/shared'

const props = withDefaults(
  defineProps<{
    cards: Card[]
    pending?: boolean
    skeletonCount?: number
    isFavorite?: (cardId: number) => boolean
  }>(),
  { pending: false, skeletonCount: 12 },
)

const emit = defineEmits<{
  toggleFavorite: [cardId: number]
  add: [card: Card]
}>()

function favorite(cardId: number): boolean {
  return props.isFavorite ? props.isFavorite(cardId) : false
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    <template v-if="pending">
      <CardsCardSkeleton v-for="index in skeletonCount" :key="`skeleton-${index}`" />
    </template>
    <template v-else>
      <CardsCardItem
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :favorite="favorite(card.id)"
        @toggle-favorite="emit('toggleFavorite', $event)"
        @add="emit('add', $event)"
      />
    </template>
  </div>
</template>
