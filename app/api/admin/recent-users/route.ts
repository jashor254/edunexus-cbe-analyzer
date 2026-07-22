// app/api/admin/recent-users/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const service = createServiceClient()

    // Pull the 10 most-recent auth users (has email)
    const { data: authData, error: authErr } = await service.auth.admin.listUsers({ perPage: 10, page: 1 })
    if (authErr) return apiError('Failed to fetch users', 500)

    const userIds = authData.users.map((u) => u.id)

    // Fetch subscriptions + token balances for those users in one shot
    const [{ data: subs }, { data: balances }] = await Promise.all([
      service
        .from('subscriptions')
        .select('user_id, plan')
        .in('user_id', userIds)
        .eq('status', 'active'),
      service
        .from('token_balances')
        .select('user_id, balance')
        .in('user_id', userIds),
    ])

    const subMap    = Object.fromEntries((subs    ?? []).map((s) => [s.user_id, s.plan]))
    const balanceMap = Object.fromEntries((balances ?? []).map((b) => [b.user_id, b.balance]))

    // Sort auth users by created_at desc (listUsers returns sorted already, but be explicit)
    const sorted = [...authData.users].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const recent = sorted.slice(0, 10).map((u) => ({
      id:         u.id,
      email:      u.email ?? '—',
      created_at: u.created_at,
      plan:       subMap[u.id]    ?? 'free',
      balance:    balanceMap[u.id] ?? 0,
    }))

    return apiSuccess({ users: recent })
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return apiError(msg, 500)
  }
}

export const dynamic = 'force-dynamic'
