import { describe, expect, test } from 'bun:test'
import { scoreCard, scoreCards } from '../src/domain/deck/synergy-scoring.ts'
import { DEFAULT_SYNERGY_WEIGHTS } from '../src/domain/deck/synergy-config.ts'
import { darkMagician, genericSpell, magiciansRod, makeCard } from './fixtures.ts'

describe('synergy scoring', () => {
  test('archetype match contributes its configured weight', () => {
    const result = scoreCard(magiciansRod, { keyCard: darkMagician })
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SYNERGY_WEIGHTS.archetypeMatch)
    expect(result.reasons).toContain('Same archetype (Dark Magician)')
  })

  test('explicit key card reference is detected and explained', () => {
    const result = scoreCard(magiciansRod, { keyCard: darkMagician })
    expect(result.reasons).toContain('Directly references Dark Magician')
  })

  test('an unrelated card scores far lower than archetype support', () => {
    const related = scoreCard(magiciansRod, { keyCard: darkMagician })
    const unrelated = scoreCard(genericSpell, { keyCard: darkMagician })
    expect(related.score).toBeGreaterThan(unrelated.score)
  })

  test('every scored card explains itself', () => {
    const result = scoreCard(magiciansRod, { keyCard: darkMagician })
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  test('the key card does not self-reference', () => {
    const result = scoreCard(darkMagician, { keyCard: darkMagician })
    expect(result.reasons).not.toContain('Directly references Dark Magician')
  })

  test('same attribute and race award their weights', () => {
    const sameAttr = makeCard({
      id: 5150,
      name: 'Unrelated Spellcaster',
      race: 'Spellcaster',
      attribute: 'DARK',
      level: 4,
      desc: 'No synergy text.',
    })
    const result = scoreCard(sameAttr, { keyCard: darkMagician })
    expect(result.reasons).toContain('Same attribute (DARK)')
    expect(result.reasons).toContain('Same type (Spellcaster)')
  })

  test('results are sorted by descending score', () => {
    const scores = scoreCards([genericSpell, magiciansRod, darkMagician], {
      keyCard: darkMagician,
    })
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index - 1]!.score).toBeGreaterThanOrEqual(scores[index]!.score)
    }
  })

  test('scoring is deterministic across runs', () => {
    const first = scoreCards([magiciansRod, genericSpell], { keyCard: darkMagician })
    const second = scoreCards([magiciansRod, genericSpell], { keyCard: darkMagician })
    expect(first).toEqual(second)
  })

  test('a card naming the archetype without the tag still scores', () => {
    const untagged = makeCard({
      id: 777,
      name: 'Support Spell',
      type: 'Spell Card',
      frameType: 'spell',
      desc: 'Target 1 "Dark Magician" you control; it gains 500 ATK.',
    })
    const result = scoreCard(untagged, { keyCard: darkMagician })
    expect(result.score).toBeGreaterThan(0)
    expect(result.reasons.some((reason) => reason.includes('Dark Magician'))).toBe(true)
  })

  test('weights are configurable rather than hardcoded', () => {
    const custom = { ...DEFAULT_SYNERGY_WEIGHTS, archetypeMatch: 1000 }
    const result = scoreCard(magiciansRod, { keyCard: darkMagician, weights: custom })
    expect(result.score).toBeGreaterThan(1000)
  })
})
