import type { ApiErrorCode } from '@dueldex/shared'

/**
 * Domain-level error carrying a transport-agnostic code.
 * The presentation layer maps these to HTTP status codes.
 */
export class DomainError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class NotFoundError extends DomainError {
  constructor(code: ApiErrorCode, message: string) {
    super(code, message, 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details)
    this.name = 'ValidationError'
  }
}

export class InvalidDeckError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('INVALID_DECK', message, 422, details)
    this.name = 'InvalidDeckError'
  }
}

export class UpstreamError extends DomainError {
  constructor(message: string, code: ApiErrorCode = 'UPSTREAM_ERROR') {
    super(code, message, 502)
    this.name = 'UpstreamError'
  }
}
