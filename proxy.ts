import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { generateTraceId } from '@/lib/observability/tracing'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config'
import { getUserRoles, getSchoolAdminMembership, getRoleRedirect } from '@/lib/auth/getRole'

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
  '/school-concepts',
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

    const roles = await getUserRoles(user.id, supabase)
    const isTeacherRole = roles.primary === 'teacher' || roles.secondary === 'teacher'

    // School Office (Sprint 10G): admin-tier school_users members may reach
    // it even without a teacher-role profile (e.g. a headteacher who does
    // not also teach) — every other /teacher/* route keeps the stricter
    // teacher-only gate below, unchanged.
    if (pathname.startsWith('/teacher/core-office')) {
      const adminMembership = await getSchoolAdminMembership(user.id, supabase)
      if (adminMembership) return response
    }

    if (!isTeacherRole) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Verify teacher record exists (role may be set but setup incomplete)
    if (!roles.hasTeacherRecord) {
      return NextResponse.redirect(new URL('/teacher/setup', request.url))
    }

    return response
  }

  // ── Student routes (Sprint 3, Platform Audit v1.0, Blocker #5) ────────────
  // Mirrors the /teacher branch's shape — middleware handles the common
  // case fast, app/student/layout.tsx's own getUserRoles() check remains the
  // final authoritative gate (defense-in-depth, same pattern as /teacher).
  if (pathname.startsWith('/student')) {
    // `/student/blueprint/**` (Phase 3A, docs/architecture/blueprint-
    // execution-experience-phase3a.md) is a confirmed exception, not a
    // relaxation of the rule above: `app/student/blueprint/[learnerId]/
    // page.tsx` is deliberately the ONE shared Blueprint render for
    // teacher/parent/student/admin viewers alike (its own header comment:
    // "originally reached only from Teacher Workspace"), gated by its own
    // `requireLearnerAccess` (self/parent/teacher-of-record/admin) — a
    // strictly finer-grained, already-authoritative check than this
    // middleware's coarse role gate. Before this carve-out, ANY teacher
    // (and admin-tier staff) hitting this route — including the existing
    // "Review Actions" link and the legacy `/teacher/reports/blueprint/
    // [studentId]` redirect shim, both already shipped — was silently
    // bounced to `/teacher/dashboard` before the page ever rendered,
    // confirmed by real HTTP testing while building Phase 3A. Mirrors the
    // exact carve-out shape the `/teacher/core-office` branch above
    // already uses for admin-tier staff — not a new pattern.
    // Trailing slash is deliberate: the bare `/student/blueprint` route
    // (no id — a self-service "redirect me to my own Blueprint" route,
    // meaningless for a teacher, who has no "own" Blueprint) must stay
    // blocked exactly as before; only `/student/blueprint/<learnerId>`
    // and its subpaths are the shared, teacher-eligible render.
    if (pathname.startsWith('/student/blueprint/')) {
      const roles = await getUserRoles(user.id, supabase)
      const isTeacher = roles.primary === 'teacher' || roles.secondary === 'teacher'
      const adminMembership = isTeacher ? null : await getSchoolAdminMembership(user.id, supabase)
      if (isTeacher || adminMembership) {
        // `app/student/layout.tsx` (wrapping this entire route tree) is a
        // SECOND, independent gate that also redirects any `teacher`-role
        // viewer away — middleware alone can't clear this route for a
        // teacher; the layout needs to know this specific request was
        // already authorized for the one carved-out path. Forwarded as a
        // request header, the standard Next.js way to pass computed
        // middleware state into a Server Component that has no direct
        // pathname access otherwise.
        const teacherHeaders = new Headers(request.headers)
        teacherHeaders.set('x-blueprint-teacher-viewer', '1')
        return NextResponse.next({ request: { headers: teacherHeaders } })
      }
      if (roles.primary !== 'student') {
        return NextResponse.redirect(new URL(getRoleRedirect(roles.primary), request.url))
      }
      return response
    }

    const roles = await getUserRoles(user.id, supabase)
    if (roles.primary !== 'student') {
      return NextResponse.redirect(new URL(getRoleRedirect(roles.primary), request.url))
    }
    return response
  }

  // ── Dashboard routes ──────────────────────────────────────────────────────
  if (pathname.startsWith('/dashboard')) {
    // Admin-tier school_users members land in the School Office (Sprint
    // 10G), taking precedence over the plain-teacher redirect below —
    // matches this route's existing pattern of resolving one destination
    // before falling through to the generic dashboard.
    const adminMembership = await getSchoolAdminMembership(user.id, supabase)
    if (adminMembership) {
      return NextResponse.redirect(new URL('/teacher/core-office', request.url))
    }

    const roles = await getUserRoles(user.id, supabase)

    // Pure teachers (no parent secondary role) belong in teacher dashboard
    if (roles.primary === 'teacher' && roles.secondary !== 'parent') {
      return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
    }

    return response
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|site.webmanifest|manifest.json|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
