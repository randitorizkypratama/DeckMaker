import type { AnyDatabase } from '../db/database.ts'
import type { FavoritesRepository } from '../../domain/card/FavoritesRepository.ts'

/**
 * SQLite-backed favorites store per authenticated user.
 * Schema: favorites(user_id, card_id)
 */
export class SqliteFavoritesRepository implements FavoritesRepository {
  constructor(private readonly db: AnyDatabase) {}

  async list(owner: string): Promise<number[]> {
    const rows = await this.db
      .query<{ card_id: number }>(
        'SELECT card_id FROM favorites WHERE user_id = $userId ORDER BY created_at DESC',
      )
      .all({ $userId: owner })
    return rows.map((row) => row.card_id)
  }

  async add(owner: string, cardId: number): Promise<void> {
    await this.db
      .query(
        `INSERT INTO favorites (user_id, card_id, created_at)
         VALUES ($userId, $cardId, $createdAt)
         ON CONFLICT (user_id, card_id) DO NOTHING`,
      )
      .run({ $userId: owner, $cardId: cardId, $createdAt: new Date().toISOString() })
  }

  async remove(owner: string, cardId: number): Promise<void> {
    await this.db
      .query('DELETE FROM favorites WHERE user_id = $userId AND card_id = $cardId')
      .run({ $userId: owner, $cardId: cardId })
  }

  async clear(owner: string): Promise<void> {
    await this.db.query('DELETE FROM favorites WHERE user_id = $userId').run({ $userId: owner })
  }
}
