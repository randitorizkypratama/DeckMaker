<script setup lang="ts">
import type { Card } from '@dueldex/shared'
import type { CardFilters } from '~/composables/useCards'

useHead({ title: 'Card Explorer - DuelDex' })

const route = useRoute()
const router = useRouter()

const {
  cards,
  filters,
  page,
  total,
  totalPages,
  pending,
  error,
  hasFilters,
  isEmpty,
  fetchCards,
  applyFilters,
  clearFilters,
  goToPage,
} = useCards()

const { metadata, load: loadMetadata } = useCardFilterMetadata()
const { isFavorite, toggleFavorite, hydrate } = useFavorites()

const filtersOpen = ref(false)

function readQuery(): void {
  const query = route.query
  filters.value = {
    search: typeof query.search === 'string' ? query.search : '',
    type: typeof query.type === 'string' ? query.type : '',
    attribute: typeof query.attribute === 'string' ? query.attribute : '',
    archetype: typeof query.archetype === 'string' ? query.archetype : '',
    race: typeof query.race === 'string' ? query.race : '',
    level: typeof query.level === 'string' ? Number(query.level) : undefined,
    atk: typeof query.atk === 'string' ? Number(query.atk) : undefined,
    def: typeof query.def === 'string' ? Number(query.def) : undefined,
    sort: typeof query.sort === 'string' ? query.sort : 'name',
    sortOrder: typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : 'desc',
  }
  page.value = typeof query.page === 'string' ? Math.max(1, Number(query.page)) : 1
}

function writeQuery(): void {
  const query: Record<string, string> = {}
  if (filters.value.search) query.search = filters.value.search
  if (filters.value.type) query.type = filters.value.type
  if (filters.value.attribute) query.attribute = filters.value.attribute
  if (filters.value.archetype) query.archetype = filters.value.archetype
  if (filters.value.race) query.race = filters.value.race
  if (filters.value.level !== undefined) query.level = String(filters.value.level)
  if (filters.value.atk !== undefined) query.atk = String(filters.value.atk)
  if (filters.value.def !== undefined) query.def = String(filters.value.def)
  if (filters.value.sort && filters.value.sort !== 'name') query.sort = filters.value.sort
  if (filters.value.sortOrder && filters.value.sortOrder !== 'desc') query.sortOrder = filters.value.sortOrder
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}

async function onFilterChange(next: Partial<CardFilters>): Promise<void> {
  await applyFilters(next)
  writeQuery()
}

async function onSortChange(value: string): Promise<void> {
  filters.value = { ...filters.value, sort: value }
  page.value = 1
  await fetchCards()
  writeQuery()
}

function toggleSortOrder(): void {
  filters.value = { ...filters.value, sortOrder: filters.value.sortOrder === 'desc' ? 'asc' : 'desc' }
  page.value = 1
  fetchCards()
  writeQuery()
}

async function onSearch(value: string): Promise<void> {
  await applyFilters({ search: value })
  writeQuery()
}

async function onClear(): Promise<void> {
  await clearFilters()
  writeQuery()
  filtersOpen.value = false
}

async function onPage(next: number): Promise<void> {
  await goToPage(next)
  writeQuery()
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onAdd(card: Card): void {
  navigateTo(`/cards/${card.id}`)
}

function openFilters(): void {
  filtersOpen.value = true
}

function closeFilters(): void {
  filtersOpen.value = false
}

const activeFilterChips = computed(() => {
  const chips: { label: string; key: string }[] = []
  if (filters.value.type) chips.push({ label: filters.value.type, key: 'type' })
  if (filters.value.attribute) chips.push({ label: filters.value.attribute, key: 'attribute' })
  if (filters.value.archetype) chips.push({ label: filters.value.archetype, key: 'archetype' })
  if (filters.value.race) chips.push({ label: filters.value.race, key: 'race' })
  if (filters.value.level !== undefined) chips.push({ label: `Level ${filters.value.level}`, key: 'level' })
  if (filters.value.atk !== undefined) chips.push({ label: `ATK ${filters.value.atk}`, key: 'atk' })
  if (filters.value.def !== undefined) chips.push({ label: `DEF ${filters.value.def}`, key: 'def' })
  return chips
})

function removeFilterChip(key: string): void {
  const update: Partial<CardFilters> = {}
  if (key === 'level') update.level = undefined
  else if (key === 'atk') update.atk = undefined
  else if (key === 'def') update.def = undefined
  else (update as any)[key] = ''
  onFilterChange(update)
}

onMounted(async () => {
  await hydrate()
  readQuery()
  await Promise.all([loadMetadata(), fetchCards()])
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero header -->
    <div class="relative overflow-hidden border-b border-ink-800 bg-gradient-to-br from-ink-950 via-ink-900 to-primary-950/20">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,197,94,0.06),transparent_50%)]" />
      <div class="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div class="flex flex-col items-center text-center">
          <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1">
            <UIcon name="i-lucide-wand-2" class="size-3.5 text-primary-400" />
            <span class="text-xs font-medium text-primary-300">Powered by YGOPRODeck</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
            Card <span class="text-primary-400">Explorer</span>
          </h1>
          <p class="mt-2 max-w-lg text-sm text-neutral-400 sm:text-base">
            Search, filter, and discover cards. Build your dream deck from 10,000+ cards.
          </p>
        </div>

        <!-- Search bar -->
        <div class="mx-auto mt-6 max-w-2xl">
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <UIcon name="i-lucide-search" class="size-5 text-neutral-500" />
            </div>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search cards by name, archetype, or effect..."
              class="w-full rounded-xl border border-ink-700 bg-ink-900/80 py-3 pl-11 pr-4 text-sm text-neutral-200 placeholder-neutral-500 backdrop-blur-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:py-3.5 sm:text-base"
              @keydown.enter="onSearch(filters.search)"
            />
            <button
              v-if="filters.search"
              class="absolute inset-y-0 right-0 flex items-center pr-3"
              aria-label="Clear search"
              @click="onSearch('')"
            >
              <span class="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-ink-800 hover:text-neutral-300">
                <UIcon name="i-lucide-x" class="size-4" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <!-- Stats & filter bar -->
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <p v-if="!pending && !error" class="text-sm text-neutral-400">
            <span class="font-semibold text-neutral-200">{{ total.toLocaleString() }}</span>
            {{ total === 1 ? 'card' : 'cards' }} found
          </p>
          <p v-else-if="pending" class="flex items-center gap-2 text-sm text-neutral-400">
            <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
            Searching...
          </p>
          <span v-if="totalPages > 1 && !pending" class="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-neutral-400">
            Page {{ page }} / {{ totalPages }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-sliders-horizontal"
            class="lg:hidden"
            @click="openFilters"
          >
            Filters
            <span v-if="hasFilters" class="ml-1 size-1.5 rounded-full bg-primary-400" />
          </UButton>

          <div class="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900">
            <div class="flex items-center gap-1 px-2">
              <UIcon name="i-lucide-arrow-up-down" class="size-3.5 text-neutral-500" />
              <select
                :value="filters.sort"
                class="bg-transparent py-2 pr-1 text-xs text-neutral-300 focus:outline-none"
                @change="onSortChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="name">Name</option>
                <option value="atk">ATK</option>
                <option value="def">DEF</option>
                <option value="level">Level</option>
              </select>
            </div>
            <button
              class="flex items-center gap-0.5 border-l border-ink-700 px-2.5 py-2 text-xs transition-colors hover:bg-ink-800"
              :class="filters.sortOrder === 'asc' ? 'text-primary-400' : 'text-neutral-400'"
              @click="toggleSortOrder"
            >
              <UIcon :name="filters.sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
              {{ filters.sortOrder === 'asc' ? 'ASC' : 'DESC' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilterChips.length > 0" class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-xs text-neutral-500">Active:</span>
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          class="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-red-800 hover:bg-red-950/30 hover:text-red-400"
          @click="removeFilterChip(chip.key)"
        >
          {{ chip.label }}
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
        <button
          class="text-xs text-neutral-500 underline decoration-neutral-600 underline-offset-2 hover:text-neutral-300"
          @click="onClear"
        >
          Clear all
        </button>
      </div>

      <!-- Main layout -->
      <div class="flex gap-6">
        <!-- Desktop sidebar filters -->
        <aside class="hidden w-60 shrink-0 lg:block">
          <div class="sticky top-20 space-y-4">
            <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
              <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-200">
                <UIcon name="i-lucide-filter" class="size-4 text-primary-400" />
                Filters
              </h2>
              <CardsCardFilters
                :filters="filters"
                :metadata="metadata"
                :has-filters="hasFilters"
                @change="onFilterChange"
                @clear="onClear"
              />
            </div>
          </div>
        </aside>

        <!-- Cards area -->
        <div class="min-w-0 flex-1">
          <CommonErrorState
            v-if="error"
            title="Unable to load cards"
            :message="error"
            @retry="fetchCards()"
          />

          <CommonEmptyState
            v-else-if="isEmpty"
            title="No cards found"
            message="No cards match your current search and filters."
            :action-label="hasFilters ? 'Clear filters' : undefined"
            @action="onClear"
          />

          <CardsCardGrid
            v-else
            :cards="cards"
            :pending="pending"
            :is-favorite="isFavorite"
            @toggle-favorite="toggleFavorite"
            @add="onAdd"
          />

          <div v-if="!error && !isEmpty" class="mt-8">
            <CommonPagination :page="page" :total-pages="totalPages" @change="onPage" />
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile filter drawer -->
    <USlideover v-model:open="filtersOpen" title="Filters">
      <template #body>
        <CardsCardFilters
          :filters="filters"
          :metadata="metadata"
          :has-filters="hasFilters"
          @change="onFilterChange"
          @clear="onClear"
        />
      </template>
      <template #footer>
        <UButton color="primary" block @click="closeFilters">
          Show {{ total.toLocaleString() }} results
        </UButton>
      </template>
    </USlideover>
  </div>
</template>
