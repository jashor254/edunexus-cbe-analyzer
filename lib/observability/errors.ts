// lib/observability/errors.ts
// Structured error types and error aggregation for the platform.

/** Base error with structured metadata */
export class PlatformError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly context: Record<string, unknown>
  readonly isOperational: boolean

  constructor(
    message: string,
    options: {
      code: string
      statusCode?: number
      context?: Record<string, unknown>
      cause?: Error
    }
  ) {
    super(message, { cause: options.cause })
    this.name       = 'PlatformError'
    this.code       = options.code
    this.statusCode = options.statusCode ?? 500
    this.context    = options.context ?? {}
    this.isOperational = true  // expected errors vs. programming errors
  }
}

/** User-facing errors (400-level) */
export class ValidationError extends PlatformError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, context })
    this.name = 'ValidationError'
  }
}

export class AuthError extends PlatformError {
  constructor(message = 'Authentication required') {
    super(message, { code: 'AUTH_REQUIRED', statusCode: 401 })
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends PlatformError {
  constructor(message = 'Access denied', context?: Record<string, unknown>) {
    super(message, { code: 'FORBIDDEN', statusCode: 403, context })
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends PlatformError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` '${id}'` : ''} not found`, {
      code: 'NOT_FOUND', statusCode: 404, context: { resource, id },
    })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends PlatformError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'CONFLICT', statusCode: 409, context })
    this.name = 'ConflictError'
  }
}

export class QuotaExceededError extends PlatformError {
  constructor(limit: number, used: number, resource = 'API requests') {
    super(`${resource} quota exceeded (${used}/${limit})`, {
      code: 'QUOTA_EXCEEDED', statusCode: 429, context: { limit, used, resource },
    })
    this.name = 'QuotaExceededError'
  }
}

/** Provider / infrastructure errors (500-level) */
export class AIProviderError extends PlatformError {
  constructor(provider: string, message: string) {
    super(`AI provider error (${provider}): ${message}`, {
      code: 'AI_PROVIDER_ERROR', statusCode: 502, context: { provider },
    })
    this.name = 'AIProviderError'
  }
}

export class DatabaseError extends PlatformError {
  constructor(operation: string, message: string) {
    super(`Database error during ${operation}: ${message}`, {
      code: 'DATABASE_ERROR', statusCode: 500, context: { operation },
    })
    this.name = 'DatabaseError'
  }
}

/**
 * Convert any error into a safe API response body.
 * Never leaks stack traces or internal details in production.
 */
export function toApiError(err: unknown): { error: string; code?: string; status: number } {
  if (err instanceof PlatformError) {
    return {
      error:  err.message,
      code:   err.code,
      status: err.statusCode,
    }
  }

  // Unknown errors — don't leak internals
  return {
    error:  'An unexpected error occurred. Please try again.',
    code:   'INTERNAL_ERROR',
    status: 500,
  }
}
