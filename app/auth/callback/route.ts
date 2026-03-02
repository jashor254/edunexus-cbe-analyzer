import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // Kama kuna 'next' parameter, itumie, vinginevyo iende dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Kwa Next.js 15+, cookies() ni promise
    const cookieStore = await cookies() 
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // TULAZIMISHE redirect kwenda kwenye domain yako halisi
      // Hii inazuia ile loop ya kurudi landing page
      return NextResponse.redirect(new URL(next, 'https://edunexus.co.ke'))
    }
  }

  // Ikishindikana, mrudishe login na error message
  return NextResponse.redirect(new URL('/login?error=auth-failed', 'https://edunexus.co.ke'))
}