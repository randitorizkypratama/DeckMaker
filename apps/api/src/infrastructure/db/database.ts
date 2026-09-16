import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

let singleton: Database | null = null

export function getDatabase(databasePath: string): Database {
  if (singleton) return singleton
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true })
  }
  const db = new Database(databasePath, { create: true })
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  seedAdmin(db)
  singleton = db
  return db
}

// For tests: create fresh in-memory db without singleton
export function createTestDatabase(): Database {
  const db = new Database(':memory:', { create: true })
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

export function resetDatabaseSingleton(): void {
  if (singleton) {
    try { singleton.close() } catch {}
    singleton = null
  }
}

function migrate(db: Database): void {
  db.exec(`
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
  // Add new columns if DB was created before these fields existed
  const userCols = db.query("SELECT name FROM pragma_table_info('users')").all() as { name: string }[]
  const has = (n: string) => userCols.some(c => c.name === n)
  if (!has('display_name')) db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT;`)
  if (!has('age')) db.exec(`ALTER TABLE users ADD COLUMN age INTEGER;`)
  if (!has('gender')) db.exec(`ALTER TABLE users ADD COLUMN gender TEXT;`)
  if (!has('country')) db.exec(`ALTER TABLE users ADD COLUMN country TEXT;`)
  if (!has('avatar')) db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT;`)
  if (!has('role')) db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`)
  if (!has('is_banned')) db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`)

  db.exec(`
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

  // Add owner_id column if missing (for existing DBs)
  const deckCols = db.query("SELECT name FROM pragma_table_info('decks')").all() as { name: string }[]
  const hasOwnerId = deckCols.some(c => c.name === 'owner_id')
  if (!hasOwnerId) {
    db.exec(`ALTER TABLE decks ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_id);`)
  } else {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_id);`)
  }
  const hasIsPublic = deckCols.some(c => c.name === 'is_public')
  if (!hasIsPublic) {
    db.exec(`ALTER TABLE decks ADD COLUMN is_public INTEGER DEFAULT 1;`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_banlist (
      card_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('Forbidden','Limited','Semi-Limited')),
      reason TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
  `)

  // Favorites: migrate from (owner, card_id) to (user_id, card_id) if needed
  // Check existing favorites schema
  const favTableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'").get() as unknown
  if (!favTableExists) {
    db.exec(`
      CREATE TABLE favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, card_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
    `)
  } else {
    const favCols = db.query("SELECT name FROM pragma_table_info('favorites')").all() as { name: string }[]
    const hasUserId = favCols.some(c => c.name === 'user_id')
    const hasOwner = favCols.some(c => c.name === 'owner')
    if (!hasUserId && hasOwner) {
      // Need to migrate: create new table, copy where possible, drop old
      db.exec(`
        CREATE TABLE IF NOT EXISTS favorites_new (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          card_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, card_id)
        );
      `)
      // Keep anon favorites that don't map to a user? Drop them for now - or try to keep legacy table as favorites_legacy
      // Instead, rename old to legacy and create new empty favorites for logged-in users
      db.exec(`ALTER TABLE favorites RENAME TO favorites_legacy;`)
      db.exec(`ALTER TABLE favorites_new RENAME TO favorites;`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);`)
    } else if (hasUserId) {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);`)
    } else {
      // unexpected schema, ensure new schema
      db.exec(`
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

function seedAdmin(db: Database): void {
  const existing = db.query('SELECT 1 FROM users WHERE username = ?').get('admin')
  if (existing) return

  const id = randomUUID().replace(/-/g, '').slice(0, 16)
  const now = new Date().toISOString()
  const passwordHash = Bun.password.hashSync('admin123', { algorithm: 'bcrypt', cost: 10 })

  db.query(`
    INSERT INTO users (id, username, email, password_hash, display_name, role, is_banned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'admin', 'admin@dueldex.com', passwordHash, 'Admin', 'admin', 0, now, now)

  console.log('[seed] Admin user created — login: admin / admin123')
}
