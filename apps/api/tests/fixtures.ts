import { describe, expect, test } from 'bun:test'
import type { Card } from '@dueldex/shared'

/**
 * Test fixtures. Hand-built domain cards so domain tests never touch the network.
 */

export function makeCard(overrides: Partial<Card> & { id: number; name: string }): Card {
  return {
    type: 'Effect Monster',
    frameType: 'effect',
    desc: '',
    cardImages: [{ imageUrl: 'https://example.test/a.jpg', imageUrlSmall: 'https://example.test/s.jpg' }],
    ...overrides,
  }
}

export const darkMagician = makeCard({
  id: 46986414,
  name: 'Dark Magician',
  type: 'Normal Monster',
  frameType: 'normal',
  desc: 'The ultimate wizard in terms of attack and defense.',
  race: 'Spellcaster',
  attribute: 'DARK',
  archetype: 'Dark Magician',
  level: 7,
  atk: 2500,
  def: 2100,
})

export const magiciansRod = makeCard({
  id: 67227834,
  name: "Magician's Rod",
  race: 'Spellcaster',
  attribute: 'DARK',
  archetype: 'Dark Magician',
  level: 4,
  atk: 1600,
  def: 100,
  desc: 'When this card is Normal Summoned: You can add 1 Spell/Trap that specifically lists "Dark Magician" in its text from your Deck to your hand.',
})

export const genericTrap = makeCard({
  id: 4206964,
  name: 'Generic Counter',
  type: 'Trap Card',
  frameType: 'trap',
  race: 'Normal',
  desc: 'Negate the activation and destroy that card.',
})

export const genericSpell = makeCard({
  id: 1010101,
  name: 'Generic Draw',
  type: 'Spell Card',
  frameType: 'spell',
  race: 'Normal',
  desc: 'Draw 2 cards.',
})

export const fusionMonster = makeCard({
  id: 2020202,
  name: 'Dark Paladin',
  type: 'Fusion Monster',
  frameType: 'fusion',
  race: 'Spellcaster',
  attribute: 'DARK',
  archetype: 'Dark Magician',
  level: 8,
  atk: 2900,
  def: 2400,
  desc: '"Dark Magician" + "Buster Blader"',
})

// Sanity check so this fixture module is a valid test file for the runner.
describe('fixtures', () => {
  test('dark magician fixture is well formed', () => {
    expect(darkMagician.id).toBe(46986414)
    expect(darkMagician.archetype).toBe('Dark Magician')
  })
})
