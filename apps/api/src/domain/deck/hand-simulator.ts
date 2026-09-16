import type { Card, DeckCard } from '@dueldex/shared'
import { cardKindOf, type DeckSectionName } from '@dueldex/shared'

/**
 * Opening Hand Simulator — Monte Carlo simulation of opening draws.
 * Pure logic, no I/O.
 */

export interface HandSimResult {
  trials: number
  handSize: number
  deckSize: number
  /** Probability of seeing each card id in an opening hand */
  cardProbability: Record<number, { cardId: number; name: string; count: number; seen: number; pct: number }>
  /** Probability of opening with at least 1 monster */
  monsterPct: number
  /** Probability of opening with at least 1 spell */
  spellPct: number
  /** Probability of opening with at least 1 trap */
  trapPct: number
  /** Average hand ATK (monsters only) */
  avgHandAtk: number
  /** Probability of opening no monsters (brick rate) */
  brickRate: number
  /** Average unique archetypes in hand */
  avgArchetypes: number
  /** Key cards (id 4+) that appear at least once */
  keyCardPct: Record<number, number>
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = a[i]!
    a[i] = a[j]!
    a[j] = temp
  }
  return a
}

/**
 * Runs a Monte Carlo simulation of opening hands.
 */
export function simulateOpeningHand(
  cards: DeckCard[],
  cardsById: Map<number, Card>,
  opts?: { handSize?: number; trials?: number },
): HandSimResult {
  const handSize = opts?.handSize ?? 5
  const trials = opts?.trials ?? 1000

  // Build deck as flat array of card ids (respecting quantity)
  const mainCards = cards.filter(c => c.section === 'main')
  const deck: number[] = []
  for (const entry of mainCards) {
    for (let i = 0; i < entry.quantity; i++) {
      deck.push(entry.cardId)
    }
  }
  const deckSize = deck.length
  if (deckSize === 0 || handSize > deckSize) {
    return emptyResult(handSize, deckSize, trials)
  }

  // Track results
  const seenCount = new Map<number, number>()
  const cardNames = new Map<number, string>()
  let monsterHands = 0
  let spellHands = 0
  let trapHands = 0
  let totalAtk = 0
  let atkMonsters = 0
  let brickHands = 0
  let totalArchetypes = 0

  for (let t = 0; t < trials; t++) {
    const shuffled = shuffleArray(deck)
    const hand = shuffled.slice(0, handSize)
    const handSet = new Set(hand)
    const handCards = hand.map(id => cardsById.get(id)).filter((c): c is Card => !!c)

    for (const id of handSet) {
      seenCount.set(id, (seenCount.get(id) ?? 0) + 1)
      const card = cardsById.get(id)
      if (card) cardNames.set(id, card.name)
    }

    let hasMonster = false
    let hasSpell = false
    let hasTrap = false
    let handAtk = 0
    let handAtkCount = 0
    const archetypes = new Set<string>()

    for (const card of handCards) {
      const kind = cardKindOf(card.type)
      if (kind === 'monster') hasMonster = true
      else if (kind === 'spell') hasSpell = true
      else if (kind === 'trap') hasTrap = true

      if (typeof card.atk === 'number' && card.atk >= 0) {
        handAtk += card.atk
        handAtkCount++
      }

      if (card.archetype) archetypes.add(card.archetype)
    }

    if (hasMonster) monsterHands++
    if (hasSpell) spellHands++
    if (hasTrap) trapHands++
    if (!hasMonster) brickHands++
    totalAtk += handAtk
    atkMonsters += handAtkCount
    totalArchetypes += archetypes.size
  }

  // Build unique deck card entries (group duplicates for cardProbability)
  const uniqueInDeck = new Map<number, number>()
  for (const id of deck) {
    uniqueInDeck.set(id, (uniqueInDeck.get(id) ?? 0) + 1)
  }

  const cardProbability: HandSimResult['cardProbability'] = {}
  for (const [id, copies] of uniqueInDeck) {
    const seen = seenCount.get(id) ?? 0
    cardProbability[id] = {
      cardId: id,
      name: cardNames.get(id) ?? `Card ${id}`,
      count: copies,
      seen,
      pct: Math.round((seen / trials) * 10000) / 100,
    }
  }

  // Key cards with 4+ copies in deck
  const keyCardPct: Record<number, number> = {}
  for (const [id, copies] of uniqueInDeck) {
    if (copies >= 4) {
      keyCardPct[id] = Math.round(((seenCount.get(id) ?? 0) / trials) * 10000) / 100
    }
  }

  return {
    trials,
    handSize,
    deckSize,
    cardProbability,
    monsterPct: Math.round((monsterHands / trials) * 10000) / 100,
    spellPct: Math.round((spellHands / trials) * 10000) / 100,
    trapPct: Math.round((trapHands / trials) * 10000) / 100,
    avgHandAtk: atkMonsters > 0 ? Math.round(totalAtk / atkMonsters) : 0,
    brickRate: Math.round((brickHands / trials) * 10000) / 100,
    avgArchetypes: Math.round((totalArchetypes / trials) * 100) / 100,
    keyCardPct,
  }
}

function emptyResult(handSize: number, deckSize: number, trials: number): HandSimResult {
  return {
    trials,
    handSize,
    deckSize,
    cardProbability: {},
    monsterPct: 0,
    spellPct: 0,
    trapPct: 0,
    avgHandAtk: 0,
    brickRate: 100,
    avgArchetypes: 0,
    keyCardPct: {},
  }
}
