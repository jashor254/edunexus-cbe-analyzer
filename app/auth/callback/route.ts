import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    
    console.log("🔵 Callback hit - URL:", request.url)
    
    if (!code) {
      console.log("❌ No code found")
      return NextResponse.redirect(new URL('/login?error=no-code', requestUrl.origin))
    }

    // Get cookie store
    const cookieStore = await cookies()
    
    // Create Supabase client with SSR
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
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Handle error
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Handle error
            }
          },
        },
      }
    )

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error("❌ Exchange error:", error)
      return NextResponse.redirect(new URL('/login?error=exchange-failed', requestUrl.origin))
    }

    console.log("✅ Session exchanged successfully!")
    
    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    
  } catch (error) {
    console.error("💥 Callback error:", error)
    const requestUrl = new URL(request.url)
    return NextResponse.redirect(new URL('/login?error=exception', requestUrl.origin))
  }
}