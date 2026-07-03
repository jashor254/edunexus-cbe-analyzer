// app/api/users/create/route.ts
// Called post-signup to create the application-layer user record.
// Auth is required — the caller must already have a valid Supabase session.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    // name and referralCode are user-supplied metadata — not identity claims.
    // email is always derived from the verified auth token, never trusted from body.
    const { name, referralCode } = body as { name?: string; referralCode?: string }

    const email = auth.user.email
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No email on authenticated account' },
        { status: 400 }
      )
    }

    const db = createServiceClient()

    // Check if user record already exists
    const { data: existing } = await db
      .from('users')
      .select('id, email, referral_code')
      .eq('id', auth.user.id)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, user: existing, message: 'User already exists' })
    }

    const { data, error } = await db.rpc('create_user_with_referral', {
      p_email:              email,
      p_name:               name ?? null,
      p_referred_by_code:   referralCode ?? null,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const userData = data[0]

    return NextResponse.json({
      success: true,
      user: {
        id:           auth.user.id,
        email,
        referralCode: userData.referral_code,
        freeAnalyses: userData.free_analyses,
      },
      message: referralCode
        ? 'Account created! You and your referrer got bonus tokens!'
        : 'Account created! You have 1 free analysis!',
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
