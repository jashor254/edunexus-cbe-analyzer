import { NextResponse } from 'next/server'

export type ApiResponse<T = unknown> = {
  success: boolean
  data: T | null
  error: string | null
  meta: { timestamp: string; version: string }
}

export function apiSuccess<T = unknown>(data: T, status: number = 200) {
  return NextResponse.json<ApiResponse<T>>({
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  }, { status })
}

export function apiError(message: string, status: number = 500) {
  return NextResponse.json<ApiResponse<null>>({
    success: false,
    data: null,
    error: message,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  }, { status })
}

export function apiUnauthorized() {
  return apiError('Unauthorized', 401)
}

export function apiForbidden() {
  return apiError('Access denied', 403)
}

export function apiBadRequest(message: string) {
  return apiError(message, 400)
}

export function apiNotFound(message: string = 'Not found') {
  return apiError(message, 404)
}

export function apiFallback(message: string) {
  return apiError(message, 500)
}

/** Extract a safe error message from an unknown catch value. */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}
