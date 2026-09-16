/**
 * Card domain types shared between the API and the web app.
 * These are internal representations - never raw YGOPRODeck payloads.
 */

export interface CardImage {
  imageUrl: string
  imageUrlSmall: string
}

export interface BanlistInfo {
  tcg?: string
  ocg?: string
  goat?: string
}

export interface Card {
  id: number
  name: string
  type: string
  frameType: string
  desc: string
  race?: string
  archetype?: string
  attribute?: string
  level?: number
  atk?: number
  def?: number
  linkval?: number
  linkmarkers?: string[]
  banlist?: BanlistInfo
  cardImages: CardImage[]
}

/**
 * Broad classification used for deck placement and filtering.
 * Derived from the raw card `type` string by the mapper so that
 * downstream layers never parse strings themselves.
 */
export type CardKind = 'monster' | 'spell' | 'trap'

export const CARD_KINDS: readonly CardKind[] = ['monster', 'spell', 'trap'] as const

/**
 * Monster card attributes.
 */
export type CardAttribute =
  | 'DARK'
  | 'LIGHT'
  | 'EARTH'
  | 'WATER'
  | 'FIRE'
  | 'WIND'
  | 'DIVINE'

export const CARD_ATTRIBUTES: readonly CardAttribute[] = [
  'DARK',
  'LIGHT',
  'EARTH',
  'WATER',
  'FIRE',
  'WIND',
  'DIVINE',
] as const

/**
 * Card type values accepted by the card search endpoint.
 * Mirrors the meaningful subset of YGOPRODeck `type` values.
 */
export const CARD_TYPES: readonly string[] = [
  'Effect Monster',
  'Flip Effect Monster',
  'Fusion Monster',
  'Gemini Monster',
  'Link Monster',
  'Normal Monster',
  'Normal Tuner Monster',
  'Pendulum Effect Monster',
  'Ritual Effect Monster',
  'Ritual Monster',
  'Spell Card',
  'Synchro Monster',
  'Synchro Tuner Monster',
  'Trap Card',
  'Tuner Monster',
  'Union Effect Monster',
  'XYZ Monster',
  'Skill Card',
  'Token',
] as const

/**
 * Returns the broad kind of a card from its raw type string.
 */
export function cardKindOf(type: string): CardKind {
  const normalized = type.toLowerCase()
  if (normalized.includes('spell')) return 'spell'
  if (normalized.includes('trap')) return 'trap'
  return 'monster'
}

/**
 * Extra deck monsters are placed in the Extra Deck rather than the Main Deck.
 */
const EXTRA_DECK_FRAME_TYPES = new Set([
  'fusion',
  'synchro',
  'xyz',
  'link',
  'fusion_pendulum',
  'synchro_pendulum',
  'xyz_pendulum',
])

export function isExtraDeckCard(card: Pick<Card, 'frameType' | 'type'>): boolean {
  if (EXTRA_DECK_FRAME_TYPES.has(card.frameType.toLowerCase())) return true
  const type = card.type.toLowerCase()
  return (
    type.includes('fusion') ||
    type.includes('synchro') ||
    type.includes('xyz') ||
    type.includes('link')
  )
}
