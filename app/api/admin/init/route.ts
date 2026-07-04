// app/api/admin/init/route.ts
// One-time admin account initialisation — requires ADMIN_SECRET header
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const secret = ADMIN_CONFIG.adminSecret

    if (!secret || !timingSafeEqualString(authHeader, `Bearer ${secret}`)) {
      return apiUnauthorized()
    }

    const service = createServiceClient()

    const { data: usersData, error: lookupError } = await service.auth.admin.listUsers()
    if (lookupError) {
      return apiError('Failed to look up users', 500)
    }

    const adminUser = (usersData?.users ?? []).find(
      (u: { email?: string | null }) => u.email?.toLowerCase().trim() === ADMIN_CONFIG.adminEmail
    ) as { id: string; email?: string | null } | undefined

    if (!adminUser) {
      return apiError(
        `Admin user (${ADMIN_CONFIG.adminEmail}) not found — sign up first`,
        404
      )
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 3650) // 10 years

    const [{ error: tokenError }, { error: subError }] = await Promise.all([
      service.from('token_balances').upsert(
        { user_id: adminUser.id, balance: 999999, total_ever: 999999 },
        { onConflict: 'user_id' }
      ),
      service.from('subscriptions').upsert(
        {
          user_id: adminUser.id,
          plan: 'premium',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id' }
      ),
    ])

    if (tokenError) console.error('Token init error:', tokenError)
    if (subError) console.error('Subscription init error:', subError)

    return apiSuccess({ message: 'Admin initialized', adminId: adminUser.id })

  } catch (error) {
    console.error('Admin init error:', error)
    return apiError('Internal Server Error', 500)
  }
}
