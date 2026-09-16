import type {
  Card,
  CreateDeckRequest,
  Deck,
  DeckCard,
  DeckDetail,
  Paginated,
  UpdateDeckRequest,
} from '@dueldex/shared'
import { buildPagination } from '@dueldex/shared'
import type { CardRepository } from '../../domain/card/CardRepository.ts'
import type { DeckRepository } from '../../domain/deck/DeckRepository.ts'
import { InvalidDeckError, NotFoundError, ValidationError } from '../../domain/errors.ts'
import { computeDeckStats, validateDeck } from '../../domain/deck/deck-rules.ts'
import { generateDeckId } from '../../infrastructure/repositories/deck-id.ts'

const MAX_NAME_LENGTH = 80
const MAX_DECKS_PER_USER = 5

/**
 * Removes control characters and HTML-significant characters from a
 * user-supplied deck name, then collapses whitespace.
 */
export function sanitizeDeckName(raw: string): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length === 0) {
    throw new ValidationError('Deck name cannot be empty.')
  }

  return cleaned.slice(0, MAX_NAME_LENGTH)
}

export class DeckService {
  constructor(
    private readonly decks: DeckRepository,
    private readonly cards: CardRepository,
  ) {}

  async enforceDeckLimit(ownerId?: string | null): Promise<void> {
    if (!ownerId) return
    const count = this.decks.countByOwner
      ? await this.decks.countByOwner(ownerId)
      : (await this.decks.findByOwner(ownerId)).length
    if (count >= MAX_DECKS_PER_USER) {
      throw new ValidationError(`Maximum ${MAX_DECKS_PER_USER} decks per user reached. Delete a deck to create a new one.`)
    }
  }

  /**
   * Creates a deck after validating it against its format rules.
   * Client-side validation is never trusted.
   */
  async create(request: CreateDeckRequest, ownerId?: string | null): Promise<DeckDetail> {
    await this.enforceDeckLimit(ownerId)
    const name = sanitizeDeckName(request.name)
    const cards = this.normalizeCards(request.cards)
    const cardsById = await this.resolveCards(cards)

    const validation = validateDeck({ format: request.format, cards }, cardsById)
    if (!validation.valid) {
      throw new InvalidDeckError(
        'Deck does not satisfy format requirements',
        validation.issues,
      )
    }

    const now = new Date().toISOString()
    const deck: Deck = {
      id: generateDeckId(),
      name,
      format: request.format,
      cards,
      createdAt: now,
      updatedAt: now,
    }
    if (typeof request.keyCardId === 'number') deck.keyCardId = request.keyCardId
    if (ownerId) deck.ownerId = ownerId
    deck.isPublic = request.isPublic ?? true

    const created = await this.decks.create(deck)
    return this.toDetail(created)
  }

  async getById(id: string): Promise<DeckDetail> {
    const deck = await this.decks.findById(id)
    if (!deck) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }
    return this.toDetail(deck)
  }

  async update(id: string, request: UpdateDeckRequest, ownerId?: string | null): Promise<DeckDetail> {
    const existing = await this.decks.findById(id)
    if (!existing) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }
    if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }

    const cards = request.cards ? this.normalizeCards(request.cards) : existing.cards
    const cardsById = await this.resolveCards(cards)

    const validation = validateDeck({ format: existing.format, cards }, cardsById)
    if (!validation.valid) {
      throw new InvalidDeckError(
        'Deck does not satisfy format requirements',
        validation.issues,
      )
    }

    const updated: Deck = {
      ...existing,
      name: request.name ? sanitizeDeckName(request.name) : existing.name,
      cards,
      updatedAt: new Date().toISOString(),
    }
    if (typeof request.keyCardId === 'number') updated.keyCardId = request.keyCardId
    if (typeof request.isPublic === 'boolean') updated.isPublic = request.isPublic
    // Preserve owner on update, or set if previously null and now authenticated
    if (ownerId && !existing.ownerId) updated.ownerId = ownerId

    const saved = await this.decks.update(updated)
    return this.toDetail(saved)
  }

  async listByOwner(ownerId: string, opts?: { q?: string; sort?: string; order?: string; page?: number; pageSize?: number }): Promise<Paginated<DeckDetail>> {
    const o = opts ?? {}
    const page = o.page ?? 1
    const pageSize = o.pageSize ?? 20
    const decks = await this.decks.findByOwner(ownerId, { q: o.q, sort: o.sort, order: o.order, page, pageSize })
    const total = this.decks.countByOwner ? await this.decks.countByOwner(ownerId, o.q) : decks.length
    const items = await Promise.all(decks.map((d) => this.toDetail(d)))
    return { items, pagination: buildPagination(page, pageSize, total) }
  }

  // Backward compat for callers expecting simple array (not paginated)
  async listByOwnerAll(ownerId: string): Promise<DeckDetail[]> {
    const decks = await this.decks.findByOwner(ownerId)
    return Promise.all(decks.map((d) => this.toDetail(d)))
  }

  async delete(id: string, ownerId?: string | null): Promise<void> {
    const existing = await this.decks.findById(id)
    if (!existing) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }
    if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }
    await this.decks.delete(id)
  }

  /**
   * Copies an existing deck under a new public id.
   */
  async clone(id: string, ownerId?: string | null): Promise<DeckDetail> {
    await this.enforceDeckLimit(ownerId)
    const existing = await this.decks.findById(id)
    if (!existing) {
      throw new NotFoundError('DECK_NOT_FOUND', 'Deck no longer exists.')
    }

    const now = new Date().toISOString()
    const copy: Deck = {
      ...existing,
      id: generateDeckId(),
      name: sanitizeDeckName(`${existing.name} (Copy)`),
      cards: existing.cards.map((entry) => ({ ...entry })),
      createdAt: now,
      updatedAt: now,
    }
    if (ownerId) copy.ownerId = ownerId

    const created = await this.decks.create(copy)
    return this.toDetail(created)
  }

  /**
   * Persists a deck built purely client-side (for example a generated deck)
   * so it can be shared by URL.
   */
  async persistGenerated(deck: Deck): Promise<DeckDetail> {
    await this.enforceDeckLimit(deck.ownerId ?? null)
    const created = await this.decks.create(deck)
    return this.toDetail(created)
  }

  /**
   * Merges duplicate card/section pairs and drops non-positive quantities.
   */
  private normalizeCards(cards: DeckCard[]): DeckCard[] {
    if (!Array.isArray(cards)) {
      throw new ValidationError('Deck cards must be an array.')
    }

    const merged = new Map<string, DeckCard>()
    for (const entry of cards) {
      if (!Number.isInteger(entry.cardId) || entry.cardId <= 0) {
        throw new ValidationError(`Invalid card id: ${String(entry.cardId)}`)
      }
      if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
        throw new ValidationError(`Invalid quantity for card ${entry.cardId}.`)
      }
      const key = `${entry.cardId}:${entry.section}`
      const existing = merged.get(key)
      if (existing) existing.quantity += entry.quantity
      else merged.set(key, { ...entry })
    }
    return [...merged.values()]
  }

  private async resolveCards(cards: DeckCard[]): Promise<Map<number, Card>> {
    const ids = [...new Set(cards.map((entry) => entry.cardId))]
    const resolved = await this.cards.findByIds(ids)
    const cardsById = new Map(resolved.map((card) => [card.id, card]))

    const missing = ids.filter((id) => !cardsById.has(id))
    if (missing.length > 0) {
      throw new ValidationError(`Unknown card ids: ${missing.join(', ')}`)
    }

    return cardsById
  }

  private async toDetail(deck: Deck): Promise<DeckDetail> {
    const ids = [...new Set(deck.cards.map((entry) => entry.cardId))]
    const resolved = await this.cards.findByIds(ids)
    const cardsById = new Map(resolved.map((card) => [card.id, card]))

    const detailCards = deck.cards
      .map((entry) => {
        const card = cardsById.get(entry.cardId)
        return card ? { ...entry, card } : null
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const detail: DeckDetail = {
      id: deck.id,
      name: deck.name,
      format: deck.format,
      cards: detailCards,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      stats: computeDeckStats(deck.cards, cardsById),
      isPublic: deck.isPublic ?? true,
    }

    if (typeof deck.keyCardId === 'number') {
      detail.keyCardId = deck.keyCardId
      const keyCard = cardsById.get(deck.keyCardId)
      if (keyCard) detail.keyCard = keyCard
      else {
        const [fetched] = await this.cards.findByIds([deck.keyCardId])
        if (fetched) detail.keyCard = fetched
      }
    }

    return detail
  }
}
