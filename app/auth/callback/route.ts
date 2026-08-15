import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { getUserRoles, getRoleRedirect } from '@/lib/auth/getRole'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Redirect safety ───────────────────────────────────────────────────────────

/**
 * Validates that a returnTo value is a safe relative path.
 * Rejects anything with a protocol, double-slash, or non-path characters.
 */
function sanitizeReturnTo(raw: string | null): string {
  const fallback = '/dashboard'
  if (!raw) return fallback
  // Must start with / and must not contain protocol separators or double slashes
  if (!raw.startsWith('/') || raw.startsWith('//') || /[^a-zA-Z0-9/_\-?=&%#.]/.test(raw)) {
    return fallback
  }
  return raw
}

// ── Role-aware path resolver ──────────────────────────────────────────────────

// Paths whose returnTo is always honored as-is, skipping the role-based
// override below — either genuinely public, or (for /organizations) because
// org membership, not profiles.role, is what actually governs access there.
// Phase 2 (admin-provisioned teacher activation) — /teacher/activate joins
// this list for the same reason /organizations already does: a brand-new
// invitee's role hasn't been decided by resolveRoleDestination's logic
// yet (school_users membership, not profiles.role, governs what they can
// do), and that logic would otherwise override the invite email's intended
// destination and strand them on a generic dashboard instead.
const PUBLIC_PATHS = ['/pricing', '/legal', '/join', '/shared', '/payment', '/organizations', '/teacher/activate']

async function resolveRoleDestination(
  db: SupabaseClient,
  userId: string,
  requestedPath: string
): Promise<string> {
  const isPublic = PUBLIC_PATHS.some(p => requestedPath.startsWith(p))
  if (isPublic) return requestedPath

  // Canonical role resolution + redirect mapping — lib/auth/getRole.ts's
  // getUserRoles()/getRoleRedirect(). Previously a second, disagreeing
  // inline implementation with no student branch — exactly the drift
  // Blocker #5 was caused by.
  const roles = await getUserRoles(userId, db)
  if (requestedPath.startsWith('/teacher')) {
    return roles.primary === 'teacher' ? requestedPath : getRoleRedirect(roles.primary)
  }
  return getRoleRedirect(roles.primary)
}

// ── Auth callback ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const requestUrl  = new URL(request.url)
  const code        = requestUrl.searchParams.get('code')
  const returnTo    = sanitizeReturnTo(requestUrl.searchParams.get('returnTo'))
  const role        = requestUrl.searchParams.get('role')
  const product     = requestUrl.searchParams.get('product')
  const secondaryRole = requestUrl.searchParams.get('secondary_role')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no-code', requestUrl.origin))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', {
      message: error.message,
      status: error.status,
      code: error.code,
    })
    return NextResponse.redirect(new URL('/login?error=exchange-failed', requestUrl.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Service-role client for DB writes — bypasses RLS (appropriate here: post-auth role upsert)
  const db = createServiceClient()

  let resolvedPath = returnTo

  if (role === 'teacher') {
    resolvedPath = getRoleRedirect('teacher')
    if (user) {
      await db.from('profiles').upsert(
        {
          id:           user.id,
          role:         'teacher',
          ...(secondaryRole ? { secondary_role: secondaryRole } : {}),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    }

  } else if (role === 'parent' || role === 'student') {
    resolvedPath = getRoleRedirect(role)
    if (user) {
      await db.from('profiles').upsert(
        {
          id:           user.id,
          role,
          ...(secondaryRole ? { secondary_role: secondaryRole } : {}),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (secondaryRole === 'teacher') {
        await db
          .from('teachers')
          .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
      }
    }
  }

  const safePath  = user ? await resolveRoleDestination(db, user.id, resolvedPath) : resolvedPath
  const finalPath = product ? `${safePath}?product=${product}` : safePath
  return NextResponse.redirect(new URL(finalPath, requestUrl.origin))
}
