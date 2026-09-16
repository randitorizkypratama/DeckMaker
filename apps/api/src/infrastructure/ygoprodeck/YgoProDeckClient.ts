import { config } from '../../config.ts'
import { UpstreamError } from '../../domain/errors.ts'
import type { YgoCardResponse, YgoListResponse } from './types.ts'

/**
 * Thin HTTP client for YGOPRODeck.
 *
 * Responsibilities stop at transport concerns: URLs, timeouts, HTTP errors and
 * malformed payloads. It returns raw upstream shapes; mapping to domain models
 * happens in YgoProDeckMapper.
 */
export class YgoProDeckClient {
  constructor(
    private readonly baseUrl: string = config.ygoprodeckApiUrl,
    private readonly timeoutMs: number = config.requestTimeoutMs,
  ) {}

  /**
   * Calls cardinfo.php with the supplied query parameters.
   *
   * Upstream returns a 400 with an `error` string when nothing matches, which
   * is a legitimate empty result rather than a failure - so it maps to [].
   */
  async cardInfo(params: Record<string, string | number | undefined>): Promise<YgoListResponse> {
    const url = new URL(`${this.baseUrl}/cardinfo.php`)
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue
      url.searchParams.set(key, String(value))
    }

    const payload = await this.request<YgoListResponse | { error: string }>(url)

    if ('error' in payload && typeof payload.error === 'string') {
      // "No card matching your query" is an empty result set.
      if (/no card matching/i.test(payload.error)) {
        return { data: [] }
      }
      throw new UpstreamError(`YGOPRODeck rejected the request: ${payload.error}`)
    }

    if (!('data' in payload) || !Array.isArray(payload.data)) {
      throw new UpstreamError('YGOPRODeck returned a malformed response.')
    }

    return payload
  }

  async archetypes(): Promise<string[]> {
    const url = new URL(`${this.baseUrl}/archetypes.php`)
    const payload = await this.request<{ archetype_name: string }[]>(url)
    if (!Array.isArray(payload)) {
      throw new UpstreamError('YGOPRODeck returned a malformed archetype response.')
    }
    return payload
      .map((entry) => entry.archetype_name)
      .filter((name): name is string => typeof name === 'string')
  }

  private async request<T>(url: URL): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      const text = await response.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new UpstreamError('YGOPRODeck returned a non-JSON response.')
      }

      // A 400 carrying an `error` field is handled by the caller.
      if (!response.ok && !isErrorPayload(parsed)) {
        throw new UpstreamError(
          `YGOPRODeck request failed with status ${response.status}.`,
        )
      }

      return parsed as T
    } catch (error) {
      if (error instanceof UpstreamError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new UpstreamError(
          'YGOPRODeck did not respond in time.',
          'UPSTREAM_TIMEOUT',
        )
      }
      throw new UpstreamError('Unable to reach YGOPRODeck.')
    } finally {
      clearTimeout(timer)
    }
  }
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  )
}

export type { YgoCardResponse }
