// app/api/health/route.ts
// Public endpoint — no auth required (used by UptimeRobot / monitoring)
import { NextResponse } from 'next/server'
import { checkHealth } from '@/lib/monitoring/metrics'

export async function GET() {
  const report = await checkHealth()

  const statusCode = report.status === 'ok' ? 200 : report.status === 'degraded' ? 200 : 503

  return NextResponse.json(report, { status: statusCode })
}
