import type { Card } from './card.ts'

export type DeckFormat = 'yu-gi-oh' | 'rush'

export const DECK_FORMATS: readonly DeckFormat[] = ['yu-gi-oh', 'rush'] as const

export function isDeckFormat(value: unknown): value is DeckFormat {
  return typeof value === 'string' && (DECK_FORMATS as readonly string[]).includes(value)
}

/**
 * Which section of a deck a card occupies.
 * Rush Duel has no Extra Deck, so `extra` is unused for that format.
 */
export type DeckSectionName = 'main' | 'extra' | 'side'

export const DECK_SECTIONS: readonly DeckSectionName[] = ['main', 'extra', 'side'] as const

export interface DeckCard {
  cardId: number
  quantity: number
  section: DeckSectionName
}

export interface Deck {
  id: string
  name: string
  format: DeckFormat
  keyCardId?: number
  cards: DeckCard[]
  createdAt: string
  updatedAt: string
  ownerId?: string | null
  isPublic?: boolean
}

/**
 * A deck enriched with resolved card data for presentation.
 * The API returns this shape so the web app never needs to
 * re-fetch every card in a deck individually.
 */
export interface DeckCardDetail extends DeckCard {
  card: Card
}

export interface DeckDetail extends Omit<Deck, 'cards'> {
  cards: DeckCardDetail[]
  keyCard?: Card
  stats: DeckStats
}

export interface DeckStats {
  mainCount: number
  extraCount: number
  sideCount: number
  monsterCount: number
  spellCount: number
  trapCount: number
  levelCurve: Record<string, number>
  atkHistogram: Record<string, number>
  archetypeBreakdown: Record<string, number>
  avgLevel?: number
  avgAtk?: number
}

/**
 * Per-format deck construction rules.
 * Isolated as data so rules can change without touching the deck engine.
 */
export interface DeckFormatRules {
  format: DeckFormat
  label: string
  mainDeckMin: number
  mainDeckMax: number
  extraDeckMax: number
  sideDeckMax: number
  maxCopiesPerCard: number
  /** Whether the format uses an Extra Deck at all. */
  hasExtraDeck: boolean
  /** Whether the format uses a Side Deck at all. */
  hasSideDeck: boolean
}

export interface DeckValidationIssue {
  code: string
  message: string
  section?: DeckSectionName
  cardId?: number
}

export interface DeckValidationResult {
  valid: boolean
  issues: DeckValidationIssue[]
}

/**
 * Explanation of why a card was recommended by the generator.
 */
export interface CardScore {
  cardId: number
  score: number
  reasons: string[]
}

export interface DeckRecommendation {
  deck: DeckDetail
  scores: CardScore[]
}

export interface GenerateDeckRequest {
  format: DeckFormat
  keyCardId: number
  name?: string
}

export interface CreateDeckRequest {
  name: string
  format: DeckFormat
  keyCardId?: number
  cards: DeckCard[]
  isPublic?: boolean
}

export interface UpdateDeckRequest {
  name?: string
  keyCardId?: number
  cards?: DeckCard[]
  isPublic?: boolean
}

export interface ShareDeckResponse {
  shareId: string
  url: string
}

// --- Combo Finder types ---

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

// --- Opening Hand Simulator types ---

export interface HandSimResult {
  trials: number
  handSize: number
  deckSize: number
  cardProbability: Record<number, { cardId: number; name: string; count: number; seen: number; pct: number }>
  monsterPct: number
  spellPct: number
  trapPct: number
  avgHandAtk: number
  brickRate: number
  avgArchetypes: number
  keyCardPct: Record<number, number>
}
