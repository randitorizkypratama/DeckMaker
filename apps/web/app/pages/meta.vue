<script setup lang="ts">
import type { Card } from '@dueldex/shared'

useHead({ title: 'Meta Analytics - DuelDex' })

const api = useApi()

const overview = ref<any>(null)
const pending = ref(true)
const topCards = ref<any[]>([])
const cardCache = ref<Record<number, Card>>({})

async function loadMeta() {
  pending.value = true
  try {
    overview.value = await api.request<any>('/api/meta/overview')
    topCards.value = overview.value.topCards ?? []

    const ids = topCards.value.map((c: any) => c.cardId)
    if (ids.length > 0) {
      const fetched = await Promise.all(ids.map(async (id: number) => {
        try { return await api.request<Card>(`/api/cards/${id}`) } catch { return null }
      }))
      for (const c of fetched) {
        if (c) cardCache.value[c.id] = c
      }
    }
  } catch {} finally { pending.value = false }
}

const maxUsage = computed(() => {
  if (topCards.value.length === 0) return 1
  return topCards.value[0]?.count ?? 1
})

const formatEntries = computed(() => {
  if (!overview.value) return []
  return Object.entries(overview.value.formatBreakdown as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
})

const archetypeEntries = computed(() => {
  if (!overview.value) return []
  return overview.value.archetypeBreakdown ?? []
})

onMounted(loadMeta)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-neutral-50">Meta Analytics</h1>
      <p class="mt-1 text-sm text-neutral-400">Card and deck popularity across all public decks.</p>
    </div>

    <CommonLoadingState v-if="pending" label="Loading meta data..." />

    <template v-else-if="overview">
      <!-- Overview Stats -->
      <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div class="text-2xl font-bold text-neutral-50">{{ overview.totalDecks }}</div>
          <div class="mt-0.5 text-xs text-neutral-400">Public Decks</div>
        </div>
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div class="text-2xl font-bold text-neutral-50">{{ overview.uniqueCardsUsed }}</div>
          <div class="mt-0.5 text-xs text-neutral-400">Unique Cards</div>
        </div>
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div class="text-2xl font-bold text-neutral-50">{{ overview.totalCardsUsed }}</div>
          <div class="mt-0.5 text-xs text-neutral-400">Total Uses</div>
        </div>
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <div class="text-2xl font-bold text-neutral-50">{{ overview.avgDeckSize }}</div>
          <div class="mt-0.5 text-xs text-neutral-400">Avg Deck Size</div>
        </div>
      </div>

      <!-- Format + Archetype row -->
      <div class="mb-8 grid gap-6 lg:grid-cols-2">
        <!-- Format Breakdown -->
        <div v-if="formatEntries.length">
          <h2 class="mb-3 text-sm font-semibold text-neutral-200">Format Popularity</h2>
          <div class="space-y-2">
            <div v-for="([fmt, cnt]) in formatEntries" :key="fmt" class="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3">
              <span class="text-sm font-medium text-neutral-200">{{ fmt }}</span>
              <div class="flex-1">
                <div class="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div class="h-full rounded-full bg-primary-500" :style="{ width: `${(cnt / overview.totalDecks) * 100}%` }" />
                </div>
              </div>
              <span class="text-xs font-bold text-primary-400">{{ cnt }}</span>
            </div>
          </div>
        </div>

        <!-- Archetype Breakdown -->
        <div v-if="archetypeEntries.length">
          <h2 class="mb-3 text-sm font-semibold text-neutral-200">Top Archetypes</h2>
          <div class="space-y-2">
            <div v-for="arch in archetypeEntries.slice(0, 8)" :key="arch.archetype" class="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3">
              <span class="min-w-0 truncate text-sm font-medium text-neutral-200">{{ arch.archetype }}</span>
              <div class="flex-1">
                <div class="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div class="h-full rounded-full bg-amber-500" :style="{ width: `${(arch.deckCount / overview.totalDecks) * 100}%` }" />
                </div>
              </div>
              <span class="text-xs font-bold text-amber-400">{{ arch.deckCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Cards -->
      <div class="mb-8">
        <h2 class="mb-3 text-sm font-semibold text-neutral-200">Most Popular Cards</h2>
        <div v-if="topCards.length === 0" class="rounded-xl border border-dashed border-ink-700 py-8 text-center text-sm text-neutral-500">
          No deck data yet.
        </div>
        <div v-else class="space-y-2">
          <div v-for="(entry, i) in topCards.slice(0, 20)" :key="entry.cardId" class="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 transition-colors hover:border-ink-700">
            <span class="w-6 text-center text-xs font-bold text-neutral-500">{{ i + 1 }}</span>
            <img
              v-if="cardCache[entry.cardId]?.cardImages?.[0]"
              :src="cardCache[entry.cardId]!.cardImages[0]!.imageUrlSmall"
              class="h-10 w-7 rounded object-cover"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-neutral-100">{{ cardCache[entry.cardId]?.name ?? `Card #${entry.cardId}` }}</div>
              <div class="text-xs text-neutral-500">{{ cardCache[entry.cardId]?.type }}</div>
            </div>
            <div class="flex items-center gap-4 text-xs">
              <div class="text-right">
                <div class="font-bold text-neutral-200">{{ entry.count }}</div>
                <div class="text-neutral-500">decks</div>
              </div>
              <div class="w-20">
                <div class="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div class="h-full rounded-full bg-primary-500" :style="{ width: `${(entry.count / maxUsage) * 100}%` }" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Decks -->
      <div v-if="overview.topDecks?.length">
        <h2 class="mb-3 text-sm font-semibold text-neutral-200">Top Decks</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="d in overview.topDecks"
            :key="d.id"
            :to="`/deck/${d.id}`"
            class="group rounded-xl border border-ink-800 bg-ink-900 p-4 transition-all hover:border-ink-700 hover:bg-ink-850/50"
          >
            <div class="font-medium text-neutral-100 group-hover:text-primary-400 transition-colors">{{ d.name }}</div>
            <div class="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <UBadge :color="d.format === 'yu-gi-oh' ? 'primary' : 'warning'" variant="subtle" size="xs">{{ d.format }}</UBadge>
              <span>{{ d.ownerName ?? 'anon' }}</span>
              <span>{{ d.cardCount }} cards</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
