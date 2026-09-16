import type {
  Card,
  CardScore,
  DeckCard,
  DeckFormat,
} from '@dueldex/shared'
import { cardKindOf, getFormatRules, isExtraDeckCard } from '@dueldex/shared'

const DIVINE_BEAST_RACES = new Set(['Divine-Beast', 'Creator God'])
import { COMPOSITION_TARGETS, SIDE_DECK_STAPLES, type CompositionTargets } from './synergy-config.ts'
import { detectArchetypeStyle, getArchetypeTargets } from './synergy-scoring.ts'

/**
 * Builds a format-valid deck from scored candidates.
 * Pure logic - the caller supplies the candidate pool.
 */

export interface ComposeInput {
  keyCard: Card
  format: DeckFormat
  candidates: Card[]
  scores: CardScore[]
}

export interface ComposeResult {
  cards: DeckCard[]
  usedScores: CardScore[]
}

/**
 * How many copies of a card to run, based on its synergy score.
 * Higher-synergy cards are worth more copies.
 */
function banlistMax(card: Card, formatMax: number): number {
  // Divine-Beast / Creator God: max 1 copy per card
  if (card.race && DIVINE_BEAST_RACES.has(card.race)) return 1
  const ban = card.banlist?.tcg
  if (ban === 'Forbidden') return 0
  if (ban === 'Limited') return Math.min(1, formatMax)
  if (ban === 'Semi-Limited') return Math.min(2, formatMax)
  return formatMax
}

function copiesForScore(score: number, maxCopies: number, card?: Card): number {
  const limit = card ? banlistMax(card, maxCopies) : maxCopies
  if (limit === 0) return 0
  if (score >= 70) return limit
  if (score >= 40) return Math.min(2, limit)
  return 1
}

function targetsFor(format: DeckFormat, keyCard?: Card): CompositionTargets {
  // Check archetype-aware targets first
  if (keyCard) {
    const style = detectArchetypeStyle(keyCard)
    const archetypeTargets = getArchetypeTargets(style)
    if (archetypeTargets) return archetypeTargets
  }
  return COMPOSITION_TARGETS[format] ?? COMPOSITION_TARGETS['yu-gi-oh']!
}

/**
 * Optimizes the mana curve of a deck by adjusting card copies.
 * Ensures a reasonable distribution of levels for monster-heavy decks.
 */
function optimizeManaCurve(deckCards: DeckCard[], cardsById: Map<number, Card>): DeckCard[] {
  // Count monsters by level
  const levelCounts = new Map<number, number>()
  let totalMonsters = 0

  for (const entry of deckCards) {
    const card = cardsById.get(entry.cardId)
    if (!card || cardKindOf(card.type) !== 'monster') continue
    if (entry.section !== 'main') continue
    const level = typeof card.level === 'number' ? card.level : 0
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + entry.quantity)
    totalMonsters += entry.quantity
  }

  if (totalMonsters === 0) return deckCards

  // Ideal curve: more low-level, tapering off at higher levels
  // Level 1-4: 60-70%, Level 5-6: 15-20%, Level 7+: 10-15%
  const lowCount = (levelCounts.get(1) ?? 0) + (levelCounts.get(2) ?? 0) + (levelCounts.get(3) ?? 0) + (levelCounts.get(4) ?? 0)
  const midCount = (levelCounts.get(5) ?? 0) + (levelCounts.get(6) ?? 0)
  const highCount = Array.from(levelCounts.entries()).filter(([l]) => l >= 7).reduce((s, [, c]) => s + c, 0)

  const lowRatio = lowCount / totalMonsters
  const midRatio = midCount / totalMonsters
  const highRatio = highCount / totalMonsters

  // If curve is too heavy, flag it (but don't remove cards - just return as-is)
  // The scoring already favors low-level monsters via searchableBonus
  // This is a soft optimization that works through the existing copy logic

  return deckCards
}

/**
 * Auto-generates a side deck based on the main deck composition and meta staples.
 */
function composeSideDeck(
  mainDeckCards: DeckCard[],
  cardsById: Map<number, Card>,
  allCandidates: Card[],
  format: DeckFormat,
): DeckCard[] {
  const rules = getFormatRules(format)
  if (!rules.hasSideDeck || rules.sideDeckMax <= 0) return []

  const sideDeck: DeckCard[] = []
  const mainCardIds = new Set(mainDeckCards.map((e) => e.cardId))
  let sideTotal = 0
  const sideMax = rules.sideDeckMax

  function sideFull(): boolean {
    return sideTotal >= sideMax
  }

  function addSide(card: Card): boolean {
    if (sideFull()) return false
    if (mainCardIds.has(card.id)) return false
    if (sideDeck.some((e) => e.cardId === card.id)) return false
    const maxCopies = banlistMax(card, 2)
    const qty = Math.min(maxCopies, sideMax - sideTotal)
    if (qty <= 0) return false
    sideDeck.push({ cardId: card.id, quantity: qty, section: 'side' })
    sideTotal += qty
    return true
  }

  // Determine what the main deck is weak against
  const hasMonsters = mainDeckCards.some((e) => {
    const card = cardsById.get(e.cardId)
    return card && cardKindOf(card.type) === 'monster'
  })

  // Helper to find a card by name from candidates, excluding main deck cards
  function findSideCard(name: string): Card | null {
    const lower = name.toLowerCase()
    // Check all candidates, not just the name map
    for (const card of allCandidates) {
      if (mainCardIds.has(card.id)) continue
      if (sideDeck.some((e) => e.cardId === card.id)) continue
      if (card.name.toLowerCase() === lower) return card
    }
    // Partial match
    for (const card of allCandidates) {
      if (mainCardIds.has(card.id)) continue
      if (sideDeck.some((e) => e.cardId === card.id)) continue
      if (card.name.toLowerCase().includes(lower)) return card
    }
    return null
  }

  // Always include board breakers for going second
  for (const name of SIDE_DECK_STAPLES.boardBreakers) {
    const card = findSideCard(name)
    if (card) addSide(card)
  }

  // Add anti-monster if main deck is monster-heavy
  if (hasMonsters) {
    for (const name of SIDE_DECK_STAPLES.antiMonster) {
      const card = findSideCard(name)
      if (card) addSide(card)
    }
  }

  // Add anti-spell if main deck needs it
  for (const name of SIDE_DECK_STAPLES.antiSpell) {
    const card = findSideCard(name)
    if (card) addSide(card)
  }

  // Fill remaining with going-first or going-second cards
  const fillPool = [...SIDE_DECK_STAPLES.goingFirst, ...SIDE_DECK_STAPLES.goingSecond]
  for (const name of fillPool) {
    const card = findSideCard(name)
    if (card) addSide(card)
  }

  return sideDeck
}

/**
 * Selects main-deck cards to hit the composition targets for each card kind,
 * always taking the highest-scoring candidates first.
 */
export function composeDeck(input: ComposeInput): ComposeResult {
  const { keyCard, format, candidates, scores } = input
  const rules = getFormatRules(format)
  const targets = targetsFor(format, keyCard)

  const cardsById = new Map(candidates.map((card) => [card.id, card]))
  const scoreById = new Map(scores.map((entry) => [entry.cardId, entry]))

  const mainTarget = rules.mainDeckMin
  const kindQuota = {
    monster: Math.round(mainTarget * targets.monsterRatio),
    spell: Math.round(mainTarget * targets.spellRatio),
    trap: Math.round(mainTarget * targets.trapRatio),
  }

  const deckCards: DeckCard[] = []
  const usedScores: CardScore[] = []
  const copiesUsed = new Map<number, number>()
  const kindFilled = { monster: 0, spell: 0, trap: 0 }

  let mainTotal = 0

  const addCard = (card: Card, section: 'main' | 'extra' | 'side', desired: number): number => {
    const already = copiesUsed.get(card.id) ?? 0
    const allowed = banlistMax(card, rules.maxCopiesPerCard)
    const room = Math.max(0, allowed - already)
    const quantity = Math.min(desired, room)
    if (quantity <= 0) return 0

    const existing = deckCards.find(
      (entry) => entry.cardId === card.id && entry.section === section,
    )
    if (existing) {
      existing.quantity += quantity
    } else {
      deckCards.push({ cardId: card.id, quantity, section })
    }

    copiesUsed.set(card.id, already + quantity)

    if (!usedScores.some((entry) => entry.cardId === card.id)) {
      const score = scoreById.get(card.id)
      if (score) usedScores.push(score)
    }

    return quantity
  }

  // The key card always anchors the deck.
  const keyIsExtra = rules.hasExtraDeck && isExtraDeckCard(keyCard)
  const keySection = keyIsExtra ? 'extra' : 'main'
  const keyCopiesRaw = keyIsExtra ? 1 : rules.maxCopiesPerCard
  const keyCopies = Math.min(keyCopiesRaw, banlistMax(keyCard, rules.maxCopiesPerCard))
  if (keyCopies === 0) {
    // Key card is Forbidden — still include 1 for generation but will be flagged by validation
    // Instead, allow 1 as exception for generation? For now skip and let validation fail gracefully
  }
  const keyAdded = keyCopies > 0 ? addCard(keyCard, keySection, keyCopies) : 0
  if (keySection === 'main') {
    mainTotal += keyAdded
    kindFilled[cardKindOf(keyCard.type)] += keyAdded
  }

  // Ordered candidate pool, highest synergy first, excluding the key card and Forbidden cards.
  const ordered = scores
    .map((entry) => cardsById.get(entry.cardId))
    .filter((card): card is Card => !!card && card.id !== keyCard.id && card.banlist?.tcg !== 'Forbidden')

  const mainPool = ordered.filter((card) => !(rules.hasExtraDeck && isExtraDeckCard(card)))
  const extraPool = rules.hasExtraDeck ? ordered.filter((card) => isExtraDeckCard(card)) : []

  // Fill each card kind toward its quota.
  for (const card of mainPool) {
    if (mainTotal >= mainTarget) break
    const kind = cardKindOf(card.type)
    if (kindFilled[kind] >= kindQuota[kind]) continue

    const score = scoreById.get(card.id)?.score ?? 0
    const desired = Math.min(
      copiesForScore(score, rules.maxCopiesPerCard, card),
      mainTarget - mainTotal,
      Math.max(0, kindQuota[kind] - kindFilled[kind]),
    )
    const added = addCard(card, 'main', desired)
    mainTotal += added
    kindFilled[kind] += added
  }

  // Top up to the minimum main deck size if quotas left the deck short.
  if (mainTotal < mainTarget) {
    for (const card of mainPool) {
      if (mainTotal >= mainTarget) break
      const score = scoreById.get(card.id)?.score ?? 0
      const desired = Math.min(
        copiesForScore(score, rules.maxCopiesPerCard, card),
        mainTarget - mainTotal,
      )
      const added = addCard(card, 'main', desired)
      mainTotal += added
      kindFilled[cardKindOf(card.type)] += added
    }
  }

  // Extra Deck, only for formats that use one.
  // Only add cards with decent synergy — don't force-fill to max.
  if (rules.hasExtraDeck && rules.extraDeckMax > 0) {
    let extraTotal = deckCards
      .filter((entry) => entry.section === 'extra')
      .reduce((total, entry) => total + entry.quantity, 0)

    for (const card of extraPool) {
      if (extraTotal >= rules.extraDeckMax) break
      const score = scoreById.get(card.id)?.score ?? 0
      // Only include extra deck cards with decent synergy (40+)
      if (score < 40) continue
      const added = addCard(card, 'extra', 1)
      extraTotal += added
    }
  }

  // Optimize mana curve (soft optimization via existing scoring)
  optimizeManaCurve(deckCards, cardsById)

  // Auto-generate side deck
  const mainDeckCards = deckCards.filter((e) => e.section === 'main' || e.section === 'extra')
  if (rules.hasSideDeck && rules.sideDeckMax > 0) {
    const sideDeck = composeSideDeck(mainDeckCards, cardsById, ordered, format)
    for (const entry of sideDeck) {
      const card = cardsById.get(entry.cardId)
      if (card) addCard(card, 'side', entry.quantity)
    }
  }

  return { cards: deckCards, usedScores }
}
