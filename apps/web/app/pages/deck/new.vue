<script setup lang="ts">
import type { Card, DeckDetail, DeckFormat } from '@dueldex/shared'
import { isDeckFormat } from '@dueldex/shared'

useHead({ title: 'Deck Builder - DuelDex' })

const route = useRoute()
const api = useApi()

const deck = useDeck()
const generator = useDeckGenerator()
const { consumePendingCards } = useDeckDraft()
const { isFavorite, toggleFavorite, hydrate } = useFavorites()

const explorer = useCards({ pageSize: 18 })
const { metadata, load: loadMetadata } = useCardFilterMetadata()

const deckView = reactive(deck)
const generatorView = reactive(generator)
const explorerView = reactive(explorer)

const keyCard = ref<Card | null>(null)
const clearOpen = ref(false)
const shareUrl = ref<string | null>(null)
const saveMessage = ref<string | null>(null)
const mobilePanel = ref<'search' | 'deck'>('search')
const auth = useAuth()
const deckCount = ref(0)

async function refreshDeckCount() {
  if (!auth.isAuthenticated.value) { deckCount.value = 0; return }
  try {
    const res: any = await api.request<any>('/api/decks')
    if (Array.isArray(res)) deckCount.value = res.length
    else if (res?.pagination) deckCount.value = res.pagination.total
    else if (Array.isArray(res?.items)) deckCount.value = res.pagination?.total ?? res.items.length
    else deckCount.value = 0
  } catch { deckCount.value = 0 }
}

const recommendationCards = computed(() => {
  const map = new Map<number, Card>()
  for (const entry of deck.entries.value) map.set(entry.cardId, entry.card)
  if (keyCard.value) map.set(keyCard.value.id, keyCard.value)
  return map
})

const deckAnalysis = computed(() => {
  const levelCurve: Record<string, number> = {}
  const atkHistogram: Record<string, number> = {}
  const archetypeBreakdown: Record<string, number> = {}
  let totalLevel = 0
  let levelCards = 0
  let totalAtk = 0
  let atkCards = 0
  for (const e of deck.entries.value) {
    const card = e.card
    if (typeof card.level === 'number') {
      const k = String(card.level)
      levelCurve[k] = (levelCurve[k] ?? 0) + e.quantity
      totalLevel += card.level * e.quantity
      levelCards += e.quantity
    } else {
      levelCurve['-'] = (levelCurve['-'] ?? 0) + e.quantity
    }
    if (typeof card.atk === 'number') {
      const bucket = card.atk < 1000 ? '0-1000' : card.atk < 2000 ? '1000-2000' : card.atk < 3000 ? '2000-3000' : '3000+'
      atkHistogram[bucket] = (atkHistogram[bucket] ?? 0) + e.quantity
      totalAtk += card.atk * e.quantity
      atkCards += e.quantity
    }
    const arch = card.archetype ?? 'No Archetype'
    archetypeBreakdown[arch] = (archetypeBreakdown[arch] ?? 0) + e.quantity
  }
  return {
    mainCount: deck.counts.value.main,
    extraCount: deck.counts.value.extra,
    sideCount: deck.counts.value.side,
    monsterCount: deck.breakdown.value.monster,
    spellCount: deck.breakdown.value.spell,
    trapCount: deck.breakdown.value.trap,
    levelCurve,
    atkHistogram,
    archetypeBreakdown,
    avgLevel: levelCards > 0 ? Number((totalLevel / levelCards).toFixed(1)) : undefined,
    avgAtk: atkCards > 0 ? Math.round(totalAtk / atkCards) : undefined,
  }
})

async function loadKeyCard(id: number): Promise<void> {
  try { keyCard.value = await api.request<Card>(`/api/cards/${id}`) } catch { keyCard.value = null }
}

async function runGenerator(format: DeckFormat, keyCardId: number): Promise<void> {
  const recommendation = await generator.generate(format, keyCardId)
  if (!recommendation) return
  deck.loadFromDeck(recommendation.deck, true)
  keyCard.value = recommendation.deck.keyCard ?? keyCard.value
  saveMessage.value = null
  shareUrl.value = null
}

async function regenerate(): Promise<void> {
  if (!deck.keyCardId.value) return
  await runGenerator(deck.format.value, deck.keyCardId.value)
}

async function onSave(): Promise<void> {
  const saved = await deck.save()
  if (saved) {
    saveMessage.value = 'Deck saved successfully!'
    shareUrl.value = null
    await refreshDeckCount()
  }
}

async function onShare(): Promise<void> {
  if (!deck.savedDeckId.value) return
  try {
    const result = await api.request<{ shareId: string; url: string }>(`/api/decks/${deck.savedDeckId.value}/share`, { method: 'POST' })
    const url = import.meta.client ? `${window.location.origin}/deck/${result.shareId}` : result.url
    shareUrl.value = url
    if (import.meta.client && navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => undefined)
  } catch { saveMessage.value = 'Unable to create share link.' }
}

function onClear(): void { deck.clear(); keyCard.value = null; shareUrl.value = null; saveMessage.value = null }
function openClearDialog(): void { clearOpen.value = true }

const editLoading = ref(false)
const editError = ref<string | null>(null)

onMounted(async () => {
  auth.loadFromStorage()
  await hydrate()
  await Promise.all([loadMetadata(), explorer.fetchCards(), refreshDeckCount()])

  const query = route.query
  const editId = typeof query.editId === 'string' ? query.editId : undefined
  if (editId) {
    editLoading.value = true; editError.value = null
    try {
      const detail = await api.request<DeckDetail>(`/api/decks/${editId}`)
      deck.loadFromDeck(detail); keyCard.value = detail.keyCard ?? null
      if (detail.keyCardId) await loadKeyCard(detail.keyCardId)
      saveMessage.value = null; shareUrl.value = null
    } catch (e: any) { editError.value = e?.message ?? 'Unable to load deck for editing.' }
    finally { editLoading.value = false }
    const queued = consumePendingCards()
    if (queued.length > 0) {
      const cards = await Promise.all(queued.map((id) => api.request<Card>(`/api/cards/${id}`).catch(() => null)))
      for (const card of cards) if (card) deck.addCard(card, 1)
    }
    return
  }

  const formatParam = typeof query.format === 'string' ? query.format : undefined
  if (formatParam && isDeckFormat(formatParam)) deck.setFormat(formatParam)
  const keyCardParam = typeof query.keyCard === 'string' ? Number(query.keyCard) : undefined

  if (keyCardParam && query.generate === '1') {
    deck.keyCardId.value = keyCardParam; await loadKeyCard(keyCardParam); await runGenerator(deck.format.value, keyCardParam); return
  }
  if (keyCardParam) { deck.keyCardId.value = keyCardParam; await loadKeyCard(keyCardParam) }

  const queued = consumePendingCards()
  if (queued.length > 0) {
    const cards = await Promise.all(queued.map((id) => api.request<Card>(`/api/cards/${id}`).catch(() => null)))
    for (const card of cards) if (card) deck.addCard(card, 1)
  }
})

const mainProgress = computed(() => {
  const ratio = deckView.rules.mainDeckMin > 0 ? deckView.counts.main / deckView.rules.mainDeckMin : 0
  return Math.min(100, Math.round(ratio * 100))
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Header -->
    <div class="border-b border-ink-800 bg-gradient-to-r from-ink-950 via-ink-900 to-primary-950/20">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <!-- Left: Title + Key card -->
          <div class="flex items-center gap-4">
            <div v-if="keyCard" class="hidden size-16 shrink-0 overflow-hidden rounded-xl border border-ink-700 bg-ink-800 shadow-lg sm:block">
              <img v-if="keyCard.cardImages[0]" :src="keyCard.cardImages[0].imageUrlSmall" :alt="keyCard.name" class="h-full w-full object-cover" />
            </div>

            <div>
              <input
                v-model="deckView.name"
                class="bg-transparent text-2xl font-bold text-neutral-50 border-b border-transparent hover:border-ink-600 focus:border-primary-500 focus:outline-none transition-colors sm:text-3xl"
                maxlength="80"
                placeholder="Deck name..."
              />
              <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                <span class="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-0.5 text-xs">
                  {{ deckView.rules.label }}
                </span>
                <template v-if="keyCard">
                  <span class="text-neutral-600">|</span>
                  <NuxtLink :to="`/cards/${keyCard.id}`" class="text-primary-400 hover:text-primary-300 transition-colors">
                    {{ keyCard.name }}
                  </NuxtLink>
                </template>
              </div>
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="flex flex-wrap items-center gap-2">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="openClearDialog">Clear</UButton>
            <UButton v-if="deckView.savedDeckId" color="neutral" variant="outline" size="sm" icon="i-lucide-share-2" @click="onShare">Share</UButton>
            <UButton color="primary" size="sm" icon="i-lucide-save" :loading="deckView.saving" :disabled="deckView.entries.length === 0" @click="onSave">
              {{ deckView.savedDeckId ? 'Update Deck' : 'Save Deck' }}
            </UButton>
          </div>
        </div>

        <!-- Quick stats bar -->
        <div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-neutral-500">Main:</span>
            <span class="font-semibold" :class="deckView.counts.main >= deckView.rules.mainDeckMin ? 'text-emerald-400' : 'text-amber-400'">
              {{ deckView.counts.main }}
            </span>
            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-ink-800">
              <div class="h-full rounded-full transition-all" :class="deckView.counts.main >= deckView.rules.mainDeckMin ? 'bg-emerald-500' : 'bg-amber-500'" :style="{ width: `${mainProgress}%` }" />
            </div>
          </div>
          <div v-if="deckView.rules.hasExtraDeck" class="flex items-center gap-1.5">
            <span class="text-neutral-500">Extra:</span>
            <span class="font-semibold text-blue-400">{{ deckView.counts.extra }}</span>
            <span class="text-neutral-600">/{{ deckView.rules.extraDeckMax }}</span>
          </div>
          <div v-if="deckView.rules.hasSideDeck" class="flex items-center gap-1.5">
            <span class="text-neutral-500">Side:</span>
            <span class="font-semibold text-purple-400">{{ deckView.counts.side }}</span>
            <span class="text-neutral-600">/{{ deckView.rules.sideDeckMax }}</span>
          </div>
          <div class="hidden items-center gap-3 border-l border-ink-800 pl-4 sm:flex">
            <span class="text-xs text-neutral-500">
              <span class="text-amber-400">{{ deckView.breakdown.monster }}</span> M
              <span class="mx-1 text-neutral-600">/</span>
              <span class="text-blue-400">{{ deckView.breakdown.spell }}</span> S
              <span class="mx-1 text-neutral-600">/</span>
              <span class="text-rose-400">{{ deckView.breakdown.trap }}</span> T
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alerts -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6">
      <div v-if="editLoading" class="mt-4"><CommonLoadingState label="Loading deck for editing..." /></div>
      <UAlert v-else-if="editError" class="mt-4" color="error" variant="soft" icon="i-lucide-alert-circle" title="Unable to load deck" :description="editError" />
      <UAlert v-else-if="route.query.editId && deckView.savedDeckId" class="mt-4" color="info" variant="soft" icon="i-lucide-pencil" :title="`Editing: ${deckView.name}`" />
      <UAlert v-if="shareUrl" class="mt-4" color="success" variant="soft" icon="i-lucide-check-circle" title="Link copied!" :description="shareUrl" />
      <UAlert v-else-if="saveMessage" class="mt-4" color="success" variant="soft" icon="i-lucide-check-circle" :title="saveMessage" />
      <UAlert v-if="deckView.error" class="mt-4" color="error" variant="soft" icon="i-lucide-alert-circle" title="Save failed" :description="deckView.error" />
      <UAlert v-if="!deckView.savedDeckId && deckCount >= 5" class="mt-4" color="warning" variant="soft" icon="i-lucide-alert-triangle" title="Deck limit reached (5/5)" description="Delete a deck in My Decks first, or edit an existing deck." />

      <div v-if="generatorView.generating" class="mt-4">
        <DeckGenerator :stages="generatorView.stages" :active-stage="generatorView.activeStage" />
      </div>
      <UAlert v-else-if="generatorView.error" class="mt-4" color="error" variant="soft" icon="i-lucide-alert-circle" title="Generation failed" :description="generatorView.error" />
    </div>

    <!-- Format + Regenerate -->
    <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <div class="flex flex-wrap items-center gap-3">
        <DeckFormatSelector :model-value="deckView.format" :disabled="generatorView.generating" @update:model-value="deckView.setFormat($event)" />
        <UButton v-if="deckView.keyCardId" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" :loading="generatorView.generating" @click="regenerate">
          Regenerate
        </UButton>
      </div>
    </div>

    <!-- Mobile panel switch -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:hidden">
      <div class="mb-4 flex gap-2">
        <button :class="['flex-1 rounded-lg py-2.5 text-sm font-medium transition-all', mobilePanel === 'search' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-ink-800 text-neutral-400']" @click="mobilePanel = 'search'">
          Search Cards
        </button>
        <button :class="['flex-1 rounded-lg py-2.5 text-sm font-medium transition-all', mobilePanel === 'deck' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'bg-ink-800 text-neutral-400']" @click="mobilePanel = 'deck'">
          Deck ({{ deckView.counts.main + deckView.counts.extra }})
        </button>
      </div>
    </div>

    <!-- Main workspace -->
    <div class="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <div class="grid gap-6 lg:grid-cols-[1fr_380px]">
        <!-- Left: Card search -->
        <div :class="mobilePanel === 'search' ? '' : 'hidden lg:block'">
          <div class="mb-4">
            <CardsCardSearch v-model="explorerView.filters.search" @search="explorerView.applyFilters({ search: $event })" />
          </div>

          <CommonErrorState v-if="explorerView.error" title="Unable to load cards" :message="explorerView.error" @retry="explorerView.fetchCards()" />
          <CommonEmptyState v-else-if="explorerView.isEmpty" title="No cards found" message="Try a different search term." />
          <CardsCardGrid v-else :cards="explorerView.cards" :pending="explorerView.pending" :skeleton-count="6" :is-favorite="isFavorite" @toggle-favorite="toggleFavorite" @add="deckView.addCard($event, 1)" />
          <div v-if="!explorerView.error && !explorerView.isEmpty" class="mt-6">
            <CommonPagination :page="explorerView.page" :total-pages="explorerView.totalPages" @change="explorerView.goToPage($event)" />
          </div>
        </div>

        <!-- Right: Deck sidebar -->
        <aside :class="mobilePanel === 'deck' ? '' : 'hidden lg:block'">
          <div class="space-y-4 lg:sticky lg:top-20">
            <DeckStats :counts="deckView.counts" :breakdown="deckView.breakdown" :rules="deckView.rules" :stats="deckAnalysis" :issues="deckView.validation.issues" />

            <div class="thin-scroll max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              <DeckSection title="Main Deck" section="main" :entries="deckView.sections.main" :count="deckView.counts.main" :limit="deckView.rules.mainDeckMax" :max-copies="deckView.rules.maxCopiesPerCard" :breakdown="deckView.breakdown" @increase="deckView.increaseQuantity" @decrease="deckView.decreaseQuantity" @remove="deckView.removeCard" />
              <DeckSection v-if="deckView.rules.hasExtraDeck" title="Extra Deck" section="extra" :entries="deckView.sections.extra" :count="deckView.counts.extra" :limit="deckView.rules.extraDeckMax" :max-copies="deckView.rules.maxCopiesPerCard" @increase="deckView.increaseQuantity" @decrease="deckView.decreaseQuantity" @remove="deckView.removeCard" />
              <DeckSection v-if="deckView.rules.hasSideDeck" title="Side Deck" section="side" :entries="deckView.sections.side" :count="deckView.counts.side" :limit="deckView.rules.sideDeckMax" :max-copies="deckView.rules.maxCopiesPerCard" @increase="deckView.increaseQuantity" @decrease="deckView.decreaseQuantity" @remove="deckView.removeCard" />
            </div>

            <DeckRecommendation v-if="generatorView.result && generatorView.result.scores.length > 0" :scores="generatorView.result.scores" :cards-by-id="recommendationCards" />
          </div>
        </aside>
      </div>
    </div>

    <CommonConfirmDialog v-model:open="clearOpen" title="Clear deck?" message="All cards will be removed. Saved decks are not affected until you save again." confirm-label="Clear all" @confirm="onClear" />
  </div>
</template>
