import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ─── Role-aware path resolver ─────────────────────────────────────────────────

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

  const role = profile?.role

  if (requestedPath.startsWith('/teacher')) {
    if (role === 'teacher') return requestedPath
    return '/dashboard'
  }

  if (role === 'teacher') return '/teacher/dashboard'
  return '/dashboard'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code          = requestUrl.searchParams.get('code')
  const returnTo      = requestUrl.searchParams.get('returnTo') || '/dashboard'
  const role          = requestUrl.searchParams.get('role')
  const product       = requestUrl.searchParams.get('product')
  const secondaryRole = requestUrl.searchParams.get('secondary_role')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no-code', requestUrl.origin))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange-failed', requestUrl.origin))
  }

  let resolvedPath = returnTo
  const { data: { user } } = await supabase.auth.getUser()

  // Service-role client for DB writes — bypasses RLS
  const db = createServiceClient()

  if (role === 'teacher') {
    resolvedPath = '/teacher/dashboard'
    if (user) {
      await db.from('profiles').upsert(
        {
          id: user.id, // profiles.id = auth user UUID
          role: 'teacher',
          ...(secondaryRole ? { secondary_role: secondaryRole } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    }

  } else if (role === 'parent' || role === 'student') {
    resolvedPath = '/dashboard'
    if (user) {
      await db.from('profiles').upsert(
        {
          id: user.id,
          role,
          ...(secondaryRole ? { secondary_role: secondaryRole } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      // If secondary role is teacher, create a stub teachers record
      if (secondaryRole === 'teacher') {
        await db
          .from('teachers')
          .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true } as any)
      }
    }

  }

  const safePath = user
    ? await resolveRoleDestination(db, user.id, resolvedPath)
    : resolvedPath

  const finalPath = product ? `${safePath}?product=${product}` : safePath
  return NextResponse.redirect(new URL(finalPath, requestUrl.origin))
}
