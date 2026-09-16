import type { Card, CardQuery, FilterMetadata, Paginated } from '@dueldex/shared'
import type { CardRepository } from '../../domain/card/CardRepository.ts'
import { NotFoundError } from '../../domain/errors.ts'

/**
 * Card use cases. Coordinates the card repository; contains no transport
 * or vendor-specific concerns.
 */
export class CardService {
  constructor(private readonly cards: CardRepository) {}

  async search(query: CardQuery): Promise<Paginated<Card>> {
    return this.cards.search(query)
  }

  async getById(id: number): Promise<Card> {
    const card = await this.cards.findById(id)
    if (!card) {
      throw new NotFoundError('CARD_NOT_FOUND', `Card ${id} was not found.`)
    }
    return card
  }

  async getManyByIds(ids: number[]): Promise<Card[]> {
    return this.cards.findByIds(ids)
  }

  async getFilterMetadata(): Promise<FilterMetadata> {
    return this.cards.getFilterMetadata()
  }

  async getOfficialBanlist(banlist: 'tcg' | 'ocg' = 'tcg'): Promise<Card[]> {
    const cards = await this.cards.findBannedCards(banlist)
    return cards.map((card) => ({
      ...card,
      banlistStatus: card.banlist?.[banlist] ?? null,
    }))
  }
}
