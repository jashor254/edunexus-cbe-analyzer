// app/api/admin/stats/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiUnauthorized()
    }

    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) {
      return apiForbidden()
    }

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
      service.from('profiles').select('*', { count: 'exact', head: true }),
      service.from('students').select('*', { count: 'exact', head: true }),
      service.from('assessments').select('*', { count: 'exact', head: true }),
      service.from('compass_sessions').select('*', { count: 'exact', head: true }),
      service.from('payments').select('*', { count: 'exact', head: true }),
      service.from('payments').select('amount').eq('status', 'success'),
      service.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
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
    console.error('Admin stats error:', error)
    return apiError('Internal Server Error', 500)
  }
}
