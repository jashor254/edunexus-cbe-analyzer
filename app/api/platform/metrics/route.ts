// app/api/platform/metrics/route.ts
// Platform metrics endpoint — admin only.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getMetricsSnapshot } from '@/lib/observability/metrics'
import { getQueueDepths } from '@/lib/jobs/monitor'
import { getAllProviders } from '@/lib/ai-orchestration/registry'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin check via the single source of truth in ADMIN_CONFIG
  const { ADMIN_CONFIG } = await import('@/lib/config/api')
  if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [metrics, queueDepths, aiProviders] = await Promise.all([
    Promise.resolve(getMetricsSnapshot()),
    getQueueDepths().catch(() => []),
    Promise.resolve(getAllProviders()),
  ])

  return NextResponse.json({
    timestamp:    new Date().toISOString(),
    metrics,
    queues:       queueDepths,
    ai_providers: aiProviders.map(p => ({
      name:           p.name,
      model:          p.model,
      health:         p.health,
      error_count:    p.error_count,
      success_count:  p.success_count,
      avg_latency_ms: p.avg_latency_ms,
      last_error:     p.last_error,
    })),
  })
}
