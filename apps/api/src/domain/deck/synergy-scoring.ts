import type { Card, CardScore } from '@dueldex/shared'
import { cardKindOf } from '@dueldex/shared'
import {
  ARCHETYPE_PROFILES,
  ARCHETYPE_STYLES,
  COMBO_PAIRS,
  DEFAULT_SYNERGY_WEIGHTS,
  EFFECT_KEYWORDS,
  GENERIC_UTILITY_PATTERNS,
  SUPPORT_PATTERNS,
  type SynergyWeights,
} from './synergy-config.ts'

/**
 * Rule-based synergy scoring. Pure and deterministic - no I/O, no randomness,
 * so the same inputs always produce the same recommendation.
 */

/**
 * Escapes a string for safe use inside a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detects whether `text` mentions the given name as a whole phrase.
 */
function mentions(text: string, name: string): boolean {
  if (!name) return false
  const pattern = new RegExp(`(^|[^\\w])${escapeRegExp(name)}([^\\w]|$)`, 'i')
  return pattern.test(text)
}

/**
 * Quoted archetype references in card text, e.g. "Dark Magician" cards.
 */
function mentionsArchetype(text: string, archetype: string): boolean {
  if (!archetype) return false
  return mentions(text, archetype) || text.toLowerCase().includes(archetype.toLowerCase())
}

/**
 * Checks if a card name is part of any known combo pair and returns the partner name.
 */
function findComboPartner(cardName: string): string | null {
  for (const [a, b] of COMBO_PAIRS) {
    if (a.toLowerCase() === cardName.toLowerCase()) return b
    if (b.toLowerCase() === cardName.toLowerCase()) return a
  }
  return null
}

/**
 * Counts how many effect keywords a card text matches.
 */
function countEffectKeywords(text: string): string[] {
  const matched: string[] = []
  for (const [key, pattern] of Object.entries(EFFECT_KEYWORDS)) {
    if (pattern.test(text)) matched.push(key)
  }
  return matched
}

/**
 * Detects the playstyle archetype for a key card based on its archetype name.
 */
export function detectArchetypeStyle(card: Card): 'aggro' | 'control' | 'combo' | 'stun' | null {
  if (card.archetype && ARCHETYPE_STYLES[card.archetype]) {
    return ARCHETYPE_STYLES[card.archetype] ?? null
  }
  // Heuristic: check card name against known patterns
  const name = card.name.toLowerCase()
  if (/stun|floodgate|Inspector Boarder/.test(name)) return 'stun'
  if (/control|Eldlich|Paleozoic/.test(name)) return 'control'
  if (/synchron|junk|combo|D\/D\/D/.test(name)) return 'combo'
  return null
}

/**
 * Returns the composition targets for a given archetype style.
 */
export function getArchetypeTargets(style: string | null): { monsterRatio: number; spellRatio: number; trapRatio: number } | null {
  if (style && ARCHETYPE_PROFILES[style]) {
    const profile = ARCHETYPE_PROFILES[style]
    return { monsterRatio: profile.monsterRatio, spellRatio: profile.spellRatio, trapRatio: profile.trapRatio }
  }
  return null
}

export interface ScoreContext {
  keyCard: Card
  weights?: SynergyWeights
}

/**
 * Scores a single candidate card's synergy with the key card and records
 * a human-readable reason for every contribution.
 */
export function scoreCard(candidate: Card, context: ScoreContext): CardScore {
  const weights = context.weights ?? DEFAULT_SYNERGY_WEIGHTS
  const { keyCard } = context
  const reasons: string[] = []
  let score = 0

  const candidateText = candidate.desc ?? ''
  const keyText = keyCard.desc ?? ''

  // Same archetype is the strongest signal of intended synergy.
  if (
    keyCard.archetype &&
    candidate.archetype &&
    candidate.archetype === keyCard.archetype
  ) {
    score += weights.archetypeMatch
    reasons.push(`Same archetype (${keyCard.archetype})`)
  }

  // The candidate explicitly names the key card.
  if (candidate.id !== keyCard.id && mentions(candidateText, keyCard.name)) {
    score += weights.explicitKeyCardReference
    reasons.push(`Directly references ${keyCard.name}`)
  }

  // The candidate references the key card's archetype in its text.
  if (
    keyCard.archetype &&
    candidate.archetype !== keyCard.archetype &&
    mentionsArchetype(candidateText, keyCard.archetype)
  ) {
    score += weights.archetypeReference
    reasons.push(`Mentions "${keyCard.archetype}" in its effect`)
  }

  // The key card itself names the candidate - a reciprocal support link.
  if (candidate.id !== keyCard.id && mentions(keyText, candidate.name)) {
    score += weights.supportRelationship
    reasons.push(`Named by ${keyCard.name}`)
  }

  // Support-shaped effects (search, revive, equip) that touch the strategy.
  const hasSupportPattern = SUPPORT_PATTERNS.some((pattern) => pattern.test(candidateText))
  if (
    hasSupportPattern &&
    keyCard.archetype &&
    mentionsArchetype(candidateText, keyCard.archetype)
  ) {
    score += weights.sameStrategy
    reasons.push('Supports the archetype strategy')
  }

  const candidateKind = cardKindOf(candidate.type)
  const keyKind = cardKindOf(keyCard.type)

  if (candidateKind === 'monster' && keyKind === 'monster') {
    if (candidate.attribute && candidate.attribute === keyCard.attribute) {
      score += weights.sameAttribute
      reasons.push(`Same attribute (${candidate.attribute})`)
    }

    if (candidate.race && candidate.race === keyCard.race) {
      score += weights.sameRaceOrType
      reasons.push(`Same type (${candidate.race})`)
    }

    // Low-level monsters are easier to deploy and support combos.
    if (typeof candidate.level === 'number' && candidate.level <= 4) {
      score += weights.searchableBonus
      reasons.push('Easily summoned (Level 4 or lower)')
    }
  }

  // Generic utility: draw, search, removal.
  if (GENERIC_UTILITY_PATTERNS.some((pattern) => pattern.test(candidateText))) {
    score += weights.genericUseful
    reasons.push('Generically useful effect')
  }

  // Combo pair detection
  const partner = findComboPartner(keyCard.name)
  if (partner && mentions(candidate.name, partner)) {
    score += weights.comboPair
    reasons.push(`Combo pair with ${keyCard.name}`)
  }
  // Reverse: check if candidate's partner is the key card
  const candidatePartner = findComboPartner(candidate.name)
  if (candidatePartner && mentions(keyCard.name, candidatePartner)) {
    score += weights.comboPair
    reasons.push(`Combo pair: ${candidate.name} + ${keyCard.name}`)
  }

  // Effect keyword synergy
  const candidateKeywords = countEffectKeywords(candidateText)
  const keyKeywords = countEffectKeywords(keyText)
  const sharedKeywords = candidateKeywords.filter((k) => keyKeywords.includes(k))
  if (sharedKeywords.length > 0) {
    score += weights.effectSynergy * sharedKeywords.length
    reasons.push(`Effect synergy: ${sharedKeywords.join(', ')}`)
  }

  // Archetype-based playstyle bonus
  const style = detectArchetypeStyle(keyCard)
  if (style === 'control') {
    if (EFFECT_KEYWORDS.negate.test(candidateText) || EFFECT_KEYWORDS.protectTarget.test(candidateText) || EFFECT_KEYWORDS.protectDestroy.test(candidateText)) {
      score += weights.controlBonus
      reasons.push('Control synergy (negate/protect)')
    }
  } else if (style === 'aggro') {
    if (EFFECT_KEYWORDS.destroy.test(candidateText) || EFFECT_KEYWORDS.burn.test(candidateText) || EFFECT_KEYWORDS.specialSummonDeck.test(candidateText)) {
      score += weights.aggroBonus
      reasons.push('Aggro synergy (destroy/burn/spam)')
    }
  }

  return { cardId: candidate.id, score, reasons }
}

/**
 * Scores many candidates and returns them sorted by descending score.
 * Ties break on card id so ordering stays stable across runs.
 */
export function scoreCards(candidates: Card[], context: ScoreContext): CardScore[] {
  return candidates
    .map((candidate) => scoreCard(candidate, context))
    .sort((a, b) => (b.score - a.score) || (a.cardId - b.cardId))
}
