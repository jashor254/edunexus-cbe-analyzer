// app/api/admin/stats/route.ts
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

    const [
      { count: usersCount },
      { count: studentsCount },
      { count: assessmentsCount },
      { count: compassCount },
      { count: paymentsCount },
      { data: revenueData },
      { count: subsCount },
    ] = await Promise.all([
      service.from('profiles').select('id', { count: 'exact', head: true }),
      service.from('students').select('id', { count: 'exact', head: true }),
      service.from('assessments').select('id', { count: 'exact', head: true }),
      service.from('compass_sessions').select('id', { count: 'exact', head: true }),
      service.from('payments').select('id', { count: 'exact', head: true }),
      service.from('payments').select('amount').eq('status', 'success'),
      service.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ])

    const totalRevenue = (revenueData ?? []).reduce(
      (sum: number, row: { amount: number }) => sum + (row.amount || 0),
      0
    )

    return apiSuccess({
      stats: {
        users: usersCount ?? 0,
        students: studentsCount ?? 0,
        assessments: assessmentsCount ?? 0,
        compassSessions: compassCount ?? 0,
        payments: paymentsCount ?? 0,
        totalRevenue,
        activeSubscriptions: subsCount ?? 0,
      }
    })

  } catch (error) {
    if (error instanceof UnauthorizedError) return apiUnauthorized()
    if (error instanceof ForbiddenError) return apiForbidden()
    console.error('Admin stats error:', error)
    return apiError('Internal Server Error', 500)
  }
}
