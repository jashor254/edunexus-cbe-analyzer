import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

function sanitizeNext(raw: string | null): string {
  const fallback = '/dashboard'
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || /[^a-zA-Z0-9/_\-?=&%#.]/.test(raw)) return fallback
  return raw
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeNext(requestUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth-failed', requestUrl.origin))
}