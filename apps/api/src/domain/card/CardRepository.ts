import type { Card, CardQuery, FilterMetadata, Paginated } from '@dueldex/shared'

/**
 * Port for card data access. Implemented in infrastructure.
 * The domain and application layers depend only on this interface,
 * never on YGOPRODeck.
 */
export interface CardRepository {
  search(query: CardQuery): Promise<Paginated<Card>>
  findById(id: number): Promise<Card | null>
  findByIds(ids: number[]): Promise<Card[]>
  /** Cards belonging to a named archetype. */
  findByArchetype(archetype: string): Promise<Card[]>
  /** Free-text search over card names and descriptions. */
  findByText(text: string): Promise<Card[]>
  /** Official banlist cards from YGOPRODeck. */
  findBannedCards(banlist: 'tcg' | 'ocg'): Promise<Card[]>
  /** Available filter values for the explorer UI. */
  getFilterMetadata(): Promise<FilterMetadata>
}
