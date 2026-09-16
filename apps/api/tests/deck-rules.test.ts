import { describe, expect, test } from 'bun:test'
import type { Card, DeckCard } from '@dueldex/shared'
import { getFormatRules } from '@dueldex/shared'
import {
  addCardToDeck,
  computeDeckStats,
  countCopies,
  countSection,
  removeCardFromDeck,
  sectionForCard,
  setCardQuantity,
  validateDeck,
} from '../src/domain/deck/deck-rules.ts'
import {
  darkMagician,
  fusionMonster,
  genericSpell,
  genericTrap,
  magiciansRod,
} from './fixtures.ts'

function cardMap(...cards: Card[]): Map<number, Card> {
  return new Map(cards.map((card) => [card.id, card]))
}

/**
 * Builds a legal main deck by repeating filler cards up to the target size.
 */
function fillMainDeck(count: number): DeckCard[] {
  const cards: DeckCard[] = []
  let remaining = count
  let id = 900000
  while (remaining > 0) {
    const quantity = Math.min(3, remaining)
    cards.push({ cardId: id, quantity, section: 'main' })
    remaining -= quantity
    id += 1
  }
  return cards
}

function fillerCards(cards: DeckCard[]): Card[] {
  return cards.map((entry) => ({
    id: entry.cardId,
    name: `Filler ${entry.cardId}`,
    type: 'Effect Monster',
    frameType: 'effect',
    desc: '',
    cardImages: [{ imageUrl: 'x', imageUrlSmall: 'x' }],
  }))
}

describe('deck section placement', () => {
  test('extra deck monsters go to the extra deck in Yu-Gi-Oh', () => {
    expect(sectionForCard(fusionMonster, 'yu-gi-oh')).toBe('extra')
  })

  test('main deck monsters go to the main deck', () => {
    expect(sectionForCard(darkMagician, 'yu-gi-oh')).toBe('main')
  })

  test('Rush has no extra deck so fusion monsters fall back to main', () => {
    expect(sectionForCard(fusionMonster, 'rush')).toBe('main')
  })
})

describe('adding and removing cards', () => {
  test('adds a card and merges duplicates into one entry', () => {
    let cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 1)
    cards = addCardToDeck(cards, darkMagician, 'yu-gi-oh', 1)
    expect(cards).toHaveLength(1)
    expect(countCopies(cards, darkMagician.id)).toBe(2)
  })

  test('clamps additions to the format copy limit', () => {
    const cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 10)
    expect(countCopies(cards, darkMagician.id)).toBe(3)
  })

  test('does not exceed the limit across repeated adds', () => {
    let cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 3)
    cards = addCardToDeck(cards, darkMagician, 'yu-gi-oh', 2)
    expect(countCopies(cards, darkMagician.id)).toBe(3)
  })

  test('removes a card entirely', () => {
    const cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 2)
    expect(removeCardFromDeck(cards, darkMagician.id)).toHaveLength(0)
  })

  test('setting quantity to zero removes the card', () => {
    const cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 3)
    const updated = setCardQuantity(cards, darkMagician.id, 'main', 0, 'yu-gi-oh')
    expect(updated).toHaveLength(0)
  })

  test('setting quantity caps at the copy limit', () => {
    const cards = addCardToDeck([], darkMagician, 'yu-gi-oh', 1)
    const updated = setCardQuantity(cards, darkMagician.id, 'main', 7, 'yu-gi-oh')
    expect(countCopies(updated, darkMagician.id)).toBe(3)
  })
})

describe('deck validation - Yu-Gi-Oh', () => {
  test('accepts a legal 40 card deck', () => {
    const cards = fillMainDeck(40)
    const result = validateDeck({ format: 'yu-gi-oh', cards }, cardMap(...fillerCards(cards)))
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  test('rejects a deck below the minimum size', () => {
    const cards = fillMainDeck(39)
    const result = validateDeck({ format: 'yu-gi-oh', cards }, cardMap(...fillerCards(cards)))
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'MAIN_DECK_TOO_SMALL')).toBe(true)
  })

  test('rejects a deck above the maximum size', () => {
    const cards = fillMainDeck(63)
    const result = validateDeck({ format: 'yu-gi-oh', cards }, cardMap(...fillerCards(cards)))
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'MAIN_DECK_TOO_LARGE')).toBe(true)
  })

  test('rejects more copies than the format allows', () => {
    const cards = fillMainDeck(37)
    cards.push({ cardId: darkMagician.id, quantity: 3, section: 'main' })
    cards.push({ cardId: darkMagician.id, quantity: 1, section: 'side' })
    const result = validateDeck(
      { format: 'yu-gi-oh', cards },
      cardMap(...fillerCards(cards), darkMagician),
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'COPY_LIMIT_EXCEEDED')).toBe(true)
  })

  test('rejects an oversized extra deck', () => {
    const cards = fillMainDeck(40)
    cards.push({ cardId: fusionMonster.id, quantity: 3, section: 'extra' })
    for (let index = 0; index < 5; index += 1) {
      cards.push({ cardId: 800000 + index, quantity: 3, section: 'extra' })
    }
    const extras = cards
      .filter((entry) => entry.section === 'extra')
      .map((entry) => ({ ...fusionMonster, id: entry.cardId }))
    const result = validateDeck(
      { format: 'yu-gi-oh', cards },
      cardMap(...fillerCards(cards.filter((c) => c.section === 'main')), ...extras),
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'EXTRA_DECK_TOO_LARGE')).toBe(true)
  })

  test('rejects an extra deck monster placed in the main deck', () => {
    const cards = fillMainDeck(37)
    cards.push({ cardId: fusionMonster.id, quantity: 3, section: 'main' })
    const result = validateDeck(
      { format: 'yu-gi-oh', cards },
      cardMap(...fillerCards(cards), fusionMonster),
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'CARD_BELONGS_IN_EXTRA_DECK')).toBe(true)
  })

  test('rejects non-positive quantities', () => {
    const cards = fillMainDeck(40)
    cards.push({ cardId: darkMagician.id, quantity: 0, section: 'main' })
    const result = validateDeck(
      { format: 'yu-gi-oh', cards },
      cardMap(...fillerCards(cards), darkMagician),
    )
    expect(result.issues.some((issue) => issue.code === 'INVALID_QUANTITY')).toBe(true)
  })
})

describe('deck validation - Rush Duel', () => {
  test('accepts a legal Rush deck', () => {
    const cards = fillMainDeck(40)
    const result = validateDeck({ format: 'rush', cards }, cardMap(...fillerCards(cards)))
    expect(result.valid).toBe(true)
  })

  test('rejects any extra deck cards', () => {
    const cards = fillMainDeck(40)
    cards.push({ cardId: fusionMonster.id, quantity: 1, section: 'extra' })
    const result = validateDeck(
      { format: 'rush', cards },
      cardMap(...fillerCards(cards), fusionMonster),
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'EXTRA_DECK_NOT_ALLOWED')).toBe(true)
  })

  test('rejects any side deck cards', () => {
    const cards = fillMainDeck(40)
    cards.push({ cardId: darkMagician.id, quantity: 1, section: 'side' })
    const result = validateDeck(
      { format: 'rush', cards },
      cardMap(...fillerCards(cards), darkMagician),
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'SIDE_DECK_NOT_ALLOWED')).toBe(true)
  })

  test('rush rules differ from yu-gi-oh rules', () => {
    const ygo = getFormatRules('yu-gi-oh')
    const rush = getFormatRules('rush')
    expect(ygo.hasExtraDeck).toBe(true)
    expect(rush.hasExtraDeck).toBe(false)
    expect(rush.extraDeckMax).toBe(0)
  })
})

describe('deck statistics', () => {
  test('counts sections and card kinds', () => {
    const cards: DeckCard[] = [
      { cardId: darkMagician.id, quantity: 3, section: 'main' },
      { cardId: magiciansRod.id, quantity: 2, section: 'main' },
      { cardId: genericSpell.id, quantity: 2, section: 'main' },
      { cardId: genericTrap.id, quantity: 1, section: 'main' },
      { cardId: fusionMonster.id, quantity: 1, section: 'extra' },
    ]
    const stats = computeDeckStats(
      cards,
      cardMap(darkMagician, magiciansRod, genericSpell, genericTrap, fusionMonster),
    )
    expect(stats.mainCount).toBe(8)
    expect(stats.extraCount).toBe(1)
    expect(stats.monsterCount).toBe(5)
    expect(stats.spellCount).toBe(2)
    expect(stats.trapCount).toBe(1)
  })

  test('counts a single section correctly', () => {
    const cards: DeckCard[] = [
      { cardId: 1, quantity: 3, section: 'main' },
      { cardId: 2, quantity: 2, section: 'side' },
    ]
    expect(countSection(cards, 'main')).toBe(3)
    expect(countSection(cards, 'side')).toBe(2)
  })
})
