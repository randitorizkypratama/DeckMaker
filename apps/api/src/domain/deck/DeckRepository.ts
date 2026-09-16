import type { Deck } from '@dueldex/shared'

/**
 * Persistence port for decks. Implemented in infrastructure so business
 * logic stays decoupled from any specific database.
 */
export interface DeckRepository {
  create(deck: Deck): Promise<Deck>
  findById(id: string): Promise<Deck | null>
  findByOwner(ownerId: string, opts?: { q?: string; sort?: string; order?: string; page?: number; pageSize?: number }): Promise<Deck[]>
  countByOwner?(ownerId: string, q?: string): Promise<number>
  update(deck: Deck): Promise<Deck>
  delete(id: string): Promise<void>
}
