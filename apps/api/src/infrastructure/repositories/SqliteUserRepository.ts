import type { Database } from 'bun:sqlite'
import type { Gender, Role, User } from '../../domain/user/User.ts'
import type { UserRepository } from '../../domain/user/UserRepository.ts'

interface UserRow {
  id: string
  username: string
  email: string
  password_hash: string
  display_name: string | null
  age: number | null
  gender: string | null
  country: string | null
  avatar: string | null
  role: string | null
  is_banned: number | null
  created_at: string
  updated_at: string
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = this.db
      .query<UserRow, { $id: string }>('SELECT * FROM users WHERE id = $id')
      .get({ $id: id })
    return row ? this.toUser(row) : null
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = this.db
      .query<UserRow, { $username: string }>('SELECT * FROM users WHERE username = $username')
      .get({ $username: username })
    return row ? this.toUser(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .query<UserRow, { $email: string }>('SELECT * FROM users WHERE email = $email')
      .get({ $email: email })
    return row ? this.toUser(row) : null
  }

  async count(): Promise<number> {
    const row = this.db.query<{ cnt: number }, []>('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }
    return row.cnt
  }

  async list(opts?: { q?: string; page?: number; pageSize?: number }): Promise<User[]> {
    let sql = 'SELECT * FROM users'
    const params: Record<string, any> = {}
    if (opts?.q) {
      sql += ' WHERE username LIKE $q OR email LIKE $q OR display_name LIKE $q'
      params.$q = `%${opts.q}%`
    }
    sql += ' ORDER BY created_at DESC'
    if (opts?.page && opts?.pageSize) {
      sql += ' LIMIT $limit OFFSET $offset'
      params.$limit = opts.pageSize
      params.$offset = (opts.page - 1) * opts.pageSize
    }
    const rows = this.db.query<UserRow, any>(sql).all(params)
    return rows.map(r => this.toUser(r))
  }

  async delete(id: string): Promise<void> {
    this.db.query('DELETE FROM users WHERE id=$id').run({ $id: id })
  }

  async create(user: User): Promise<User> {
    this.db
      .query(
        `INSERT INTO users (id, username, email, password_hash, display_name, age, gender, country, avatar, role, is_banned, created_at, updated_at)
         VALUES ($id, $username, $email, $passwordHash, $displayName, $age, $gender, $country, $avatar, $role, $isBanned, $createdAt, $updatedAt)`
      )
      .run({
        $id: user.id,
        $username: user.username,
        $email: user.email,
        $passwordHash: user.passwordHash,
        $displayName: user.displayName ?? null,
        $age: user.age ?? null,
        $gender: user.gender ?? null,
        $country: user.country ?? null,
        $avatar: user.avatar ?? null,
        $role: user.role ?? 'user',
        $isBanned: user.isBanned ? 1 : 0,
        $createdAt: user.createdAt,
        $updatedAt: user.updatedAt,
      })
    return user
  }

  async update(user: User): Promise<User> {
    this.db
      .query(
        `UPDATE users SET username=$username, email=$email, password_hash=$passwordHash, display_name=$displayName, age=$age, gender=$gender, country=$country, avatar=$avatar, role=$role, is_banned=$isBanned, updated_at=$updatedAt WHERE id=$id`
      )
      .run({
        $id: user.id,
        $username: user.username,
        $email: user.email,
        $passwordHash: user.passwordHash,
        $displayName: user.displayName ?? null,
        $age: user.age ?? null,
        $gender: user.gender ?? null,
        $country: user.country ?? null,
        $avatar: user.avatar ?? null,
        $role: user.role ?? 'user',
        $isBanned: user.isBanned ? 1 : 0,
        $updatedAt: user.updatedAt,
      })
    return user
  }

  private toUser(row: UserRow): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      age: row.age,
      gender: (row.gender as Gender | null) ?? null,
      country: row.country,
      avatar: row.avatar,
      role: (row.role as Role | null) ?? 'user',
      isBanned: !!row.is_banned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
