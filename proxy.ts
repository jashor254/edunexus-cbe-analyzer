import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/pricing',
  '/legal',
  '/auth',
  '/join',
  '/shared',
  '/payment',
  '/_next',
  '/favicon',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Root and explicitly public paths bypass auth entirely
  if (pathname === '/') return NextResponse.next()
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Admin routes: only kariukidennis092@gmail.com ─────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user || user.email !== 'kariukidennis092@gmail.com') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ── All other protected routes: must be logged in ─────────────────────────
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?returnTo=${encodeURIComponent(pathname)}`, request.url)
    )
  }

  // ── Teacher routes ────────────────────────────────────────────────────────
  if (pathname.startsWith('/teacher')) {
    // /teacher/setup is open to any logged-in user (completes onboarding)
    if (pathname === '/teacher/setup') return response

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, secondary_role')
      .eq('id', user.id)
      .single()

    const canAccessTeacher =
      profile?.role === 'teacher' || profile?.secondary_role === 'teacher'

    if (!canAccessTeacher) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Verify teacher record exists (role may be set but setup incomplete)
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!teacher) {
      return NextResponse.redirect(new URL('/teacher/setup', request.url))
    }

    return response
  }

  // ── Dashboard routes ──────────────────────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, secondary_role')
      .eq('id', user.id)
      .single()

    // Pure teachers (no parent secondary role) belong in teacher dashboard
    if (profile?.role === 'teacher' && profile?.secondary_role !== 'parent') {
      return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
    }

    return response
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
