import type { ApiResponse } from '@dueldex/shared'

/**
 * Single gateway to the DuelDex API.
 *
 * Unwraps the { success, data } envelope and converts API failures into
 * thrown ApiRequestError instances so callers handle one error shape.
 * The frontend never calls YGOPRODeck directly.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

const TOKEN_KEY = 'dueldex:token'

function getStoredToken(): string | null {
  if (!import.meta.client) return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Used when no API base URL is configured, so requests never become "undefined/api/...". */
const FALLBACK_API_BASE_URL = 'http://localhost:3001'

export function useApi() {
  const config = useRuntimeConfig()
  const configured = config.public.apiBaseUrl as string | undefined
  const baseUrl = (configured && configured.length > 0
    ? configured
    : FALLBACK_API_BASE_URL
  ).replace(/\/$/, '')

  async function request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | undefined>
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = getStoredToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const response = await $fetch<ApiResponse<T>>(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        query: options.query,
        body: options.body as Record<string, unknown> | undefined,
      })

      if (!response.success) {
        throw new ApiRequestError(response.error.code, response.error.message)
      }
      return response.data
    } catch (error) {
      if (error instanceof ApiRequestError) throw error

      // $fetch throws on non-2xx; the body still carries our error envelope.
      const fetchError = error as {
        data?: ApiResponse<never>
        statusCode?: number
        message?: string
      }
      const body = fetchError.data
      if (body && body.success === false) {
        throw new ApiRequestError(body.error.code, body.error.message, fetchError.statusCode)
      }

      throw new ApiRequestError(
        'NETWORK_ERROR',
        'Unable to connect to the DuelDex API.',
        fetchError.statusCode,
      )
    }
  }

  return { request, baseUrl }
}
