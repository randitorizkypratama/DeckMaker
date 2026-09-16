import { describe, expect, test } from 'bun:test'
import type {
  Card,
  CardQuery,
  DeckFormat,
  FilterMetadata,
  Paginated,
} from '@dueldex/shared'
import { buildPagination, getFormatRules } from '@dueldex/shared'
import type { CardRepository } from '../src/domain/card/CardRepository.ts'
import { DeckGeneratorService } from '../src/application/decks/DeckGeneratorService.ts'
import { DeckService } from '../src/application/decks/DeckService.ts'
import { InMemoryDeckRepository } from '../src/infrastructure/repositories/InMemoryDeckRepository.ts'
import { darkMagician, fusionMonster, magiciansRod, makeCard } from './fixtures.ts'

/**
 * Offline card repository. Deck generation is deterministic and must be
 * testable without touching YGOPRODeck.
 */
class FakeCardRepository implements CardRepository {
  constructor(private readonly cards: Card[]) {}

  async search(query: CardQuery): Promise<Paginated<Card>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 24
    const start = (page - 1) * pageSize
    return {
      items: this.cards.slice(start, start + pageSize),
      pagination: buildPagination(page, pageSize, this.cards.length),
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
    return this.cards.filter(
      (card) =>
        card.name.toLowerCase().includes(needle) ||
        card.desc.toLowerCase().includes(needle),
    )
  }

  async findBannedCards(): Promise<Card[]> {
    return this.cards.filter((card) => card.banlist?.tcg)
  }

  async getFilterMetadata(): Promise<FilterMetadata> {
    return { types: [], attributes: [], races: [], archetypes: [], levels: [] }
  }

  async findFormatPool(_format: DeckFormat, limit = 400): Promise<Card[]> {
    return this.cards.slice(0, limit)
  }

  async findStaples(_format: DeckFormat, limit = 120): Promise<Card[]> {
    return this.cards.slice(0, limit)
  }
}

/**
 * Builds a pool large enough to fill a 40 card main deck plus an extra deck.
 */
function buildPool(): Card[] {
  const pool: Card[] = [darkMagician, magiciansRod, fusionMonster]

  for (let index = 0; index < 40; index += 1) {
    pool.push(
      makeCard({
        id: 100000 + index,
        name: `Filler Monster ${index}`,
        race: 'Warrior',
        attribute: 'EARTH',
        level: 4,
        atk: 1500,
        def: 1200,
        desc: 'Draw 1 card.',
      }),
    )
  }
  for (let index = 0; index < 25; index += 1) {
    pool.push(
      makeCard({
        id: 200000 + index,
        name: `Filler Spell ${index}`,
        type: 'Spell Card',
        frameType: 'spell',
        race: 'Normal',
        desc: 'Draw 1 card.',
      }),
    )
  }
  for (let index = 0; index < 20; index += 1) {
    pool.push(
      makeCard({
        id: 300000 + index,
        name: `Filler Trap ${index}`,
        type: 'Trap Card',
        frameType: 'trap',
        race: 'Normal',
        desc: 'Negate the activation.',
      }),
    )
  }
  for (let index = 0; index < 20; index += 1) {
    pool.push(
      makeCard({
        id: 400000 + index,
        name: `Filler Fusion ${index}`,
        type: 'Fusion Monster',
        frameType: 'fusion',
        race: 'Spellcaster',
        attribute: 'DARK',
        level: 8,
        atk: 2500,
        desc: 'Fusion material rules.',
      }),
    )
  }
  return pool
}

function createGenerator() {
  const repository = new FakeCardRepository(buildPool())
  const deckRepository = new InMemoryDeckRepository()
  const deckService = new DeckService(deckRepository, repository)
  return new DeckGeneratorService(repository, deckService)
}

describe('deck generation - Yu-Gi-Oh', () => {
  test('always includes the key card', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    expect(deck.cards.some((entry) => entry.cardId === darkMagician.id)).toBe(true)
  })

  test('produces a deck that satisfies the minimum main deck size', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    const rules = getFormatRules('yu-gi-oh')
    expect(deck.stats.mainCount).toBeGreaterThanOrEqual(rules.mainDeckMin)
    expect(deck.stats.mainCount).toBeLessThanOrEqual(rules.mainDeckMax)
  })

  test('never exceeds the copy limit for any card', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    const rules = getFormatRules('yu-gi-oh')
    const totals = new Map<number, number>()
    for (const entry of deck.cards) {
      totals.set(entry.cardId, (totals.get(entry.cardId) ?? 0) + entry.quantity)
    }
    for (const total of totals.values()) {
      expect(total).toBeLessThanOrEqual(rules.maxCopiesPerCard)
    }
  })

  test('prioritizes archetype support over unrelated cards', async () => {
    const generator = createGenerator()
    const { deck, scores } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    expect(deck.cards.some((entry) => entry.cardId === magiciansRod.id)).toBe(true)
    const rodScore = scores.find((entry) => entry.cardId === magiciansRod.id)
    const fillerScore = scores.find((entry) => entry.cardId === 100000)
    expect(rodScore).toBeDefined()
    if (fillerScore) {
      expect(rodScore!.score).toBeGreaterThan(fillerScore.score)
    }
  })

  test('returns reasons explaining each recommendation', async () => {
    const generator = createGenerator()
    const { scores } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    expect(scores.length).toBeGreaterThan(0)
    const rodScore = scores.find((entry) => entry.cardId === magiciansRod.id)
    expect(rodScore!.reasons.length).toBeGreaterThan(0)
  })

  test('places extra deck monsters in the extra deck', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    const extras = deck.cards.filter((entry) => entry.section === 'extra')
    expect(extras.length).toBeGreaterThan(0)
    for (const entry of extras) {
      expect(entry.card.type.toLowerCase()).toContain('fusion')
    }
  })

  test('respects the extra deck maximum', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    expect(deck.stats.extraCount).toBeLessThanOrEqual(getFormatRules('yu-gi-oh').extraDeckMax)
  })

  test('names the deck after the key card by default', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    expect(deck.name).toBe('Dark Magician Deck')
  })

  test('rejects an unknown key card', async () => {
    const generator = createGenerator()
    await expect(
      generator.generate({ format: 'yu-gi-oh', keyCardId: 99999999 }),
    ).rejects.toThrow()
  })
})

describe('deck generation - Rush Duel', () => {
  test('never produces an extra deck', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'rush',
      keyCardId: darkMagician.id,
    })
    expect(deck.stats.extraCount).toBe(0)
    expect(deck.cards.every((entry) => entry.section !== 'extra')).toBe(true)
  })

  test('still meets the main deck minimum', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'rush',
      keyCardId: darkMagician.id,
    })
    expect(deck.stats.mainCount).toBeGreaterThanOrEqual(getFormatRules('rush').mainDeckMin)
  })

  test('rush composition differs from yu-gi-oh composition', async () => {
    const generator = createGenerator()
    const ygo = await generator.generate({ format: 'yu-gi-oh', keyCardId: darkMagician.id })
    const rush = await generator.generate({ format: 'rush', keyCardId: darkMagician.id })
    // Rush has no extra deck, so total deck size must differ.
    const ygoTotal = ygo.deck.stats.mainCount + ygo.deck.stats.extraCount
    const rushTotal = rush.deck.stats.mainCount + rush.deck.stats.extraCount
    expect(ygoTotal).not.toBe(rushTotal)
  })

  test('includes the key card in the main deck', async () => {
    const generator = createGenerator()
    const { deck } = await generator.generate({
      format: 'rush',
      keyCardId: darkMagician.id,
    })
    const key = deck.cards.find((entry) => entry.cardId === darkMagician.id)
    expect(key).toBeDefined()
    expect(key!.section).toBe('main')
  })
})

describe('generated deck persistence and sharing', () => {
  test('a generated deck returns valid data without persisting', async () => {
    const repository = new FakeCardRepository(buildPool())
    const deckRepository = new InMemoryDeckRepository()
    const deckService = new DeckService(deckRepository, repository)
    const generator = new DeckGeneratorService(repository, deckService)

    const { deck } = await generator.generate({
      format: 'yu-gi-oh',
      keyCardId: darkMagician.id,
    })
    // Deck is returned with valid data but not persisted
    expect(deck.id).toBeDefined()
    expect(deck.stats.mainCount).toBeGreaterThanOrEqual(40)
    expect(deck.cards.length).toBeGreaterThan(0)
  })

  test('share ids are short, opaque and unique', async () => {
    const repository = new FakeCardRepository(buildPool())
    const deckRepository = new InMemoryDeckRepository()
    const deckService = new DeckService(deckRepository, repository)
    const generator = new DeckGeneratorService(repository, deckService)

    const first = await generator.generate({ format: 'yu-gi-oh', keyCardId: darkMagician.id })
    const second = await generator.generate({ format: 'yu-gi-oh', keyCardId: darkMagician.id })

    expect(first.deck.id).not.toBe(second.deck.id)
    expect(first.deck.id).toHaveLength(10)
    // Not a raw numeric database id.
    expect(Number.isNaN(Number(first.deck.id))).toBe(true)
  })

  test('an invalid share id is reported as not found', async () => {
    const repository = new FakeCardRepository(buildPool())
    const deckService = new DeckService(new InMemoryDeckRepository(), repository)
    await expect(deckService.getById('doesnotexist')).rejects.toThrow()
  })
})
