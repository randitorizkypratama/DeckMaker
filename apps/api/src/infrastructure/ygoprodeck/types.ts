/**
 * Raw YGOPRODeck response shapes.
 *
 * These mirror the upstream API exactly (snake_case included) and must never
 * escape the infrastructure layer - YgoProDeckMapper converts them to domain
 * models.
 */

export interface YgoCardImage {
  id?: number
  image_url?: string
  image_url_small?: string
  image_url_cropped?: string
}

export interface YgoCardResponse {
  id?: number
  name?: string
  type?: string
  frameType?: string
  desc?: string
  race?: string
  archetype?: string
  attribute?: string
  level?: number
  atk?: number
  def?: number
  linkval?: number
  linkmarkers?: string[]
  banlist_info?: { ban_tcg?: string; ban_ocg?: string; ban_goat?: string }
  card_images?: YgoCardImage[]
}

export interface YgoMeta {
  current_rows?: number
  total_rows?: number
  total_pages?: number
  rows_remaining?: number
  next_page_offset?: number
}

export interface YgoListResponse {
  data: YgoCardResponse[]
  meta?: YgoMeta
}
