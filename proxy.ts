import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { generateTraceId } from '@/lib/observability/tracing'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config'

/** Pick the best supported locale from an Accept-Language header. */
function detectLocale(acceptLang: string): string {
  if (!acceptLang) return DEFAULT_LOCALE
  const candidates = acceptLang
    .split(',')
    .map(entry => { const [tag, q] = entry.trim().split(';q='); return { tag: tag.trim().toLowerCase(), q: parseFloat(q ?? '1') } })
    .sort((a, b) => b.q - a.q)
    .map(e => e.tag)
  for (const candidate of candidates) {
    const exact = SUPPORTED_LOCALES.find(l => l.toLowerCase() === candidate)
    if (exact) return exact
    const lang = candidate.split('-')[0]
    const loose = SUPPORTED_LOCALES.find(l => l.toLowerCase().startsWith(lang + '-') || l.toLowerCase() === lang)
    if (loose) return loose
  }
  return DEFAULT_LOCALE
}

const PUBLIC_PREFIXES = [
  '/api/',
  '/login',
  '/signup',
  '/pricing',
  '/legal',
  '/about',
  '/insights',
  '/auth',
  '/join',
  '/shared',
  '/preview',
  '/payment',
  '/_next',
  '/favicon',
  '/site.webmanifest',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
]

export async function proxy(request: NextRequest) {
  // Validate the JWT and write the refreshed session cookie FIRST so that
  // route handlers can call getSession() (local cookie read, ~0ms) instead of
  // getUser() (remote network call, ~2s on slow connections).
  const sessionResponse = await updateSession(request)

  // ── Observability: correlation trace ID ────────────────────────────────────
  const traceId = request.headers.get('x-trace-id') ?? generateTraceId()
  sessionResponse.headers.set('x-trace-id', traceId)

  // ── Global readiness: locale detection ────────────────────────────────────
  const locale = detectLocale(request.headers.get('accept-language') ?? '')
  sessionResponse.headers.set('x-locale', locale)

  const { pathname } = request.nextUrl

  // Root and public paths (including /api/*) return immediately with the
  // sessionResponse so the Set-Cookie header is preserved for route handlers.
  if (pathname === '/') return sessionResponse
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return sessionResponse
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
  matcher: ['/((?!_next/static|_next/image|favicon|site.webmanifest|manifest.json|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
