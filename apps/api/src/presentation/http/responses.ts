import type { ApiFailure, ApiSuccess, ApiErrorCode } from '@dueldex/shared'
import { DomainError } from '../../domain/errors.ts'

/**
 * Consistent API envelope helpers.
 */

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data }
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiFailure {
  const error: ApiFailure['error'] = { code, message }
  if (details !== undefined) error.details = details
  return { success: false, error }
}

export interface MappedError {
  status: number
  body: ApiFailure
}

/**
 * Maps thrown errors onto HTTP status codes and the error envelope.
 * Unknown errors never leak internals to the client.
 */
export function mapError(error: unknown): MappedError {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: fail(error.code, error.message, error.details),
    }
  }
  // Handle auth middleware thrown errors
  const anyErr = error as { code?: string; status?: number; message?: string }
  if (anyErr && anyErr.code === 'UNAUTHORIZED') {
    return {
      status: anyErr.status ?? 401,
      body: fail('UNAUTHORIZED', anyErr.message ?? 'Authentication required.'),
    }
  }

  return {
    status: 500,
    body: fail('INTERNAL_ERROR', 'Something went wrong. Please try again.'),
  }
}
