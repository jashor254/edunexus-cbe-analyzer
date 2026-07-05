import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function updateSession(request: NextRequest) {
  // Must use NextResponse.next({ request }) so Next.js forwards the mutated
  // request headers (including updated cookies) to the route handler.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // getAll/setAll is required for @supabase/ssr v0.5+ which chunks large
        // session tokens across multiple cookies (sb-xxx-auth-token.0, .1 …).
        // The old get/set/remove API reads only one cookie by exact name and
        // silently misses chunked tokens — causing getSession() to see a stale
        // session and trigger the "potentially insecure" warning in route handlers.
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT with Supabase and writes the refreshed token
  // back via setAll above. Route handlers then call getSession() which reads
  // from this cookie — zero network round-trip, < 5ms.
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/admin')) {
    if (!user?.email || !ADMIN_CONFIG.isAdmin(user.email)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}
