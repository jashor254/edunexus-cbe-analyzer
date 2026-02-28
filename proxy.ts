import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function  proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ============================================================
  // 🔴 PROTECT ADMIN ROUTES
  // ============================================================
  if (path.startsWith('/api/admin')) {
    const adminSecret = request.headers.get('x-admin-secret')

    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }
  }

  // ============================================================
  // 🔴 PROTECT CRON ROUTES
  // ============================================================
  if (path.startsWith('/api/cron')) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow Vercel cron OR your secret
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Cron access required' },
        { status: 401 }
      )
    }
  }

  // ============================================================
  // ✅ SESSION MANAGEMENT (existing - don't touch)
  // ============================================================
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}