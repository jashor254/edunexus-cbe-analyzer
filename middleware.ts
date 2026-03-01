
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // 1. RUHUSU AUTH CALLBACK IPITE MOJA KWA MOJA
  // Hii inazuia mteja kurudishwa Login kabla session haijatulia
  if (path.startsWith('/auth/callback') || path.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // 2. ADMIN & CRON PROTECTION
  if (path.startsWith('/api/admin')) {
    const adminSecret = request.headers.get('x-admin-secret')
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // 3. UPDATE SESSION (Kwa page zingine zote)
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}