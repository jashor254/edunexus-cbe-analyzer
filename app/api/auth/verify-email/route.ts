// app/api/auth/verify-email/route.ts
// Marks the authenticated user's email as verified.
// Uses getUser() — email is always derived from the auth token, never trusted from body.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'

export async function POST() {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  const email = auth.user.email
  if (!email) {
    return NextResponse.json({ success: false, error: 'No email on account' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    const { error } = await db
      .from('users')
      .update({ email_verified: true, last_active_at: new Date().toISOString() })
      .eq('id', auth.user.id)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Email verified successfully' })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
