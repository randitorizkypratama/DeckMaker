import type { DeckFormat, DeckFormatRules } from './deck.ts'

/**
 * Single source of truth for deck construction rules.
 *
 * Every layer (validation, generation, UI) reads from here so that a rules
 * change never requires touching the deck engine.
 */
export const DECK_FORMAT_RULES: Record<DeckFormat, DeckFormatRules> = {
  'yu-gi-oh': {
    format: 'yu-gi-oh',
    label: 'Yu-Gi-Oh!',
    mainDeckMin: 40,
    mainDeckMax: 60,
    extraDeckMax: 15,
    sideDeckMax: 15,
    maxCopiesPerCard: 3,
    hasExtraDeck: true,
    hasSideDeck: true,
  },
  rush: {
    // Rush Duel decks have no Extra Deck and no Side Deck.
    format: 'rush',
    label: 'Rush Duel',
    mainDeckMin: 40,
    mainDeckMax: 60,
    extraDeckMax: 0,
    sideDeckMax: 0,
    maxCopiesPerCard: 3,
    hasExtraDeck: false,
    hasSideDeck: false,
  },
}

export function getFormatRules(format: DeckFormat): DeckFormatRules {
  return DECK_FORMAT_RULES[format]
}
