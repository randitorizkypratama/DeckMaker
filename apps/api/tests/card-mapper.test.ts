import { describe, expect, test } from 'bun:test'
import { mapCard, mapCards } from '../src/infrastructure/ygoprodeck/YgoProDeckMapper.ts'
import type { YgoCardResponse } from '../src/infrastructure/ygoprodeck/types.ts'

/**
 * Mapping tests use the real upstream payload shape (snake_case) to prove
 * external structures are normalized and never leak into the domain.
 */
const rawDarkMagician: YgoCardResponse = {
  id: 46986414,
  name: 'Dark Magician',
  type: 'Normal Monster',
  frameType: 'normal',
  desc: 'The ultimate wizard in terms of attack and defense.',
  race: 'Spellcaster',
  atk: 2500,
  def: 2100,
  level: 7,
  attribute: 'DARK',
  archetype: 'Dark Magician',
  card_images: [
    {
      id: 46986414,
      image_url: 'https://images.ygoprodeck.com/images/cards/46986414.jpg',
      image_url_small: 'https://images.ygoprodeck.com/images/cards_small/46986414.jpg',
      image_url_cropped: 'https://images.ygoprodeck.com/images/cards_cropped/46986414.jpg',
    },
  ],
}

describe('card mapping', () => {
  test('maps a full upstream card into the domain model', () => {
    const card = mapCard(rawDarkMagician)
    expect(card).not.toBeNull()
    expect(card!.id).toBe(46986414)
    expect(card!.name).toBe('Dark Magician')
    expect(card!.attribute).toBe('DARK')
    expect(card!.level).toBe(7)
    expect(card!.atk).toBe(2500)
    expect(card!.archetype).toBe('Dark Magician')
  })

  test('converts snake_case image fields to camelCase', () => {
    const card = mapCard(rawDarkMagician)
    expect(card!.cardImages[0]!.imageUrl).toContain('/cards/46986414.jpg')
    expect(card!.cardImages[0]!.imageUrlSmall).toContain('/cards_small/46986414.jpg')
    // The upstream cropped field is intentionally not part of the domain model.
    expect(Object.keys(card!.cardImages[0]!)).toEqual(['imageUrl', 'imageUrlSmall'])
  })

  test('rejects a card missing an id', () => {
    expect(mapCard({ name: 'Nameless', type: 'Spell Card' })).toBeNull()
  })

  test('rejects a card missing a name', () => {
    expect(mapCard({ id: 1, type: 'Spell Card' })).toBeNull()
  })

  test('rejects a card missing a type', () => {
    expect(mapCard({ id: 1, name: 'Mystery' })).toBeNull()
  })

  test('supplies a placeholder when images are absent', () => {
    const card = mapCard({ id: 5, name: 'No Art', type: 'Spell Card' })
    expect(card!.cardImages).toHaveLength(1)
    expect(card!.cardImages[0]!.imageUrl).toContain('http')
  })

  test('omits optional fields that upstream did not return', () => {
    const card = mapCard({ id: 7, name: 'Plain Spell', type: 'Spell Card' })
    expect(card!.atk).toBeUndefined()
    expect(card!.level).toBeUndefined()
    expect(card!.linkval).toBeUndefined()
  })

  test('maps link monster markers', () => {
    const card = mapCard({
      id: 8,
      name: 'Decode Talker',
      type: 'Link Monster',
      frameType: 'link',
      linkval: 3,
      linkmarkers: ['Top', 'Bottom-Left', 'Bottom-Right'],
    })
    expect(card!.linkval).toBe(3)
    expect(card!.linkmarkers).toEqual(['Top', 'Bottom-Left', 'Bottom-Right'])
  })

  test('skips malformed entries in a list instead of failing', () => {
    const cards = mapCards([rawDarkMagician, { name: 'broken' }, { id: 2 }])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.id).toBe(46986414)
  })

  test('maps an empty list to an empty array', () => {
    expect(mapCards([])).toEqual([])
  })
})
