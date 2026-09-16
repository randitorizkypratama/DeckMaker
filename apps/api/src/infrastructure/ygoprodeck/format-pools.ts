import type { DeckFormat } from '@dueldex/shared'

/**
 * Maps a DuelDex deck format onto a YGOPRODeck `format` query value.
 *
 * KNOWN UPSTREAM LIMITATION (verified 2026-09-03):
 * YGOPRODeck documents `format=Rush Duel`, but the endpoint currently returns
 * "No card matching your query was found" for it - Rush Duel cards are not
 * present in the dataset. Speed Duel is used as the substitute pool so the
 * Rush code path exercises real card data instead of fabricated entries.
 *
 * When upstream restores Rush Duel data, change the `rush` value below to
 * 'Rush Duel'. No other code needs to change.
 */
export const FORMAT_QUERY: Record<DeckFormat, string | undefined> = {
  // Undefined means "no format filter" - the full card pool.
  'yu-gi-oh': undefined,
  rush: 'Speed Duel',
}

export function formatQueryValue(format: DeckFormat | undefined): string | undefined {
  if (!format) return undefined
  return FORMAT_QUERY[format]
}
