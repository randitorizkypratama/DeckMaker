<script setup lang="ts">
import type { DeckDetail, Paginated } from '@dueldex/shared'

useHead({ title: 'My Decks - DuelDex' })

const auth = useAuth()
const api = useApi()

onMounted(() => auth.loadFromStorage())

const decks = ref<DeckDetail[]>([])
const pending = ref(false)
const error = ref<string | null>(null)
const total = ref(0)
const totalPages = ref(0)
const page = ref(1)
const pageSize = 9
const q = ref('')
const sort = ref('updated')
const order = ref<'asc' | 'desc'>('desc')

async function loadDecks() {
  if (!auth.isAuthenticated.value) {
    decks.value = []
    total.value = 0
    totalPages.value = 0
    return
  }
  pending.value = true
  error.value = null
  try {
    const res = await api.request<Paginated<DeckDetail> | DeckDetail[]>('/api/decks', {
      query: { q: q.value || undefined, sort: sort.value, order: order.value, page: page.value, pageSize } as any,
    })
    // Support both array (legacy) and paginated
    if (Array.isArray(res)) {
      decks.value = res
      total.value = res.length
      totalPages.value = 1
    } else {
      decks.value = res.items
      total.value = res.pagination.total
      totalPages.value = res.pagination.totalPages
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Unable to load decks.'
  } finally {
    pending.value = false
  }
}

watch(() => auth.isAuthenticated.value, () => { page.value = 1; loadDecks() })

async function onSearch() {
  page.value = 1
  await loadDecks()
}

async function onSortChange(v: string) {
  sort.value = v
  page.value = 1
  await loadDecks()
}

async function onPageChange(p: number) {
  page.value = p
  await loadDecks()
}

async function deleteDeck(id: string) {
  try {
    await api.request(`/api/decks/${id}`, { method: 'DELETE' })
    await loadDecks()
  } catch {}
}

async function toggleVisibility(deck: DeckDetail) {
  try {
    await api.request(`/api/decks/${deck.id}`, { method: 'PUT', body: { isPublic: !deck.isPublic } as any })
    await loadDecks()
  } catch {}
}

onMounted(loadDecks)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-neutral-50">My Decks</h1>
        <p class="mt-1 text-sm text-neutral-400">
          Stored in SQLite per your account. {{ total }}/5 decks used.
        </p>
      </div>
      <UButton
        to="/deck/new"
        color="primary"
        icon="i-lucide-plus"
        :disabled="total >= 5"
        :title="total >= 5 ? 'Maximum 5 decks reached' : undefined"
      >
        New Deck
      </UButton>
    </div>

    <UAlert
      v-if="auth.isAuthenticated.value && total >= 5"
      class="mb-4"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Deck limit reached"
      description="Maximum 5 decks per user. Delete a deck to create a new one. Edit existing decks is still allowed."
    />

    <UAlert
      v-if="!auth.isAuthenticated.value"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Login required"
      description="Please login to view and manage your decks."
    >
      <template #actions>
        <UButton to="/login" color="primary" size="sm">Login</UButton>
        <UButton to="/register" color="neutral" variant="outline" size="sm">Register</UButton>
      </template>
    </UAlert>

    <template v-else>
      <div class="mb-4 flex flex-col gap-3 sm:flex-row">
        <UInput v-model="q" placeholder="Search decks by name..." class="flex-1" @keydown.enter="onSearch" />
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-search" @click="onSearch">Search</UButton>
          <USelectMenu
            :model-value="sort"
            :items="[{label:'Updated', value:'updated'},{label:'Name', value:'name'}]"
            value-key="value"
            class="w-32"
            @update:model-value="onSortChange(String($event))"
          />
          <UButton color="neutral" variant="ghost" :icon="order==='desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" @click="order = order==='desc' ? 'asc' : 'desc'; loadDecks()">
            {{ order === 'desc' ? 'Desc' : 'Asc' }}
          </UButton>
        </div>
      </div>

      <CommonLoadingState v-if="pending" label="Loading your decks..." />
      <CommonErrorState
        v-else-if="error"
        title="Unable to load decks"
        :message="error"
        @retry="loadDecks()"
      />
      <CommonEmptyState
        v-else-if="decks.length === 0"
        title="No decks yet"
        :message="q ? `No decks match &quot;${q}&quot;` : 'Build a deck manually or generate one from a key card.'"
        action-label="Go to Deck Builder"
        @action="navigateTo('/deck/new')"
      />
      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="rounded-lg border border-ink-800 bg-ink-900 p-4"
          >
            <h3 class="truncate font-medium text-neutral-100">{{ deck.name }}</h3>
            <p class="text-xs text-neutral-500">{{ deck.format }} • {{ deck.stats.mainCount }} main / {{ deck.stats.extraCount }} extra</p>
            <p class="mt-1 flex items-center gap-2 text-xs text-neutral-600">
              <span>{{ new Date(deck.updatedAt).toLocaleString() }}</span>
              <span :class="deck.isPublic ? 'text-emerald-400' : 'text-neutral-500'" class="rounded bg-ink-800 px-1.5 py-0.5 text-xs">{{ deck.isPublic ? 'Public' : 'Private' }}</span>
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton :to="`/deck/${deck.id}`" size="sm" color="neutral" variant="outline">View</UButton>
              <UButton :to="`/deck/new?editId=${deck.id}`" size="sm" color="neutral" variant="outline" icon="i-lucide-pencil">Edit</UButton>
              <UButton size="sm" color="neutral" variant="ghost" :icon="deck.isPublic ? 'i-lucide-eye-off' : 'i-lucide-eye'" @click="toggleVisibility(deck)">{{ deck.isPublic ? 'Private' : 'Public' }}</UButton>
              <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="deleteDeck(deck.id)">Delete</UButton>
            </div>
          </div>
        </div>
        <div v-if="totalPages > 1" class="mt-6">
          <CommonPagination :page="page" :total-pages="totalPages" @change="onPageChange" />
        </div>
      </template>
    </template>
  </div>
</template>
