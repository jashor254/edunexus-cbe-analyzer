import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code     = requestUrl.searchParams.get('code')
  const returnTo = requestUrl.searchParams.get('returnTo') || '/dashboard'
  const role     = requestUrl.searchParams.get('role')
  const product  = requestUrl.searchParams.get('product')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no-code', requestUrl.origin))
  }

  // ✅ Await (Next 16 requirement)
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {}
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', options)
          } catch {}
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange-failed', requestUrl.origin))
  }

  // Route by explicit role first; fall back to DB lookup only for role-less flows
  let resolvedPath = returnTo
  const { data: { user } } = await supabase.auth.getUser()

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (role === 'teacher') {
    resolvedPath = '/teacher/dashboard'
    // Persist role so future logins without the role param route correctly
    if (user) {
      await db.from('profiles').update({ role: 'teacher' }).eq('user_id', user.id)
    }
  } else if (role === 'parent' || role === 'student') {
    resolvedPath = '/dashboard'
  } else if (user && (resolvedPath === '/dashboard' || resolvedPath === '/')) {
    // No role param — returning user via /login; detect from profiles
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.role === 'teacher') resolvedPath = '/teacher/dashboard'
  }

  if (product) resolvedPath += `?product=${product}`

  return NextResponse.redirect(new URL(resolvedPath, requestUrl.origin))
}