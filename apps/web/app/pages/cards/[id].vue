<script setup lang="ts">
import type { DeckFormat } from '@dueldex/shared'

/**
 * Card detail page. Handles favoriting, adding the card to a draft deck, and
 * launching the smart generator for this card.
 */
const route = useRoute()
const cardId = computed(() => Number(route.params.id))

const { card, pending, error, load } = useCardDetail(cardId.value)
const { isFavorite, toggleFavorite, hydrate } = useFavorites()
const { addPendingCard } = useDeckDraft()

const formatModalOpen = ref(false)
const chosenFormat = ref<DeckFormat>('yu-gi-oh')

useHead(() => ({
  title: card.value ? `${card.value.name} - DuelDex` : 'Card - DuelDex',
}))

onMounted(async () => {
  await hydrate()
  await load()
})

// Support in-app navigation between two card detail pages.
watch(cardId, async () => {
  await load()
})

/** Adds the card to the draft deck, then opens the builder. */
function addToDeck(): void {
  if (!card.value) return
  addPendingCard(card.value.id)
  navigateTo('/deck/new')
}

function buildDeck(): void {
  formatModalOpen.value = true
}

function confirmGenerate(): void {
  formatModalOpen.value = false
  navigateTo({
    path: '/deck/new',
    query: { keyCard: String(cardId.value), format: chosenFormat.value, generate: '1' },
  })
}

const router = useRouter()

function closeFormatModal(): void {
  formatModalOpen.value = false
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-left"
      class="mb-6"
      @click="router.back()"
    >
      Back
    </UButton>

    <CommonLoadingState v-if="pending" label="Loading card..." />

    <CommonErrorState
      v-else-if="error || !card"
      title="Unable to load this card"
      :message="error ?? 'This card could not be found.'"
      @retry="load()"
    />

    <CardsCardDetail
      v-else
      :card="card"
      :favorite="isFavorite(card.id)"
      @toggle-favorite="toggleFavorite(card.id)"
      @add-to-deck="addToDeck"
      @build-deck="buildDeck"
    />

    <UModal v-model:open="formatModalOpen" title="Choose a format">
      <template #body>
        <p class="mb-4 text-sm text-neutral-400">
          Pick the format to build this deck for. The generator applies each
          format's own construction rules.
        </p>
        <DeckFormatSelector v-model="chosenFormat" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" size="sm" @click="closeFormatModal">
            Cancel
          </UButton>
          <UButton color="primary" size="sm" icon="i-lucide-sparkles" @click="confirmGenerate">
            Generate Deck
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
