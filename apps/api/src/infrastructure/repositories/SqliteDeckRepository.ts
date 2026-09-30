import type { AnyDatabase } from '../db/database.ts'
import type { Deck, DeckCard, DeckFormat } from '@dueldex/shared'
import type { DeckRepository } from '../../domain/deck/DeckRepository.ts'

interface DeckRow {
  id: string
  name: string
  format: string
  key_card_id: number | null
  cards: string
  created_at: string
  updated_at: string
  owner_id: string | null
  is_public: number | null
}

/**
 * SQLite-backed DeckRepository using bun:sqlite.
 * Uses a shared Database instance from database.ts so decks, users and favorites
 * share the same file and WAL journal.
 */
export class SqliteDeckRepository implements DeckRepository {
  constructor(private readonly db: AnyDatabase) {}

  async create(deck: Deck): Promise<Deck> {
    this.db
      .query(
        `INSERT INTO decks (id, name, format, key_card_id, cards, created_at, updated_at, owner_id, is_public)
         VALUES ($id, $name, $format, $keyCardId, $cards, $createdAt, $updatedAt, $ownerId, $isPublic)`,
      )
      .run({
        $id: deck.id,
        $name: deck.name,
        $format: deck.format,
        $keyCardId: deck.keyCardId ?? null,
        $cards: JSON.stringify(deck.cards),
        $createdAt: deck.createdAt,
        $updatedAt: deck.updatedAt,
        $ownerId: deck.ownerId ?? null,
        $isPublic: deck.isPublic ?? true ? 1 : 0,
      })
    return deck
  }

  async findById(id: string): Promise<Deck | null> {
    const row = this.db
      .query<DeckRow>('SELECT * FROM decks WHERE id = $id')
      .get({ $id: id })
    return row ? this.toDeck(row) : null
  }

  async findByOwner(ownerId: string, opts?: { q?: string; sort?: string; order?: string; page?: number; pageSize?: number }): Promise<Deck[]> {
    let sql = 'SELECT * FROM decks WHERE owner_id = $ownerId'
    const params: Record<string, any> = { $ownerId: ownerId }
    if (opts?.q) {
      sql += ' AND name LIKE $q'
      params.$q = `%${opts.q}%`
    }
    const sortCol = opts?.sort === 'name' ? 'name' : 'updated_at'
    const order = opts?.order === 'asc' ? 'ASC' : 'DESC'
    sql += ` ORDER BY ${sortCol} ${order}`
    if (opts?.page && opts?.pageSize) {
      const offset = (opts.page - 1) * opts.pageSize
      sql += ' LIMIT $limit OFFSET $offset'
      params.$limit = opts.pageSize
      params.$offset = offset
    }
    const rows = this.db.query<DeckRow>(sql).all(params)
    return rows.map((r) => this.toDeck(r))
  }

  async countByOwner(ownerId: string, q?: string): Promise<number> {
    let sql = 'SELECT COUNT(*) as cnt FROM decks WHERE owner_id = $ownerId'
    const params: Record<string, any> = { $ownerId: ownerId }
    if (q) {
      sql += ' AND name LIKE $q'
      params.$q = `%${q}%`
    }
    const row = this.db.query<{ cnt: number }>(sql).get(params) as { cnt: number }
    return row.cnt
  }

  async update(deck: Deck): Promise<Deck> {
    this.db
      .query(
        `UPDATE decks
         SET name = $name, format = $format, key_card_id = $keyCardId,
             cards = $cards, updated_at = $updatedAt, owner_id = $ownerId, is_public = $isPublic
         WHERE id = $id`,
      )
      .run({
        $id: deck.id,
        $name: deck.name,
        $format: deck.format,
        $keyCardId: deck.keyCardId ?? null,
        $cards: JSON.stringify(deck.cards),
        $updatedAt: deck.updatedAt,
        $ownerId: deck.ownerId ?? null,
        $isPublic: deck.isPublic ?? true ? 1 : 0,
      })
    return deck
  }

  async delete(id: string): Promise<void> {
    this.db.query('DELETE FROM decks WHERE id = $id').run({ $id: id })
  }

  private toDeck(row: DeckRow): Deck {
    const deck: Deck = {
      id: row.id,
      name: row.name,
      format: row.format as DeckFormat,
      cards: JSON.parse(row.cards) as DeckCard[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    if (row.key_card_id !== null) deck.keyCardId = row.key_card_id
    if (row.owner_id !== null) deck.ownerId = row.owner_id
    deck.isPublic = row.is_public === null ? true : !!row.is_public
    return deck
  }
}
