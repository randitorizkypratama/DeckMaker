import type { Card, CardImage } from '@dueldex/shared'
import type { YgoCardImage, YgoCardResponse } from './types.ts'

/**
 * Translates raw YGOPRODeck payloads into domain Card models.
 *
 * Malformed entries are skipped rather than partially mapped, so downstream
 * layers can rely on every Card having an id, name, type and image.
 */

const IMAGE_PLACEHOLDER = 'https://images.ygoprodeck.com/images/cards/back.jpg'

function mapImage(raw: YgoCardImage): CardImage | null {
  const imageUrl = raw.image_url ?? raw.image_url_small
  const imageUrlSmall = raw.image_url_small ?? raw.image_url
  if (!imageUrl || !imageUrlSmall) return null
  return { imageUrl, imageUrlSmall }
}

export function mapCard(raw: YgoCardResponse): Card | null {
  if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) return null
  if (typeof raw.name !== 'string' || raw.name.length === 0) return null
  if (typeof raw.type !== 'string' || raw.type.length === 0) return null

  const images = (raw.card_images ?? [])
    .map(mapImage)
    .filter((image): image is CardImage => image !== null)

  const card: Card = {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    frameType: raw.frameType ?? 'normal',
    desc: raw.desc ?? '',
    cardImages:
      images.length > 0
        ? images
        : [{ imageUrl: IMAGE_PLACEHOLDER, imageUrlSmall: IMAGE_PLACEHOLDER }],
  }

  if (raw.race) card.race = raw.race
  if (raw.archetype) card.archetype = raw.archetype
  if (raw.attribute) card.attribute = raw.attribute
  if (typeof raw.level === 'number') card.level = raw.level
  if (typeof raw.atk === 'number') card.atk = raw.atk
  if (typeof raw.def === 'number') card.def = raw.def
  if (typeof raw.linkval === 'number') card.linkval = raw.linkval
  if (Array.isArray(raw.linkmarkers)) card.linkmarkers = [...raw.linkmarkers]
  if (raw.banlist_info) {
    const bl: Record<string, string> = {}
    if (raw.banlist_info.ban_tcg) bl.tcg = raw.banlist_info.ban_tcg
    if (raw.banlist_info.ban_ocg) bl.ocg = raw.banlist_info.ban_ocg
    if (raw.banlist_info.ban_goat) bl.goat = raw.banlist_info.ban_goat
    if (Object.keys(bl).length > 0) card.banlist = bl
  }

  return card
}

export function mapCards(raw: YgoCardResponse[]): Card[] {
  return raw
    .map(mapCard)
    .filter((card): card is Card => card !== null)
}
