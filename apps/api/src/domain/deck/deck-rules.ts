import type {
  Card,
  Deck,
  DeckCard,
  DeckFormat,
  DeckSectionName,
  DeckStats,
  DeckValidationIssue,
  DeckValidationResult,
} from '@dueldex/shared'
import { cardKindOf, getFormatRules, isExtraDeckCard } from '@dueldex/shared'

const DIVINE_BEAST_RACES = new Set(['Divine-Beast', 'Creator God'])

/**
 * Pure deck rules. No HTTP, no persistence, no external API.
 */

/**
 * Chooses the correct section for a card in a given format.
 * Rush Duel has no Extra Deck, so extra-deck monsters fall back to main.
 */
export function sectionForCard(card: Card, format: DeckFormat): DeckSectionName {
  const rules = getFormatRules(format)
  if (rules.hasExtraDeck && isExtraDeckCard(card)) return 'extra'
  return 'main'
}

export function countSection(cards: DeckCard[], section: DeckSectionName): number {
  return cards
    .filter((entry) => entry.section === section)
    .reduce((total, entry) => total + entry.quantity, 0)
}

/**
 * Total copies of a card across every section - the copy limit is deck-wide.
 */
export function countCopies(cards: DeckCard[], cardId: number): number {
  return cards
    .filter((entry) => entry.cardId === cardId)
    .reduce((total, entry) => total + entry.quantity, 0)
}

/**
 * Adds copies of a card, merging into an existing entry for the same
 * card/section pair and clamping to the format copy limit.
 */
export function addCardToDeck(
  cards: DeckCard[],
  card: Card,
  format: DeckFormat,
  quantity = 1,
  section?: DeckSectionName,
): DeckCard[] {
  const rules = getFormatRules(format)
  const target = section ?? sectionForCard(card, format)
  const alreadyPresent = countCopies(cards, card.id)
  const allowed = Math.max(0, rules.maxCopiesPerCard - alreadyPresent)
  const toAdd = Math.min(quantity, allowed)
  if (toAdd <= 0) return cards

  const existingIndex = cards.findIndex(
    (entry) => entry.cardId === card.id && entry.section === target,
  )

  if (existingIndex >= 0) {
    return cards.map((entry, index) =>
      index === existingIndex ? { ...entry, quantity: entry.quantity + toAdd } : entry,
    )
  }

  return [...cards, { cardId: card.id, quantity: toAdd, section: target }]
}

export function removeCardFromDeck(
  cards: DeckCard[],
  cardId: number,
  section?: DeckSectionName,
): DeckCard[] {
  return cards.filter(
    (entry) => !(entry.cardId === cardId && (section === undefined || entry.section === section)),
  )
}

/**
 * Sets an explicit quantity. A quantity of zero removes the entry.
 */
export function setCardQuantity(
  cards: DeckCard[],
  cardId: number,
  section: DeckSectionName,
  quantity: number,
  format: DeckFormat,
): DeckCard[] {
  const rules = getFormatRules(format)
  if (quantity <= 0) return removeCardFromDeck(cards, cardId, section)

  const otherSectionCopies = cards
    .filter((entry) => entry.cardId === cardId && entry.section !== section)
    .reduce((total, entry) => total + entry.quantity, 0)

  const capped = Math.min(quantity, Math.max(0, rules.maxCopiesPerCard - otherSectionCopies))
  if (capped <= 0) return removeCardFromDeck(cards, cardId, section)

  const exists = cards.some((entry) => entry.cardId === cardId && entry.section === section)
  if (!exists) {
    return [...cards, { cardId, quantity: capped, section }]
  }

  return cards.map((entry) =>
    entry.cardId === cardId && entry.section === section
      ? { ...entry, quantity: capped }
      : entry,
  )
}

/**
 * Validates a deck against its format rules.
 * Always run on the backend - client validation is never trusted.
 */
export function validateDeck(
  deck: Pick<Deck, 'format' | 'cards'>,
  cardsById: Map<number, Card>,
): DeckValidationResult {
  const rules = getFormatRules(deck.format)
  const issues: DeckValidationIssue[] = []

  const mainCount = countSection(deck.cards, 'main')
  const extraCount = countSection(deck.cards, 'extra')
  const sideCount = countSection(deck.cards, 'side')

  if (mainCount < rules.mainDeckMin) {
    issues.push({
      code: 'MAIN_DECK_TOO_SMALL',
      message: `Main Deck must contain at least ${rules.mainDeckMin} cards (currently ${mainCount}).`,
      section: 'main',
    })
  }

  if (mainCount > rules.mainDeckMax) {
    issues.push({
      code: 'MAIN_DECK_TOO_LARGE',
      message: `Main Deck must contain at most ${rules.mainDeckMax} cards (currently ${mainCount}).`,
      section: 'main',
    })
  }

  if (!rules.hasExtraDeck && extraCount > 0) {
    issues.push({
      code: 'EXTRA_DECK_NOT_ALLOWED',
      message: `${rules.label} does not use an Extra Deck.`,
      section: 'extra',
    })
  } else if (extraCount > rules.extraDeckMax) {
    issues.push({
      code: 'EXTRA_DECK_TOO_LARGE',
      message: `Extra Deck must contain at most ${rules.extraDeckMax} cards (currently ${extraCount}).`,
      section: 'extra',
    })
  }

  if (!rules.hasSideDeck && sideCount > 0) {
    issues.push({
      code: 'SIDE_DECK_NOT_ALLOWED',
      message: `${rules.label} does not use a Side Deck.`,
      section: 'side',
    })
  } else if (sideCount > rules.sideDeckMax) {
    issues.push({
      code: 'SIDE_DECK_TOO_LARGE',
      message: `Side Deck must contain at most ${rules.sideDeckMax} cards (currently ${sideCount}).`,
      section: 'side',
    })
  }

  for (const entry of deck.cards) {
    if (entry.quantity <= 0) {
      issues.push({
        code: 'INVALID_QUANTITY',
        message: `Card ${entry.cardId} has a non-positive quantity.`,
        cardId: entry.cardId,
      })
    }
  }

  const seen = new Set<number>()
  for (const entry of deck.cards) {
    if (seen.has(entry.cardId)) continue
    seen.add(entry.cardId)
    const copies = countCopies(deck.cards, entry.cardId)
    if (copies > rules.maxCopiesPerCard) {
      const card = cardsById.get(entry.cardId)
      issues.push({
        code: 'COPY_LIMIT_EXCEEDED',
        message: `${card?.name ?? `Card ${entry.cardId}`} appears ${copies} times; the limit is ${rules.maxCopiesPerCard}.`,
        cardId: entry.cardId,
      })
    }
    // Real banlist validation (TCG)
    const card = cardsById.get(entry.cardId)
    const ban = card?.banlist?.tcg
    if (ban) {
      const limit = ban === 'Forbidden' ? 0 : ban === 'Limited' ? 1 : ban === 'Semi-Limited' ? 2 : 3
      if (copies > limit) {
        const label = ban === 'Forbidden' ? 'Forbidden (0)' : ban === 'Limited' ? 'Limited to 1' : 'Semi-Limited to 2'
        issues.push({
          code: ban === 'Forbidden' ? 'BANNED' : ban === 'Limited' ? 'LIMITED' : 'SEMI_LIMITED',
          message: `${card?.name ?? `Card ${entry.cardId}`} is ${label} (has ${copies}).`,
          cardId: entry.cardId,
        })
      }
    }
    // Divine-Beast / Creator God: max 1 copy per card
    if (card?.race && DIVINE_BEAST_RACES.has(card.race) && copies > 1) {
      issues.push({
        code: 'DIVINE_BEAST_LIMIT',
        message: `${card.name ?? `Card ${entry.cardId}`} (${card.race}) is limited to 1 copy per card.`,
        cardId: entry.cardId,
      })
    }
  }

  // A card that belongs in the Extra Deck must not sit in the Main Deck.
  if (rules.hasExtraDeck) {
    for (const entry of deck.cards) {
      const card = cardsById.get(entry.cardId)
      if (!card) continue
      if (entry.section === 'main' && isExtraDeckCard(card)) {
        issues.push({
          code: 'CARD_BELONGS_IN_EXTRA_DECK',
          message: `${card.name} must be placed in the Extra Deck.`,
          section: 'main',
          cardId: card.id,
        })
      }
      if (entry.section === 'extra' && !isExtraDeckCard(card)) {
        issues.push({
          code: 'CARD_NOT_ALLOWED_IN_EXTRA_DECK',
          message: `${card.name} cannot be placed in the Extra Deck.`,
          section: 'extra',
          cardId: card.id,
        })
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

export function computeDeckStats(
  cards: DeckCard[],
  cardsById: Map<number, Card>,
): DeckStats {
  let monsterCount = 0
  let spellCount = 0
  let trapCount = 0
  const levelCurve: Record<string, number> = {}
  const atkHistogram: Record<string, number> = {}
  const archetypeBreakdown: Record<string, number> = {}
  let totalLevel = 0
  let levelCards = 0
  let totalAtk = 0
  let atkCards = 0

  for (const entry of cards) {
    const card = cardsById.get(entry.cardId)
    if (!card) continue

    // M/S/T breakdown: main deck only
    if (entry.section === 'main') {
      const kind = cardKindOf(card.type)
      if (kind === 'monster') monsterCount += entry.quantity
      else if (kind === 'spell') spellCount += entry.quantity
      else trapCount += entry.quantity
    }

    // Level curve (all sections)
    if (typeof card.level === 'number') {
      const key = String(card.level)
      levelCurve[key] = (levelCurve[key] ?? 0) + entry.quantity
      totalLevel += card.level * entry.quantity
      levelCards += entry.quantity
    } else {
      levelCurve['-'] = (levelCurve['-'] ?? 0) + entry.quantity
    }

    // ATK histogram buckets: 0-1000, 1000-2000, 2000-3000, 3000+
    if (typeof card.atk === 'number') {
      const bucket = card.atk < 1000 ? '0-1000' : card.atk < 2000 ? '1000-2000' : card.atk < 3000 ? '2000-3000' : '3000+'
      atkHistogram[bucket] = (atkHistogram[bucket] ?? 0) + entry.quantity
      totalAtk += card.atk * entry.quantity
      atkCards += entry.quantity
    }

    const arch = card.archetype ?? 'No Archetype'
    archetypeBreakdown[arch] = (archetypeBreakdown[arch] ?? 0) + entry.quantity
  }

  return {
    mainCount: countSection(cards, 'main'),
    extraCount: countSection(cards, 'extra'),
    sideCount: countSection(cards, 'side'),
    monsterCount,
    spellCount,
    trapCount,
    levelCurve,
    atkHistogram,
    archetypeBreakdown,
    avgLevel: levelCards > 0 ? Number((totalLevel / levelCards).toFixed(1)) : undefined,
    avgAtk: atkCards > 0 ? Math.round(totalAtk / atkCards) : undefined,
  }
}
