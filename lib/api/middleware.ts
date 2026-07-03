// lib/api/middleware.ts
// Reusable server-side auth and ownership guards for all API routes.
// Import these at the top of every gated route — BEFORE any business logic.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { ZodSchema } from 'zod'

// ── Auth ──────────────────────────────────────────────────────────────────────

export type AuthOk = { user: User }
export type AuthFail = { response: ReturnType<typeof apiUnauthorized> }

/**
 * Performs server-side token validation via getUser().
 * Returns { user } on success or { response: 401 } on failure.
 * Always call this first — never trust cookies without server validation.
 */
export async function requireAuth(): Promise<AuthOk | AuthFail> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: apiUnauthorized() }
  return { user }
}

/**
 * Validates auth and checks the caller is a platform admin.
 * Returns { user, isAdmin: true } or { response: 401/403 }.
 */
export async function requireAdmin(): Promise<(AuthOk & { isAdmin: true }) | AuthFail> {
  const auth = await requireAuth()
  if ('response' in auth) return auth
  if (!ADMIN_CONFIG.isAdmin(auth.user.email ?? '')) {
    return { response: apiForbidden() as ReturnType<typeof apiUnauthorized> }
  }
  return { user: auth.user, isAdmin: true }
}

// ── Ownership ─────────────────────────────────────────────────────────────────

/**
 * Returns a 403 response if resourceUserId !== authenticatedUserId.
 * Returns null if ownership is confirmed.
 */
export function assertOwnership(
  resourceUserId: string,
  authenticatedUserId: string
): ReturnType<typeof apiForbidden> | null {
  if (resourceUserId !== authenticatedUserId) return apiForbidden()
  return null
}

/**
 * Verifies that a student belongs to the authenticated user
 * (as parent_user_id on the students table).
 * Returns null on success, 403 response on failure.
 */
export async function assertStudentOwnership(
  studentId: string,
  userId: string
): Promise<ReturnType<typeof apiForbidden> | null> {
  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('parent_user_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student || student.parent_user_id !== userId) return apiForbidden()
  return null
}

/**
 * Verifies that a payment record belongs to the authenticated user.
 * Returns null on success, 403 response on failure.
 */
export async function assertPaymentOwnership(
  transactionId: string,
  userId: string
): Promise<ReturnType<typeof apiForbidden> | null> {
  const db = createServiceClient()
  const { data: payment } = await db
    .from('payments')
    .select('user_id')
    .eq('transaction_id', transactionId)
    .maybeSingle()

  if (!payment || payment.user_id !== userId) return apiForbidden()
  return null
}

// ── Request validation ────────────────────────────────────────────────────────

type ParseOk<T> = { data: T }
type ParseFail = { error: ReturnType<typeof apiBadRequest> }

/**
 * Parses and validates request body against a Zod schema.
 * Returns { data } on success or { error: 400 response } on failure.
 */
export async function parseBody<T>(
  request: NextRequest | Request,
  schema: ZodSchema<T>
): Promise<ParseOk<T> | ParseFail> {
  let raw: unknown
  try {
    raw = await (request as Request).json()
  } catch {
    return { error: apiBadRequest('Invalid JSON body') }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request body'
    return { error: apiBadRequest(msg) }
  }

  return { data: result.data }
}
