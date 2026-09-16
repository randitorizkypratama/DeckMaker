<script setup lang="ts">
import type { Card } from '@dueldex/shared'

useHead({ title: 'Favorites - DuelDex' })

const auth = useAuth()
const { cards, pending, error, load } = useFavoriteCards()
const { isFavorite, toggleFavorite, clearFavorites, count } = useFavorites()
const { addPendingCard } = useDeckDraft()

const confirmOpen = ref(false)

onMounted(async () => {
  auth.loadFromStorage()
  await load()
})

watch(() => auth.isAuthenticated.value, async () => {
  await load()
})

/** Removing a favorite should drop it from this list immediately. */
async function onToggle(cardId: number): Promise<void> {
  await toggleFavorite(cardId)
  await load()
}

async function onClear(): Promise<void> {
  await clearFavorites()
  await load()
}

function addToDeck(card: Card): void {
  addPendingCard(card.id)
  navigateTo('/deck/new')
}

function openClearDialog(): void {
  confirmOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-neutral-50">Favorites</h1>
        <p class="mt-1 text-sm text-neutral-400">
          <template v-if="auth.isAuthenticated.value">
            {{ count }} {{ count === 1 ? 'card' : 'cards' }} saved to SQLite.
          </template>
          <template v-else>
            Login to save favorites to your account.
          </template>
        </p>
      </div>
      <UButton
        v-if="count > 0"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-trash-2"
        @click="openClearDialog"
      >
        Clear all
      </UButton>
    </div>

    <UAlert
      v-if="!auth.isAuthenticated.value"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Login required"
      description="Your favorites are stored in SQLite per user. Please login to view and manage them."
    >
      <template #actions>
        <UButton to="/login" color="primary" size="sm">Login</UButton>
        <UButton to="/register" color="neutral" variant="outline" size="sm">Register</UButton>
      </template>
    </UAlert>

    <template v-else>
      <CommonLoadingState v-if="pending" label="Loading your favorites..." />

      <CommonErrorState
        v-else-if="error"
        title="Unable to load favorites"
        :message="error"
        @retry="load()"
      />

      <CommonEmptyState
        v-else-if="cards.length === 0"
        title="No favorites yet"
        message="Tap the heart on any card to save it here for quick access."
        icon="i-lucide-heart"
        action-label="Explore cards"
        @action="navigateTo('/cards')"
      />

      <CardsCardGrid
        v-else
        :cards="cards"
        :is-favorite="isFavorite"
        @toggle-favorite="onToggle"
        @add="addToDeck"
      />
    </template>

    <CommonConfirmDialog
      v-model:open="confirmOpen"
      title="Clear all favorites?"
      message="This removes every saved card from your account. It cannot be undone."
      confirm-label="Clear all"
      @confirm="onClear"
    />
  </div>
</template>
