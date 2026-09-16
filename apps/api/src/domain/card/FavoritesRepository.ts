/**
 * Persistence port for favorites.
 *
 * Favorites are stored per client-supplied owner key so the abstraction can
 * later be backed by a real user id once authentication exists.
 */
export interface FavoritesRepository {
  list(owner: string): Promise<number[]>
  add(owner: string, cardId: number): Promise<void>
  remove(owner: string, cardId: number): Promise<void>
  clear(owner: string): Promise<void>
}
