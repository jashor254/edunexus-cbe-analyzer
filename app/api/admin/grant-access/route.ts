// app/api/admin/grant-access/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiUnauthorized()
    }

    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) {
      return apiForbidden()
    }

    const body = await request.json()
    const { email, days = 90 } = body as { email: string; days?: number }

    if (!email) {
      return apiError('Missing email', 400)
    }

    const service = createServiceClient()

    // Find user by email via auth.users (service role required)
    const { data: usersData, error: lookupError } = await service.auth.admin.listUsers()
    if (lookupError) {
      return apiError('Failed to look up user', 500)
    }

    const target = (usersData?.users ?? []).find(
      (u: { email?: string | null }) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    ) as { id: string; email?: string | null } | undefined
    if (!target) {
      return apiError(`No user found with email: ${email}`, 404)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + days)

    // Upsert subscription
    const { error: subError } = await service
      .from('subscriptions')
      .upsert(
        {
          user_id: target.id,
          plan: 'term',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (subError) {
      return apiError('Failed to grant subscription', 500)
    }

    // Add 50 tokens — increment existing balance rather than overwrite
    const GRANT_TOKENS = 50
    const { data: existingBalance } = await service
      .from('token_balances')
      .select('balance, total_ever')
      .eq('user_id', target.id)
      .maybeSingle()

    const { error: tokenError } = await service.from('token_balances').upsert(
      {
        user_id:    target.id,
        balance:    (existingBalance?.balance    ?? 0) + GRANT_TOKENS,
        total_ever: (existingBalance?.total_ever ?? 0) + GRANT_TOKENS,
      },
      { onConflict: 'user_id' }
    )

    if (tokenError) {
      console.error('Token upsert error:', tokenError)
      // Non-fatal — subscription already granted
    }

    return apiSuccess({
      message: 'Access granted successfully',
      email,
      expiresAt: expiresAt.toISOString(),
    })

  } catch (error) {
    console.error('Grant access error:', error)
    return apiError('Internal Server Error', 500)
  }
}
