// app/api/platform/health/route.ts
// Platform health check — used by monitoring, uptime checkers, and load balancers.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { getAllProviders } from '@/lib/ai-orchestration/registry'
import { getQueueDepths } from '@/lib/jobs/monitor'
import { repos } from '@/lib/repositories'

type HealthStatus = 'healthy' | 'degraded' | 'down'

type ComponentHealth = {
  status: HealthStatus
  latency_ms?: number
  detail?: string
}

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, ComponentHealth> = {}

  // 1. Database connectivity
  const dbStart = Date.now()
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    checks.database = error
      ? { status: 'down', detail: error.message }
      : { status: 'healthy', latency_ms: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'down', detail: (err as Error).message }
  }

  // 2. AI providers
  const aiProviders = getAllProviders()
  checks.ai_providers = {
    status:  aiProviders.some(p => p.health === 'healthy') ? 'healthy'
           : aiProviders.some(p => p.health === 'degraded') ? 'degraded'
           : 'down',
    detail:  aiProviders.map(p => `${p.name}:${p.health}`).join(', '),
  }

  // 3. Job queues
  try {
    const depths = await getQueueDepths()
    const totalDeadLetter = depths.reduce((sum, q) => sum + q.dead_letter, 0)
    const totalFailed     = depths.reduce((sum, q) => sum + q.failed, 0)
    checks.jobs = {
      status:  totalDeadLetter > 0 ? 'degraded' : totalFailed > 0 ? 'degraded' : 'healthy',
      detail:  `queued=${depths.reduce((s, q) => s + q.queued, 0)}, processing=${depths.reduce((s, q) => s + q.processing, 0)}, failed=${totalFailed}, dead_letter=${totalDeadLetter}`,
    }
  } catch (err) {
    checks.jobs = { status: 'down', detail: (err as Error).message }
  }

  // 4. Event/webhook deliveries
  try {
    const counts = await repos.webhooks.findDeliveryStatusCounts()
    checks.events = {
      status: counts.dead_letter > 0 ? 'degraded' : counts.failed > 0 ? 'degraded' : 'healthy',
      detail: `pending=${counts.pending}, failed=${counts.failed}, dead_letter=${counts.dead_letter}`,
    }
  } catch (err) {
    checks.events = { status: 'down', detail: (err as Error).message }
  }

  // 5. Overall platform status
  const allStatuses = Object.values(checks).map(c => c.status)
  const overall: HealthStatus =
    allStatuses.every(s => s === 'healthy') ? 'healthy' :
    allStatuses.some(s => s === 'down')     ? 'down' :
    'degraded'

  const statusCode = overall === 'healthy' ? 200 : overall === 'degraded' ? 200 : 503

  return NextResponse.json({
    status:    overall,
    timestamp: new Date().toISOString(),
    version:   process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    checks,
  }, { status: statusCode })
}
