import { describe, expect, test } from 'bun:test'
import type {
  Card,
  CardQuery,
  FilterMetadata,
  Paginated,
} from '@dueldex/shared'
import { buildPagination } from '@dueldex/shared'
import type { CardRepository } from '../src/domain/card/CardRepository.ts'
import { CardService } from '../src/application/cards/CardService.ts'
import { DeckService, sanitizeDeckName } from '../src/application/decks/DeckService.ts'
import { InMemoryDeckRepository } from '../src/infrastructure/repositories/InMemoryDeckRepository.ts'
import { darkMagician, makeCard } from './fixtures.ts'

/**
 * Repository that applies the same filters the real one delegates upstream,
 * so search, filtering and pagination behaviour is asserted in isolation.
 */
class FilterableCardRepository implements CardRepository {
  constructor(private readonly cards: Card[]) {}

  async search(query: CardQuery): Promise<Paginated<Card>> {
    let filtered = [...this.cards]

    if (query.search) {
      const needle = query.search.toLowerCase()
      filtered = filtered.filter((card) => card.name.toLowerCase().includes(needle))
    }
    if (query.type) filtered = filtered.filter((card) => card.type === query.type)
    if (query.attribute) {
      filtered = filtered.filter((card) => card.attribute === query.attribute)
    }
    if (typeof query.level === 'number') {
      filtered = filtered.filter((card) => card.level === query.level)
    }
    if (query.archetype) {
      filtered = filtered.filter((card) => card.archetype === query.archetype)
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 24
    const start = (page - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      pagination: buildPagination(page, pageSize, filtered.length),
    }
  }

  async findById(id: number): Promise<Card | null> {
    return this.cards.find((card) => card.id === id) ?? null
  }

  async findByIds(ids: number[]): Promise<Card[]> {
    return this.cards.filter((card) => ids.includes(card.id))
  }

  async findByArchetype(archetype: string): Promise<Card[]> {
    return this.cards.filter((card) => card.archetype === archetype)
  }

  async findByText(text: string): Promise<Card[]> {
    const needle = text.toLowerCase()
    return this.cards.filter((card) => card.desc.toLowerCase().includes(needle))
  }

  async findBannedCards(): Promise<Card[]> {
    return this.cards.filter((card) => card.banlist?.tcg)
  }

  async getFilterMetadata(): Promise<FilterMetadata> {
    return {
      types: ['Normal Monster', 'Spell Card'],
      attributes: ['DARK', 'LIGHT'],
      races: ['Spellcaster'],
      archetypes: ['Dark Magician'],
      levels: [4, 7],
    }
  }
}

function buildCards(): Card[] {
  const cards: Card[] = [darkMagician]
  for (let index = 0; index < 30; index += 1) {
    cards.push(
      makeCard({
        id: 500000 + index,
        name: `Test Monster ${index}`,
        type: 'Effect Monster',
        race: 'Warrior',
        attribute: index % 2 === 0 ? 'LIGHT' : 'DARK',
        level: 4,
        atk: 1000 + index,
      }),
    )
  }
  return cards
}

function createCardService(): CardService {
  return new CardService(new FilterableCardRepository(buildCards()))
}

describe('card search', () => {
  test('finds cards by partial name', async () => {
    const result = await createCardService().search({ search: 'Dark Magician' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.name).toBe('Dark Magician')
  })

  test('returns an empty result set rather than failing', async () => {
    const result = await createCardService().search({ search: 'Nonexistent Card Xyz' })
    expect(result.items).toEqual([])
    expect(result.pagination.total).toBe(0)
  })

  test('filters by attribute', async () => {
    const result = await createCardService().search({ attribute: 'LIGHT', pageSize: 60 })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((card) => card.attribute === 'LIGHT')).toBe(true)
  })

  test('filters by level', async () => {
    const result = await createCardService().search({ level: 7, pageSize: 60 })
    expect(result.items.every((card) => card.level === 7)).toBe(true)
  })

  test('filters by archetype', async () => {
    const result = await createCardService().search({ archetype: 'Dark Magician' })
    expect(result.items).toHaveLength(1)
  })

  test('filters by card type', async () => {
    const result = await createCardService().search({ type: 'Normal Monster', pageSize: 60 })
    expect(result.items.every((card) => card.type === 'Normal Monster')).toBe(true)
  })
})

describe('card pagination', () => {
  test('splits results across pages', async () => {
    const service = createCardService()
    const first = await service.search({ page: 1, pageSize: 10 })
    expect(first.items).toHaveLength(10)
    expect(first.pagination.page).toBe(1)
    expect(first.pagination.hasNext).toBe(true)
    expect(first.pagination.hasPrev).toBe(false)
  })

  test('a later page returns different cards', async () => {
    const service = createCardService()
    const first = await service.search({ page: 1, pageSize: 10 })
    const second = await service.search({ page: 2, pageSize: 10 })
    expect(second.pagination.hasPrev).toBe(true)
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id)
  })

  test('computes total pages correctly', async () => {
    const result = await createCardService().search({ page: 1, pageSize: 10 })
    expect(result.pagination.total).toBe(31)
    expect(result.pagination.totalPages).toBe(4)
  })

  test('the final page reports no next page', async () => {
    const result = await createCardService().search({ page: 4, pageSize: 10 })
    expect(result.pagination.hasNext).toBe(false)
  })
})

describe('card detail', () => {
  test('returns a card by id', async () => {
    const card = await createCardService().getById(darkMagician.id)
    expect(card.name).toBe('Dark Magician')
  })

  test('throws for an unknown card id', async () => {
    await expect(createCardService().getById(123456789)).rejects.toThrow()
  })

  test('exposes filter metadata', async () => {
    const metadata = await createCardService().getFilterMetadata()
    expect(metadata.attributes).toContain('DARK')
    expect(metadata.archetypes).toContain('Dark Magician')
  })
})

describe('deck name sanitization', () => {
  test('strips angle brackets to prevent markup injection', () => {
    expect(sanitizeDeckName('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })

  test('collapses excess whitespace', () => {
    expect(sanitizeDeckName('  My    Deck  ')).toBe('My Deck')
  })

  test('rejects an empty name', () => {
    expect(() => sanitizeDeckName('   ')).toThrow()
  })

  test('truncates an over-long name', () => {
    expect(sanitizeDeckName('a'.repeat(200)).length).toBe(80)
  })
})

describe('deck CRUD', () => {
  function createDeckService(): DeckService {
    return new DeckService(new InMemoryDeckRepository(), new FilterableCardRepository(buildCards()))
  }

  function legalDeck() {
    const cards = []
    let remaining = 40
    let index = 0
    while (remaining > 0) {
      const quantity = Math.min(3, remaining)
      cards.push({ cardId: 500000 + index, quantity, section: 'main' as const })
      remaining -= quantity
      index += 1
    }
    return cards
  }

  test('creates a valid deck', async () => {
    const deck = await createDeckService().create({
      name: 'My Deck',
      format: 'yu-gi-oh',
      cards: legalDeck(),
    })
    expect(deck.name).toBe('My Deck')
    expect(deck.stats.mainCount).toBe(40)
    expect(deck.id).toHaveLength(10)
  })

  test('rejects a deck that violates format rules', async () => {
    await expect(
      createDeckService().create({
        name: 'Too Small',
        format: 'yu-gi-oh',
        cards: [{ cardId: 500000, quantity: 1, section: 'main' }],
      }),
    ).rejects.toThrow()
  })

  test('rejects a deck containing unknown cards', async () => {
    await expect(
      createDeckService().create({
        name: 'Bad Cards',
        format: 'yu-gi-oh',
        cards: [{ cardId: 999999999, quantity: 3, section: 'main' }],
      }),
    ).rejects.toThrow()
  })

  test('updates a deck name', async () => {
    const service = createDeckService()
    const deck = await service.create({
      name: 'Original',
      format: 'yu-gi-oh',
      cards: legalDeck(),
    })
    const updated = await service.update(deck.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
  })

  test('deletes a deck', async () => {
    const service = createDeckService()
    const deck = await service.create({
      name: 'Temp',
      format: 'yu-gi-oh',
      cards: legalDeck(),
    })
    await service.delete(deck.id)
    await expect(service.getById(deck.id)).rejects.toThrow()
  })

  test('clones a deck under a new id', async () => {
    const service = createDeckService()
    const deck = await service.create({
      name: 'Original',
      format: 'yu-gi-oh',
      cards: legalDeck(),
    })
    const clone = await service.clone(deck.id)
    expect(clone.id).not.toBe(deck.id)
    expect(clone.name).toContain('Copy')
    expect(clone.stats.mainCount).toBe(deck.stats.mainCount)
  })

  test('merges duplicate entries for the same card and section', async () => {
    const service = createDeckService()
    const cards = legalDeck()
    // The last entry holds only 1 copy, so it has room for another without
    // breaching the 3-copy limit. Two entries for it must merge into one.
    const lastEntry = cards[cards.length - 1]!
    expect(lastEntry.quantity).toBeLessThan(3)
    cards.push({ cardId: lastEntry.cardId, quantity: 1, section: 'main' })

    const deck = await service.create({
      name: 'Merge Test',
      format: 'yu-gi-oh',
      cards,
    })
    const entries = deck.cards.filter((entry) => entry.cardId === lastEntry.cardId)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.quantity).toBe(2)
  })
})
