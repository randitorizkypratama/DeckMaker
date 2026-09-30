import type { AnyDatabase } from '../../infrastructure/db/database.ts'
import type { PublicUser, Role } from '../../domain/user/User.ts'
import { toPublicUser } from '../../domain/user/User.ts'
import { DomainError, NotFoundError, ValidationError } from '../../domain/errors.ts'
import type { CustomBanlistEntry } from '../../domain/admin/AdminTypes.ts'
import { buildPagination, type Paginated } from '@dueldex/shared'

export class AdminService {
  constructor(private readonly db: AnyDatabase) {}

  async isAdmin(userId: string): Promise<boolean> {
    const row = await this.db.query<{ role: string | null }>('SELECT role FROM users WHERE id=$id').get({ $id: userId })
    return row?.role === 'admin'
  }

  // --- User management ---

  async listUsers(opts?: { q?: string; page?: number; pageSize?: number }): Promise<Paginated<PublicUser>> {
    const page = opts?.page ?? 1
    const pageSize = opts?.pageSize ?? 20
    let where = ''
    const params: Record<string, any> = {}
    if (opts?.q) {
      where = 'WHERE username LIKE $q OR email LIKE $q OR display_name LIKE $q'
      params.$q = `%${opts.q}%`
    }
    const countRow = await this.db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM users ${where}`).get(params) as { cnt: number }
    const total = countRow.cnt
    const rows = await this.db.query<any>(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $limit OFFSET $offset`).all({ ...params, $limit: pageSize, $offset: (page - 1) * pageSize })
    const items = rows.map(r => toPublicUser(this.rowToUser(r)))
    return { items, pagination: buildPagination(page, pageSize, total) }
  }

  async getUser(id: string): Promise<PublicUser & { deckCount: number; favCount: number }> {
    const row = await this.db.query<any>('SELECT * FROM users WHERE id=$id').get({ $id: id })
    if (!row) throw new NotFoundError('NOT_FOUND', 'User not found.')
    const user = this.rowToUser(row)
    const deckCount = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM decks WHERE owner_id=$id').get({ $id: id }) as { cnt: number }).cnt
    const favCount = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM favorites WHERE user_id=$id').get({ $id: id }) as { cnt: number }).cnt
    return { ...toPublicUser(user), deckCount, favCount }
  }

  async updateUser(id: string, body: { role?: Role; isBanned?: boolean; displayName?: string | null }): Promise<PublicUser> {
    const row = await this.db.query<any>('SELECT * FROM users WHERE id=$id').get({ $id: id })
    if (!row) throw new NotFoundError('NOT_FOUND', 'User not found.')
    const user = this.rowToUser(row)
    if (body.role !== undefined) user.role = body.role
    if (body.isBanned !== undefined) user.isBanned = body.isBanned
    if (body.displayName !== undefined) user.displayName = body.displayName ?? null
    user.updatedAt = new Date().toISOString()
    await this.db.query(
      `UPDATE users SET role=$role, is_banned=$isBanned, display_name=$displayName, updated_at=$updatedAt WHERE id=$id`
    ).run({
      $id: user.id,
      $role: user.role ?? 'user',
      $isBanned: user.isBanned ? 1 : 0,
      $displayName: user.displayName ?? null,
      $updatedAt: user.updatedAt,
    })
    return toPublicUser(user)
  }

  async deleteUser(id: string): Promise<void> {
    const row = await this.db.query<any>('SELECT id FROM users WHERE id=$id').get({ $id: id })
    if (!row) throw new NotFoundError('NOT_FOUND', 'User not found.')
    await this.db.query('DELETE FROM users WHERE id=$id').run({ $id: id })
  }

  // --- Deck management (admin view all) ---

  async listAllDecks(opts?: { q?: string; page?: number; pageSize?: number }): Promise<any> {
    const page = opts?.page ?? 1
    const pageSize = opts?.pageSize ?? 20
    let where = ''
    const params: Record<string, any> = {}
    if (opts?.q) {
      where = 'WHERE d.name LIKE $q OR u.username LIKE $q'
      params.$q = `%${opts.q}%`
    }
    const countRow = await this.db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM decks d LEFT JOIN users u ON d.owner_id=u.id ${where}`).get(params) as { cnt: number }
    const total = countRow.cnt
    const rows = await this.db.query<any>(`SELECT d.*, u.username as owner_name FROM decks d LEFT JOIN users u ON d.owner_id=u.id ${where} ORDER BY d.created_at DESC LIMIT $limit OFFSET $offset`).all({ ...params, $limit: pageSize, $offset: (page - 1) * pageSize })
    return { items: rows.map(r => ({ id: r.id, name: r.name, format: r.format, isPublic: !!r.is_public, ownerName: r.owner_name ?? null, createdAt: r.created_at })), pagination: buildPagination(page, pageSize, total) }
  }

  async deleteDeck(id: string): Promise<void> {
    const row = await this.db.query<any>('SELECT id FROM decks WHERE id=$id').get({ $id: id })
    if (!row) throw new NotFoundError('NOT_FOUND', 'Deck not found.')
    await this.db.query('DELETE FROM decks WHERE id=$id').run({ $id: id })
  }

  // --- Custom banlist ---

  async listBanlist(): Promise<CustomBanlistEntry[]> {
    return await this.db.query<CustomBanlistEntry>('SELECT card_id as cardId, status, reason, created_by as createdBy, created_at as createdAt FROM custom_banlist ORDER BY created_at DESC').all()
  }

  async addBanlistEntry(cardId: number, status: 'Forbidden' | 'Limited' | 'Semi-Limited', reason: string | null, createdBy: string): Promise<CustomBanlistEntry> {
    if (!Number.isInteger(cardId) || cardId <= 0) throw new ValidationError('Invalid card id.')
    const now = new Date().toISOString()
    await this.db.query(
      `INSERT OR REPLACE INTO custom_banlist (card_id, status, reason, created_by, created_at) VALUES ($cardId, $status, $reason, $createdBy, $createdAt)`
    ).run({ $cardId: cardId, $status: status, $reason: reason ?? null, $createdBy: createdBy, $createdAt: now })
    return { cardId, status, reason: reason ?? null, createdBy, createdAt: now }
  }

  async removeBanlistEntry(cardId: number): Promise<void> {
    await this.db.query('DELETE FROM custom_banlist WHERE card_id=$cardId').run({ $cardId: cardId })
  }

  async getBanlistMap(): Promise<Map<number, string>> {
    const rows = await this.db.query<{ card_id: number; status: string }>('SELECT card_id, status FROM custom_banlist').all()
    return new Map(rows.map(r => [r.card_id, r.status]))
  }

  // --- Stats ---

  async getStats(): Promise<any> {
    const totalUsers = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
    const totalDecks = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM decks').get() as { cnt: number }).cnt
    const totalFavorites = (await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM favorites').get() as { cnt: number }).cnt
    return { totalUsers, totalDecks, totalFavorites }
  }

  private rowToUser(row: any): any {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      age: row.age,
      gender: row.gender,
      country: row.country,
      avatar: row.avatar,
      role: row.role ?? 'user',
      isBanned: !!row.is_banned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
