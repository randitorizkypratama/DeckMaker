import type {
  Card,
  Deck,
  DeckFormat,
  DeckRecommendation,
  GenerateDeckRequest,
} from '@dueldex/shared'
import { getFormatRules, isExtraDeckCard } from '@dueldex/shared'
import type { CardRepository } from '../../domain/card/CardRepository.ts'
import { InvalidDeckError, NotFoundError } from '../../domain/errors.ts'
import { composeDeck } from '../../domain/deck/deck-composer.ts'
import { computeDeckStats, validateDeck } from '../../domain/deck/deck-rules.ts'
import { scoreCards } from '../../domain/deck/synergy-scoring.ts'
import { generateDeckId } from '../../infrastructure/repositories/deck-id.ts'
import type { YgoProDeckRepository } from '../../infrastructure/ygoprodeck/YgoProDeckRepository.ts'
import type { DeckService } from './DeckService.ts'

/**
 * Smart deck generation use case.
 *
 * Orchestrates candidate gathering, synergy scoring and format-aware
 * composition. All scoring and composition logic lives in the domain layer;
 * this service only coordinates.
 */
export class DeckGeneratorService {
  constructor(
    private readonly cards: CardRepository & {
      findFormatPool: YgoProDeckRepository['findFormatPool']
      findStaples: YgoProDeckRepository['findStaples']
    },
    private readonly deckService: DeckService,
  ) {}

  async generate(request: GenerateDeckRequest, ownerId?: string | null): Promise<DeckRecommendation> {
    if (ownerId) await this.deckService.enforceDeckLimit(ownerId)
    const keyCard = await this.cards.findById(request.keyCardId)
    if (!keyCard) {
      throw new NotFoundError('CARD_NOT_FOUND', `Card ${request.keyCardId} was not found.`)
    }

    const candidates = await this.gatherCandidates(keyCard, request.format)
    const scores = scoreCards(candidates, { keyCard })

    const { cards, usedScores } = composeDeck({
      keyCard,
      format: request.format,
      candidates,
      scores,
    })

    const cardsById = new Map(candidates.map((card) => [card.id, card]))
    cardsById.set(keyCard.id, keyCard)

    const validation = validateDeck({ format: request.format, cards }, cardsById)
    if (!validation.valid) {
      throw new InvalidDeckError(
        'Generated deck does not satisfy format requirements',
        validation.issues,
      )
    }

    const now = new Date().toISOString()
    const deck: Deck = {
      id: generateDeckId(),
      name: request.name?.trim() || `${keyCard.name} Deck`,
      format: request.format,
      keyCardId: keyCard.id,
      cards,
      createdAt: now,
      updatedAt: now,
    }
    if (ownerId) deck.ownerId = ownerId

    // Build detail cards without persisting — user saves manually
    const detailCards = cards
      .map((entry) => {
        const card = cardsById.get(entry.cardId)
        return card ? { ...entry, card } : null
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const detail: import('@dueldex/shared').DeckDetail = {
      id: deck.id,
      name: deck.name,
      format: deck.format,
      keyCardId: deck.keyCardId,
      cards: detailCards,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      stats: computeDeckStats(deck.cards, cardsById),
      isPublic: true,
    }
    if (keyCard) detail.keyCard = keyCard

    return {
      deck: detail,
      scores: usedScores.sort((a, b) => b.score - a.score),
    }
  }

  /**
   * Builds the candidate pool: archetype members first, then cards whose text
   * references the key card or its archetype, then format staples to fill out
   * the remaining slots.
   */
  private async gatherCandidates(keyCard: Card, format: DeckFormat): Promise<Card[]> {
    const rules = getFormatRules(format)
    const byId = new Map<number, Card>()
    const add = (card: Card): void => {
      if (card.banlist?.tcg === 'Forbidden' && card.id !== keyCard.id) return
      if (!byId.has(card.id)) byId.set(card.id, card)
    }

    add(keyCard)

    const lookups: Promise<Card[]>[] = []

    if (keyCard.archetype) {
      lookups.push(this.cards.findByArchetype(keyCard.archetype))
      lookups.push(this.cards.findByText(keyCard.archetype))
    }

    lookups.push(this.cards.findByText(keyCard.name))
    lookups.push(this.cards.findStaples(format))

    const results = await Promise.allSettled(lookups)
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      for (const card of result.value) add(card)
    }

    // Ensure enough main deck candidates by fetching format pool
    const mainDeckCount = [...byId.values()].filter(
      (card) => !(rules.hasExtraDeck && isExtraDeckCard(card))
    ).length
    if (mainDeckCount < rules.mainDeckMin * 2) {
      const pool = await this.cards.findFormatPool(format, 800)
      for (const card of pool) add(card)
    }

    // Also fetch staples with higher limit to ensure side deck candidates
    try {
      const extraStaples = await this.cards.findStaples(format, 200)
      for (const card of extraStaples) add(card)
    } catch {}

    return [...byId.values()]
  }
}
