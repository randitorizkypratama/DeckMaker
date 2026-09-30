import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { LibSqlDatabase } from './libsql-adapter.ts'

interface QueryLike<T> {
  get(params?: Record<string, unknown>): T | null | Promise<T | null>
  all(params?: Record<string, unknown>): T[] | Promise<T[]>
  run(params?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint } | Promise<{ changes: number; lastInsertRowid: number | bigint }>
}

/**
 * Common interface satisfied by both BunSqliteWrapper and LibSqlDatabase.
 * bun:sqlite methods return sync values; LibSqlDatabase returns Promises.
 * All callers are async, so both work via await.
 */
export interface AnyDatabase {
  exec(sql: string): void | Promise<void>
  query<T>(sql: string): QueryLike<T>
  close(): void
}

/**
 * Thin adapter around bun:sqlite's Database so it conforms to AnyDatabase.
 */
class BunSqliteWrapper implements AnyDatabase {
  constructor(private readonly raw: Database) {}

  exec(sql: string): void {
    this.raw.exec(sql)
  }

  query<T>(sql: string): QueryLike<T> {
    const stmt = this.raw.query<T, any>(sql)
    return {
      get: (params?) => stmt.get(params ?? {}),
      all: (params?) => stmt.all(params ?? {}),
      run: (params?) => stmt.run(params ?? {}),
    }
  }

  close(): void {
    this.raw.close()
  }
}

let singleton: AnyDatabase | null = null

export async function getDatabase(
  databasePath: string,
  tursoUrl?: string,
  tursoToken?: string,
): Promise<AnyDatabase> {
  if (singleton) return singleton

  if (tursoUrl) {
    const db = new LibSqlDatabase({ url: tursoUrl, authToken: tursoToken })
    await migrate(db)
    await seedAdmin(db)
    singleton = db
    return db
  }

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true })
  }
  const raw = new Database(databasePath, { create: true })
  raw.exec('PRAGMA journal_mode = WAL;')
  raw.exec('PRAGMA foreign_keys = ON;')
  const db = new BunSqliteWrapper(raw)
  await migrate(db)
  await seedAdmin(db)
  singleton = db
  return db
}

/**
 * Returns a raw bun:sqlite Database for tests (in-memory, fast, synchronous).
 */
export function createTestDatabase(): Database {
  const db = new Database(':memory:', { create: true })
  db.exec('PRAGMA foreign_keys = ON;')
  const wrapper = new BunSqliteWrapper(db)
  migrate(wrapper)
  return db
}

export function resetDatabaseSingleton(): void {
  if (singleton) {
    singleton.close()
    singleton = null
  }
}

async function migrate(db: AnyDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      age INTEGER,
      gender TEXT,
      country TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      is_banned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `)

  const userCols = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('users')").all()
  const has = (n: string) => userCols.some((c) => c.name === n)
  if (!has('display_name')) await db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT;`)
  if (!has('age')) await db.exec(`ALTER TABLE users ADD COLUMN age INTEGER;`)
  if (!has('gender')) await db.exec(`ALTER TABLE users ADD COLUMN gender TEXT;`)
  if (!has('country')) await db.exec(`ALTER TABLE users ADD COLUMN country TEXT;`)
  if (!has('avatar')) await db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT;`)
  if (!has('role')) await db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`)
  if (!has('is_banned')) await db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      key_card_id INTEGER,
      cards TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const deckCols = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('decks')").all()
  const hasOwnerId = deckCols.some((c) => c.name === 'owner_id')
  if (!hasOwnerId) {
    await db.exec(`ALTER TABLE decks ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_id);`)
  } else {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_id);`)
  }
  const hasIsPublic = deckCols.some((c) => c.name === 'is_public')
  if (!hasIsPublic) {
    await db.exec(`ALTER TABLE decks ADD COLUMN is_public INTEGER DEFAULT 1;`)
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS custom_banlist (
      card_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('Forbidden','Limited','Semi-Limited')),
      reason TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
  `)

  const favTableExists = await db.query<unknown>("SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'").get()
  if (!favTableExists) {
    await db.exec(`
      CREATE TABLE favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, card_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
    `)
  } else {
    const favCols = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('favorites')").all()
    const hasUserId = favCols.some((c) => c.name === 'user_id')
    const hasOwner = favCols.some((c) => c.name === 'owner')
    if (!hasUserId && hasOwner) {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS favorites_new (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          card_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, card_id)
        );
      `)
      await db.exec(`ALTER TABLE favorites RENAME TO favorites_legacy;`)
      await db.exec(`ALTER TABLE favorites_new RENAME TO favorites;`)
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);`)
    } else if (hasUserId) {
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);`)
    } else {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          card_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, card_id)
        );
      `)
    }
  }
}

async function seedAdmin(db: AnyDatabase): Promise<void> {
  const existing = await db.query('SELECT 1 FROM users WHERE username = $username').get({ $username: 'admin' })
  if (existing) return

  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  const now = new Date().toISOString()
  const passwordHash = Bun.password.hashSync('admin123', { algorithm: 'bcrypt', cost: 10 })

  await db.query(`
    INSERT INTO users (id, username, email, password_hash, display_name, role, is_banned, created_at, updated_at)
    VALUES ($id, $username, $email, $passwordHash, $displayName, $role, $isBanned, $createdAt, $updatedAt)
  `).run({
    $id: id,
    $username: 'admin',
    $email: 'admin@dueldex.com',
    $passwordHash: passwordHash,
    $displayName: 'Admin',
    $role: 'admin',
    $isBanned: 0,
    $createdAt: now,
    $updatedAt: now,
  })

  console.log('[seed] Admin user created — login: admin / admin123')
}