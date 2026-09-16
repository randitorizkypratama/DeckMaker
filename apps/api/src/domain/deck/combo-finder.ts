import type { Card, DeckCard, DeckSectionName } from '@dueldex/shared'
import { cardKindOf } from '@dueldex/shared'

/**
 * Combo Finder — finds synergy groups within a deck.
 * Pure logic, no I/O.
 */

export interface ComboCard {
  cardId: number
  name: string
  type: string
  race?: string
  archetype?: string
}

export interface Combo {
  cards: ComboCard[]
  type: 'search' | 'extender' | 'boss' | 'protection' | 'engine'
  reason: string
  score: number
}

/**
 * Patterns that indicate a card searches / fetches other cards.
 */
const SEARCH_PATTERNS = [
  /add .* from your (Deck|GY)/i,
  /add .* (card|monster|spell|trap) .* from your Deck/i,
  /send .* from your Deck to (the )?GY/i,
  /special summon .* from your Deck/i,
  /reveal .* in your hand.* add/i,
  /If this card is (Normal|Special) Summoned.* add/i,
]

/**
 * Patterns that indicate extension / revival / extra summon.
 */
const EXTENDER_PATTERNS = [
  /Special Summon .* from (your )?(hand|GY|Deck|Graveyard)/i,
  /If .* is (Normal|Special) Summoned.* Special Summon/i,
  /During your Main Phase.* Special Summon/i,
  /You can Normal Summon .* an additional time/i,
  /tribute .* to Special Summon/i,
]

/**
 * Patterns that indicate boss / payoff / win condition.
 */
const BOSS_PATTERNS = [
  /cannot be (destroyed|targeted)/i,
  /Once per turn.* (destroy|banish|negate)/i,
  /If this card is (Normal|Special) Summoned.* destroy/i,
  /When this card inflicts battle damage/i,
  /Unaffected by other card effects/i,
]

/**
 * Patterns that indicate protection.
 */
const PROTECTION_PATTERNS = [
  /cannot be (destroyed|targeted) by card effects/i,
  /If this card would be (destroyed|banished)/i,
  /When a card or effect is activated.* negate/i,
  /Quick Effect.* negate/i,
]

function textMatches(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

/**
 * Finds combos in a deck — groups of cards that work together.
 */
export function findCombos(
  cards: DeckCard[],
  cardsById: Map<number, Card>,
  opts?: { maxCombos?: number },
): Combo[] {
  const maxCombos = opts?.maxCombos ?? 10
  const combos: Combo[] = []
  const mainCards = cards
    .filter(e => e.section === 'main' || e.section === 'extra')
    .flatMap(e => {
      const card = cardsById.get(e.cardId)
      return card ? Array.from({ length: e.quantity }, () => card) : []
    })

  const archetypeGroups = new Map<string, Card[]>()
  for (const card of mainCards) {
    const arch = card.archetype ?? 'No Archetype'
    if (!archetypeGroups.has(arch)) archetypeGroups.set(arch, [])
    archetypeGroups.get(arch)!.push(card)
  }

  for (const [archetype, archCards] of archetypeGroups) {
    if (archetype === 'No Archetype' || archCards.length < 2) continue

    const searchers = archCards.filter(c => textMatches(c.desc ?? '', SEARCH_PATTERNS))
    const extenders = archCards.filter(c => textMatches(c.desc ?? '', EXTENDER_PATTERNS) && !searchers.includes(c))
    const bosses = archCards.filter(c => textMatches(c.desc ?? '', BOSS_PATTERNS) && !searchers.includes(c) && !extenders.includes(c))
    const protection = archCards.filter(c => textMatches(c.desc ?? '', PROTECTION_PATTERNS) && !searchers.includes(c) && !extenders.includes(c) && !bosses.includes(c))

    if (searchers.length > 0 && extenders.length > 0) {
      combos.push({
        cards: [...searchers.slice(0, 2), ...extenders.slice(0, 2)].filter((c): c is Card => !!c).map(toComboCard),
        type: 'search',
        reason: `${searchers[0]!.name} searches ${extenders[0]!.name} for consistent opening plays`,
        score: 80 + Math.min(searchers.length * 5, 20),
      })
    }

    if (extenders.length > 0 && bosses.length > 0) {
      combos.push({
        cards: [...extenders.slice(0, 2), ...bosses.slice(0, 2)].filter((c): c is Card => !!c).map(toComboCard),
        type: 'extender',
        reason: `${extenders[0]!.name} extends into ${bosses[0]!.name} board presence`,
        score: 75 + Math.min(extenders.length * 5, 15),
      })
    }

    if (bosses.length > 0 && protection.length > 0) {
      combos.push({
        cards: [...bosses.slice(0, 1), ...protection.slice(0, 2)].filter((c): c is Card => !!c).map(toComboCard),
        type: 'boss',
        reason: `${bosses[0]!.name} backed by ${protection[0]!.name} for resilience`,
        score: 70,
      })
    }
  }

  // Generic cross-archetype combos: searchers that fetch non-archetype cards
  const allSearchers = mainCards.filter(c => textMatches(c.desc ?? '', SEARCH_PATTERNS) && !c.archetype)
  if (allSearchers.length > 0) {
    const starter = allSearchers[0]!
    combos.push({
      cards: [starter].map(toComboCard),
      type: 'engine',
      reason: `${starter.name} is a generic searcher / engine piece`,
      score: 60,
    })
  }

  return combos.sort((a, b) => b.score - a.score).slice(0, maxCombos)
}

function toComboCard(card: Card): ComboCard {
  return { cardId: card.id, name: card.name, type: card.type, race: card.race, archetype: card.archetype }
}
