// app/api/auth/update-activity/route.ts
// Updates last_active_at / last_login_at for the authenticated user only.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'

export async function POST() {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const db = createServiceClient()
    const now = new Date().toISOString()

    const { error } = await db
      .from('users')
      .update({ last_active_at: now, last_login_at: now })
      .eq('id', auth.user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
