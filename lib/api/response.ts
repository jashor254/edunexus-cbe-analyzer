import { NextResponse } from 'next/server'

export function apiSuccess(data: any, status: number = 200) {
  return NextResponse.json({
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  }, { status })
}

export function apiError(message: string, status: number = 500) {
  return NextResponse.json({
    success: false,
    data: null,
    error: message,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
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
