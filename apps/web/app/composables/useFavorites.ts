import type { Card } from '@dueldex/shared'
import { useApi, ApiRequestError } from './useApi'
import { useAuth } from './useAuth'

/**
 * Favorites now persisted in SQLite per user via /api/favorites.
 * Requires login - anon users get a prompt to login.
 */

export function useFavorites() {
  const api = useApi()
  const auth = useAuth()

  const favoriteIds = useState<number[]>('dueldex-favorites', () => [])
  const hydrated = useState<boolean>('dueldex-favorites-hydrated', () => false)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function hydrate(): Promise<void> {
    // Ensure auth state is loaded from localStorage before checking
    if (!auth.initialized.value) auth.loadFromStorage()
    if (!auth.isAuthenticated.value) {
      favoriteIds.value = []
      hydrated.value = true
      return
    }
    if (hydrated.value) return
    await refresh()
    hydrated.value = true
  }

  async function refresh(): Promise<void> {
    if (!auth.isAuthenticated.value) {
      favoriteIds.value = []
      return
    }
    pending.value = true
    error.value = null
    try {
      const cards = await api.request<Card[]>('/api/favorites')
      favoriteIds.value = cards.map((c) => c.id)
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'UNAUTHORIZED') {
        error.value = 'Please login to view favorites.'
      } else {
        error.value = e instanceof ApiRequestError ? e.message : 'Unable to load favorites.'
      }
    } finally {
      pending.value = false
    }
  }

  function isFavorite(cardId: number): boolean {
    return favoriteIds.value.includes(cardId)
  }

  async function toggleFavorite(cardId: number): Promise<void> {
    if (!auth.isAuthenticated.value) {
      error.value = 'Please login to save favorites.'
      return
    }
    const currently = isFavorite(cardId)
    try {
      if (currently) {
        await api.request(`/api/favorites/${cardId}`, { method: 'DELETE' })
        favoriteIds.value = favoriteIds.value.filter((id) => id !== cardId)
      } else {
        await api.request<Card>('/api/favorites', { method: 'POST', body: { cardId } })
        favoriteIds.value = [cardId, ...favoriteIds.value]
      }
      error.value = null
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Unable to update favorite.'
    }
  }

  async function clearFavorites(): Promise<void> {
    if (!auth.isAuthenticated.value) return
    try {
      await api.request('/api/favorites', { method: 'DELETE' })
      favoriteIds.value = []
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Unable to clear favorites.'
    }
  }

  function getFavorites(): number[] {
    return [...favoriteIds.value]
  }

  const count = computed(() => favoriteIds.value.length)
  const isAuthenticated = computed(() => auth.isAuthenticated.value)

  return {
    favoriteIds,
    count,
    pending,
    error,
    hydrated,
    isAuthenticated,
    hydrate,
    refresh,
    isFavorite,
    toggleFavorite,
    getFavorites,
    clearFavorites,
  }
}

/**
 * Resolves favorite ids into full cards for the favorites page.
 * Uses the already-fetched /api/favorites response when possible,
 * but falls back to individual fetches if needed.
 */
export function useFavoriteCards() {
  const api = useApi()
  const auth = useAuth()
  const { hydrate } = useFavorites()

  const cards = ref<Card[]>([])
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!auth.initialized.value) auth.loadFromStorage()
    if (!auth.isAuthenticated.value) {
      cards.value = []
      error.value = 'Please login to view favorites.'
      return
    }
    await hydrate()
    pending.value = true
    error.value = null
    try {
      // Single call returns full cards - no N+1
      const result = await api.request<Card[]>('/api/favorites')
      cards.value = result
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'UNAUTHORIZED') {
        error.value = 'Please login to view favorites.'
        cards.value = []
      } else {
        error.value = e instanceof ApiRequestError ? e.message : 'Unable to load your favorite cards.'
      }
    } finally {
      pending.value = false
    }
  }

  return { cards, pending, error, load }
}
