import type { Card, CardQuery, FilterMetadata, Paginated } from '@dueldex/shared'
import { DEFAULT_PAGE_SIZE } from '@dueldex/shared'
import { ApiRequestError, useApi } from './useApi'

export interface CardFilters {
  search: string
  type: string
  attribute: string
  level: number | undefined
  archetype: string
  race: string
  atk: number | undefined
  def: number | undefined
  sort: string
  sortOrder: 'asc' | 'desc'
}

export function emptyFilters(): CardFilters {
  return { search: '', type: '', attribute: '', level: undefined, archetype: '', race: '', atk: undefined, def: undefined, sort: 'name', sortOrder: 'desc' }
}

/**
 * Card explorer state: search, filtering, pagination and request status.
 * Components render this; they do not implement it.
 */
export function useCards(options: { pageSize?: number } = {}) {
  const api = useApi()
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE

  const cards = ref<Card[]>([])
  const filters = ref<CardFilters>(emptyFilters())
  const page = ref(1)
  const total = ref(0)
  const totalPages = ref(0)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const hasFilters = computed(
    () =>
      Boolean(filters.value.search) ||
      Boolean(filters.value.type) ||
      Boolean(filters.value.attribute) ||
      Boolean(filters.value.archetype) ||
      Boolean(filters.value.race) ||
      filters.value.level !== undefined ||
      filters.value.atk !== undefined ||
      filters.value.def !== undefined ||
      (filters.value.sort !== '' && filters.value.sort !== 'name'),
  )

  const isEmpty = computed(() => !pending.value && !error.value && cards.value.length === 0)

  function buildQuery(): Record<string, string | number | undefined> {
    const query: CardQuery = { page: page.value, pageSize }
    if (filters.value.search) query.search = filters.value.search
    if (filters.value.type) query.type = filters.value.type
    if (filters.value.attribute) query.attribute = filters.value.attribute
    if (filters.value.archetype) query.archetype = filters.value.archetype
    if (filters.value.race) query.race = filters.value.race
    if (filters.value.level !== undefined) query.level = filters.value.level
    if (filters.value.atk !== undefined) query.atk = filters.value.atk
    if (filters.value.def !== undefined) query.def = filters.value.def
    if (filters.value.sort && filters.value.sort !== 'name') query.sort = filters.value.sort
    if (filters.value.sortOrder) query.sortOrder = filters.value.sortOrder
    return query as Record<string, string | number | undefined>
  }

  async function fetchCards(): Promise<void> {
    pending.value = true
    error.value = null
    try {
      const result = await api.request<Paginated<Card>>('/api/cards', {
        query: buildQuery(),
      })
      cards.value = result.items
      total.value = result.pagination.total
      totalPages.value = result.pagination.totalPages
    } catch (caught) {
      cards.value = []
      total.value = 0
      totalPages.value = 0
      error.value =
        caught instanceof ApiRequestError ? caught.message : 'Unable to load cards.'
    } finally {
      pending.value = false
    }
  }

  /** Applies filter changes and resets to the first page. */
  async function applyFilters(next: Partial<CardFilters>): Promise<void> {
    filters.value = { ...filters.value, ...next }
    page.value = 1
    await fetchCards()
  }

  async function clearFilters(): Promise<void> {
    filters.value = emptyFilters()
    page.value = 1
    await fetchCards()
  }

  async function goToPage(next: number): Promise<void> {
    if (next < 1 || (totalPages.value > 0 && next > totalPages.value)) return
    page.value = next
    await fetchCards()
  }

  return {
    cards,
    filters,
    page,
    total,
    totalPages,
    pending,
    error,
    hasFilters,
    isEmpty,
    pageSize,
    fetchCards,
    applyFilters,
    clearFilters,
    goToPage,
  }
}

/**
 * Filter dropdown values. Cached for the session since they rarely change.
 */
export function useCardFilterMetadata() {
  const api = useApi()
  const metadata = useState<FilterMetadata | null>('card-filter-metadata', () => null)
  const pending = ref(false)

  async function load(): Promise<void> {
    if (metadata.value || pending.value) return
    pending.value = true
    try {
      metadata.value = await api.request<FilterMetadata>('/api/cards/meta/filters')
    } catch {
      // Filters are an enhancement; the explorer still works without them.
      metadata.value = {
        types: [],
        attributes: [],
        races: [],
        archetypes: [],
        levels: Array.from({ length: 12 }, (_, index) => index + 1),
      }
    } finally {
      pending.value = false
    }
  }

  return { metadata, pending, load }
}

/**
 * Single card detail loader.
 */
export function useCardDetail(id: number | string) {
  const api = useApi()
  const card = ref<Card | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    pending.value = true
    error.value = null
    try {
      card.value = await api.request<Card>(`/api/cards/${id}`)
    } catch (caught) {
      card.value = null
      error.value =
        caught instanceof ApiRequestError ? caught.message : 'Unable to load this card.'
    } finally {
      pending.value = false
    }
  }

  return { card, pending, error, load }
}
