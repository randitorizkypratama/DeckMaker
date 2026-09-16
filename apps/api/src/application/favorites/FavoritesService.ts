import type { Card } from '@dueldex/shared'
import type { CardRepository } from '../../domain/card/CardRepository.ts'
import type { FavoritesRepository } from '../../domain/card/FavoritesRepository.ts'
import { ValidationError } from '../../domain/errors.ts'

/**
 * Favorites use cases. Resolves stored card ids into full cards so the
 * favorites page can render without extra round trips.
 */
export class FavoritesService {
  constructor(
    private readonly favorites: FavoritesRepository,
    private readonly cards: CardRepository,
  ) {}

  async list(owner: string): Promise<Card[]> {
    const ids = await this.favorites.list(owner)
    if (ids.length === 0) return []
    return this.cards.findByIds(ids)
  }

  async add(owner: string, cardId: number): Promise<Card> {
    const card = await this.cards.findById(cardId)
    if (!card) {
      throw new ValidationError(`Card ${cardId} does not exist.`)
    }
    await this.favorites.add(owner, cardId)
    return card
  }

  async remove(owner: string, cardId: number): Promise<void> {
    await this.favorites.remove(owner, cardId)
  }

  async clear(owner: string): Promise<void> {
    await this.favorites.clear(owner)
  }
}
