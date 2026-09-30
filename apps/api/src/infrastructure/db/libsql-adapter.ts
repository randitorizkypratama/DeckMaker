import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client'

type RowObject = Record<string, unknown>

interface QueryLike<T> {
  get(params?: Record<string, unknown>): Promise<T | null>
  all(params?: Record<string, unknown>): Promise<T[]>
  run(params?: Record<string, unknown>): Promise<{ changes: number; lastInsertRowid: number | bigint }>
}

/**
 * Adapter that wraps @libsql/client to present a similar API surface to
 * bun:sqlite's Database (query().get/all/run + exec). All methods are async
 * because Turso uses network I/O.
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

  async exec(sql: string): Promise<void> {
    const trimmed = sql.trim()
    if (trimmed.toUpperCase().startsWith('PRAGMA')) {
      await this.client.execute(trimmed)
      return
    }
    await this.client.executeMultiple(sql)
  }

  query<T = RowObject>(sql: string): QueryLike<T> {
    return {
      get: async (params?: Record<string, unknown>): Promise<T | null> => {
        const result = await this.execAsync(sql, params)
        return result.rows.length > 0 ? this.rowToObject<T>(result.rows[0], result.columns) : null
      },
      all: async (params?: Record<string, unknown>): Promise<T[]> => {
        const result = await this.execAsync(sql, params)
        return result.rows.map((r) => this.rowToObject<T>(r, result.columns))
      },
      run: async (params?: Record<string, unknown>): Promise<{ changes: number; lastInsertRowid: number | bigint }> => {
        const result = await this.execAsync(sql, params)
        return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid ?? 0 }
      },
    }
  }

  close(): void {
    this.client.close()
  }

  private async execAsync(sql: string, params?: Record<string, unknown>): Promise<ResultSet> {
    const args = params ? this.convertParams(params) : undefined
    return this.client.execute({ sql, args: args as InArgs })
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