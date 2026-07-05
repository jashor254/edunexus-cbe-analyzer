// lib/monitoring/metrics.ts
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { notifyOwnerMilestone } from '@/lib/whatsapp/sender'

const MILESTONES = [50, 100, 200, 500, 1000]

export type HealthStatus = 'ok' | 'degraded' | 'down'

export type HealthReport = {
  status: HealthStatus
  checks: {
    database: { status: HealthStatus; latency_ms: number }
    auth: { status: HealthStatus }
    deepseek: { status: HealthStatus }
  }
  timestamp: string
}

export type MetricsSnapshot = {
  total_teachers: number
  active_teachers: number
  total_students: number
  milestone_hit: number | null
}

export async function checkHealth(): Promise<HealthReport> {
  const timestamp = new Date().toISOString()

  // Database check — ping teachers table with tight timeout
  const dbStart = Date.now()
  let dbStatus: HealthStatus = 'ok'
  try {
    await repos.analytics.pingDatabase()
  } catch {
    dbStatus = 'down'
  }
  const dbLatency = Date.now() - dbStart

  // Auth check — verify service client can reach auth schema
  const supabase = createServiceClient()
  let authStatus: HealthStatus = 'ok'
  try {
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 })
    if (error) authStatus = 'degraded'
  } catch {
    authStatus = 'down'
  }

  // DeepSeek check — verify API key is configured (no actual call to save cost)
  const deepseekKey = process.env.DEEPSEEK_AI_API_KEY
  const deepseekStatus: HealthStatus =
    deepseekKey && deepseekKey.startsWith('sk-') ? 'ok' : 'degraded'

  const allStatuses: HealthStatus[] = [dbStatus, authStatus, deepseekStatus]
  const overallStatus: HealthStatus = allStatuses.includes('down')
    ? 'down'
    : allStatuses.includes('degraded')
    ? 'degraded'
    : 'ok'

  return {
    status: overallStatus,
    checks: {
      database: { status: dbStatus, latency_ms: dbLatency },
      auth: { status: authStatus },
      deepseek: { status: deepseekStatus },
    },
    timestamp,
  }
}

export async function snapshotMetrics(): Promise<MetricsSnapshot> {
  const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [total_teachers, total_students, active_teachers] = await Promise.all([
    repos.analytics.countTeachers(),
    repos.analytics.countStudents(),
    repos.analytics.countActiveTeachers(since30Days),
  ])

  // Check if we just crossed a milestone
  const prev = await repos.analytics.getLatestMetricsTeacherCount()
  const milestone_hit =
    MILESTONES.find((m) => prev < m && total_teachers >= m) ?? null

  return { total_teachers, active_teachers, total_students, milestone_hit }
}

export async function recordMetrics(): Promise<MetricsSnapshot> {
  const snapshot = await snapshotMetrics()

  await repos.analytics.insertAppMetrics({
    total_teachers:  snapshot.total_teachers,
    active_teachers: snapshot.active_teachers,
    total_students:  snapshot.total_students,
    milestone_hit:   snapshot.milestone_hit,
    notes: snapshot.milestone_hit
      ? `🎉 Milestone reached: ${snapshot.milestone_hit} teachers`
      : null,
  })

  if (snapshot.milestone_hit) {
    await notifyOwnerMilestone({
      milestone:      snapshot.milestone_hit,
      totalTeachers:  snapshot.total_teachers,
      activeTeachers: snapshot.active_teachers,
      totalStudents:  snapshot.total_students,
    })
  }

  return snapshot
}
