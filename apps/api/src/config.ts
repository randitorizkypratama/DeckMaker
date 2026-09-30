/**
 * Environment configuration. Read once at startup and validated here so
 * the rest of the app never touches process.env directly.
 */

function readString(key: string, fallback: string): string {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value.trim() : fallback
}

function readInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export interface AppConfig {
  port: number
  ygoprodeckApiUrl: string
  corsOrigin: string[]
  requestTimeoutMs: number
  cacheTtlMs: number
  databasePath: string
  publicWebUrl: string
  jwtSecret: string
  tursoDatabaseUrl: string
  tursoAuthToken: string
}

export const config: AppConfig = {
  port: readInt('API_PORT', 3001),
  ygoprodeckApiUrl: readString('YGOPRODECK_API_URL', 'https://db.ygoprodeck.com/api/v7'),
  corsOrigin: readString('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  requestTimeoutMs: readInt('UPSTREAM_TIMEOUT_MS', 12_000),
  // YGOPRODeck caches for 2 days and asks consumers to store data locally,
  // so a generous in-process TTL is appropriate here.
  cacheTtlMs: readInt('CACHE_TTL_MS', 60 * 60 * 1000),
  databasePath: readString('DATABASE_PATH', './data/dueldex.sqlite'),
  publicWebUrl: readString('PUBLIC_WEB_URL', 'http://localhost:3000'),
  jwtSecret: readString('JWT_SECRET', 'dev-secret-change-me'),
  tursoDatabaseUrl: readString('TURSO_DATABASE_URL', ''),
  tursoAuthToken: readString('TURSO_AUTH_TOKEN', ''),
}
