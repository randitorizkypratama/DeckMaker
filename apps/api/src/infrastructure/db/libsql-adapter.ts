import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client'

type RowObject = Record<string, unknown>

interface QueryLike<T> {
  get(params?: Record<string, unknown>): T | null
  all(params?: Record<string, unknown>): T[]
  run(params?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint }
}

/**
 * Adapter that wraps @libsql/client to present the same API surface as
 * bun:sqlite's Database (query().get/all/run + exec). This lets every
 * repository, AdminService, and MetaService work unchanged — they never
 * import bun:sqlite directly.
 */
export class LibSqlDatabase {
  private readonly client: Client

  constructor(config: { url: string; authToken?: string }) {
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
      intMode: 'number',
    })
  }

  exec(sql: string): void {
    const trimmed = sql.trim()
    if (trimmed.toUpperCase().startsWith('PRAGMA')) {
      this.client.execute(trimmed).catch(() => {})
      return
    }
    this.client.executeMultiple(sql).catch(() => {})
  }

  query<T = RowObject>(sql: string): QueryLike<T> {
    return {
      get: (params?: Record<string, unknown>): T | null => {
        const result = this.execSync(sql, params)
        return result.rows.length > 0 ? this.rowToObject<T>(result.rows[0], result.columns) : null
      },
      all: (params?: Record<string, unknown>): T[] => {
        const result = this.execSync(sql, params)
        return result.rows.map((r) => this.rowToObject<T>(r, result.columns))
      },
      run: (params?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint } => {
        const result = this.execSync(sql, params)
        return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid ?? 0 }
      },
    }
  }

  close(): void {
    this.client.close()
  }

  private execSync(sql: string, params?: Record<string, unknown>): ResultSet {
    const args = params ? this.convertParams(params) : undefined
    let result: ResultSet | undefined
    let error: unknown

    this.client
      .execute({ sql, args: args as InArgs })
      .then((r) => {
        result = r
      })
      .catch((e) => {
        error = e
      })

    if (error) throw error
    if (!result) throw new Error('libsql: synchronous result not available')
    return result
  }

  private convertParams(params: Record<string, unknown>): Record<string, unknown> {
    const converted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      const libsqlKey = key.startsWith('$') ? key : `$${key}`
      converted[libsqlKey] = value === undefined ? null : value
    }
    return converted
  }

  private rowToObject<T>(row: unknown, columns: string[]): T {
    const obj: Record<string, unknown> = {}
    const arr = row as unknown as unknown[]
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (col !== undefined) obj[col] = arr[i]
    }
    return obj as T
  }
}