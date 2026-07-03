// app/api/platform/health/route.ts
// Platform health check — used by monitoring, uptime checkers, and load balancers.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { getAllProviders } from '@/lib/ai-orchestration/registry'

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

  // 3. Overall platform status
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
