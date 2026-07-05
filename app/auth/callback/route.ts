import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
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

const PUBLIC_PATHS = ['/pricing', '/legal', '/join', '/shared', '/payment']

async function resolveRoleDestination(
  db: SupabaseClient,
  userId: string,
  requestedPath: string
): Promise<string> {
  const isPublic = PUBLIC_PATHS.some(p => requestedPath.startsWith(p))
  if (isPublic) return requestedPath

  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role as string | undefined

  if (requestedPath.startsWith('/teacher')) {
    if (role === 'teacher') return requestedPath
    return '/dashboard'
  }

  if (role === 'teacher') return '/teacher/dashboard'
  return '/dashboard'
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
    return NextResponse.redirect(new URL('/login?error=exchange-failed', requestUrl.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Service-role client for DB writes — bypasses RLS (appropriate here: post-auth role upsert)
  const db = createServiceClient()

  let resolvedPath = returnTo

  if (role === 'teacher') {
    resolvedPath = '/teacher/dashboard'
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
    resolvedPath = '/dashboard'
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
