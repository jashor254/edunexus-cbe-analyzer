import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const returnTo = searchParams.get('returnTo') || '/pricing'
  const product = searchParams.get('product')

  // ✅ FIX: await cookies()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: (name: string, options: any) => {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Exchange code for session
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Build redirect URL safely
  const redirectUrl = new URL(returnTo, request.url)

  if (product) {
    redirectUrl.searchParams.set('product', product)
  }

  return NextResponse.redirect(redirectUrl)
}