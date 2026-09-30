import type { AnyDatabase } from '../../infrastructure/db/database.ts'
import type { CardRepository } from '../../domain/card/CardRepository.ts'

interface DeckRow {
  id: string
  name: string
  format: string
  cards: string
  key_card_id: number | null
  owner_id: string | null
  is_public: number
  created_at: string
}

interface DeckCardEntry {
  cardId: number
  quantity: number
  section: string
}

export interface CardPopularity {
  cardId: number
  count: number
  totalCopies: number
}

export interface DeckPopularity {
  id: string
  name: string
  format: string
  ownerName: string | null
  createdAt: string
  cardCount: number
}

export interface ArchetypeStats {
  archetype: string
  deckCount: number
}

export interface MetaOverview {
  totalDecks: number
  totalCardsUsed: number
  uniqueCardsUsed: number
  avgDeckSize: number
  topCards: CardPopularity[]
  topDecks: DeckPopularity[]
  archetypeBreakdown: ArchetypeStats[]
  formatBreakdown: Record<string, number>
}

interface CardRow {
  id: number
  name: string
  type: string
  archetype: string | null
}

export class MetaService {
  constructor(private readonly db: AnyDatabase, private readonly cards: CardRepository) {}

  async getOverview(): Promise<MetaOverview> {
    const rows = await this.db.query<DeckRow>(
      'SELECT id, name, format, cards, key_card_id, owner_id, is_public, created_at FROM decks WHERE is_public = 1'
    ).all()

    // Fetch all card data for archetype resolution
    const allCardIds = new Set<number>()
    const parsedDecks: { row: DeckRow; cards: DeckCardEntry[] }[] = []
    for (const row of rows) {
      let cards: DeckCardEntry[] = []
      try { cards = JSON.parse(row.cards) } catch { continue }
      parsedDecks.push({ row, cards })
      for (const e of cards) allCardIds.add(e.cardId)
    }

    // Fetch card data for archetype resolution via repository (not DB table)
    const cardDataMap = new Map<number, CardRow>()
    if (allCardIds.size > 0) {
      const resolved = await this.cards.findByIds([...allCardIds])
      for (const c of resolved) cardDataMap.set(c.id, { id: c.id, name: c.name, type: c.type, archetype: c.archetype ?? null })
    }

    const cardCounts = new Map<number, { count: number; totalCopies: number }>()
    const archetypeMap = new Map<string, number>()
    const formatMap = new Map<string, number>()
    let totalCardsUsed = 0
    const uniqueCards = new Set<number>()

    for (const { row, cards } of parsedDecks) {
      formatMap.set(row.format, (formatMap.get(row.format) ?? 0) + 1)

      const seen = new Set<number>()
      for (const entry of cards) {
        const existing = cardCounts.get(entry.cardId)
        if (existing) {
          existing.totalCopies += entry.quantity
          if (!seen.has(entry.cardId)) { existing.count++; seen.add(entry.cardId) }
        } else {
          cardCounts.set(entry.cardId, { count: 1, totalCopies: entry.quantity })
          seen.add(entry.cardId)
        }
        totalCardsUsed += entry.quantity
        uniqueCards.add(entry.cardId)
      }

      // Resolve archetype from key card or first card
      const firstCard = cards[0]
      const keyId = row.key_card_id ?? firstCard?.cardId ?? null
      if (keyId) {
        const cardData = cardDataMap.get(keyId)
        const arch = cardData?.archetype ?? 'No Archetype'
        archetypeMap.set(arch, (archetypeMap.get(arch) ?? 0) + 1)
      }
    }

    const topCards: CardPopularity[] = [...cardCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([cardId, data]) => ({ cardId, count: data.count, totalCopies: data.totalCopies }))

    const ownerNames = new Map<string, string>()
    const userRows = await this.db.query<{ id: string; username: string }>(
      'SELECT id, username FROM users'
    ).all()
    for (const u of userRows) ownerNames.set(u.id, u.username)

    const topDecks: DeckPopularity[] = parsedDecks
      .map(({ row, cards }) => ({
        id: row.id,
        name: row.name,
        format: row.format,
        ownerName: ownerNames.get(row.owner_id ?? '') ?? null,
        createdAt: row.created_at,
        cardCount: cards.reduce((sum, e) => sum + e.quantity, 0),
      }))
      .sort((a, b) => b.cardCount - a.cardCount)
      .slice(0, 20)

    const archetypeBreakdown: ArchetypeStats[] = [...archetypeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([archetype, deckCount]) => ({ archetype, deckCount }))

    const formatBreakdown: Record<string, number> = {}
    for (const [fmt, cnt] of formatMap) formatBreakdown[fmt] = cnt

    return {
      totalDecks: parsedDecks.length,
      totalCardsUsed,
      uniqueCardsUsed: uniqueCards.size,
      avgDeckSize: parsedDecks.length > 0 ? Math.round(totalCardsUsed / parsedDecks.length) : 0,
      topCards,
      topDecks,
      archetypeBreakdown,
      formatBreakdown,
    }
  }

  async getTopCards(limit = 30): Promise<CardPopularity[]> {
    const rows = await this.db.query<DeckRow>(
      'SELECT cards FROM decks WHERE is_public = 1'
    ).all()

    const cardCounts = new Map<number, { count: number; totalCopies: number }>()

    for (const row of rows) {
      let cards: DeckCardEntry[] = []
      try { cards = JSON.parse(row.cards) } catch { continue }
      const seen = new Set<number>()
      for (const entry of cards) {
        const existing = cardCounts.get(entry.cardId)
        if (existing) {
          existing.totalCopies += entry.quantity
          if (!seen.has(entry.cardId)) { existing.count++; seen.add(entry.cardId) }
        } else {
          cardCounts.set(entry.cardId, { count: 1, totalCopies: entry.quantity })
          seen.add(entry.cardId)
        }
      }
    }

    return [...cardCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([cardId, data]) => ({ cardId, count: data.count, totalCopies: data.totalCopies }))
  }

  async getDeckStats(): Promise<{ totalDecks: number; publicDecks: number; formatBreakdown: Record<string, number> }> {
    const total = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM decks').get() as { cnt: number }).cnt
    const pub = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM decks WHERE is_public = 1').get() as { cnt: number }).cnt
    const rows = await this.db.query<{ format: string; cnt: number }>(
      'SELECT format, COUNT(*) as cnt FROM decks WHERE is_public = 1 GROUP BY format'
    ).all()
    const formatBreakdown: Record<string, number> = {}
    for (const r of rows) formatBreakdown[r.format] = r.cnt
    return { totalDecks: total, publicDecks: pub, formatBreakdown }
  }
}
