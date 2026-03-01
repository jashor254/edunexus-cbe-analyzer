import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 1. Tengeneza response ya awali
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Hii ndiyo njia sahihi ya ku-sync cookies kati ya request na response
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          
          // Tunatengeneza response mpya yenye cookies hizi
          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUHIMU: Hii inatakiwa iitwe, lakini usifanye redirect hapa!
  // Tunaiita tu ili ku-refresh session tokens kama zipo.
  const { data: { user } } = await supabase.auth.getUser()

  // 3. ULINZI: Kama mteja anajaribu kwenda Dashboard na hana session
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}