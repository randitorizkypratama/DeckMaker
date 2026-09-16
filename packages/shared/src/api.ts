/**
 * Transport-agnostic API contract shared by the API and the web client.
 */

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiFailure {
  success: false
  error: ApiErrorBody
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'DECK_NOT_FOUND'
  | 'INVALID_DECK'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface Paginated<T> {
  items: T[]
  pagination: PaginationMeta
}

/**
 * Query accepted by the card list/search endpoints.
 */
export interface CardQuery {
  search?: string
  type?: string
  attribute?: string
  level?: number
  archetype?: string
  race?: string
  atk?: number
  def?: number
  sort?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface FilterMetadata {
  types: string[]
  attributes: string[]
  races: string[]
  archetypes: string[]
  levels: number[]
}

export const DEFAULT_PAGE_SIZE = 24
export const MAX_PAGE_SIZE = 60

export function buildPagination(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  }
}
