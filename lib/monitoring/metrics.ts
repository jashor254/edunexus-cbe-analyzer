// lib/monitoring/metrics.ts
import { createServiceClient } from '@/utils/supabase/service'
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
  const supabase = createServiceClient()
  const timestamp = new Date().toISOString()

  // Database check — ping teachers table with tight timeout
  const dbStart = Date.now()
  let dbStatus: HealthStatus = 'ok'
  try {
    const { error } = await supabase
      .from('teachers')
      .select('id')
      .limit(1)
      .single()
    // PGRST116 = no rows — that's fine, DB is up
    if (error && error.code !== 'PGRST116') dbStatus = 'degraded'
  } catch {
    dbStatus = 'down'
  }
  const dbLatency = Date.now() - dbStart

  // Auth check — verify service client can reach auth schema
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

  const overallStatus: HealthStatus =
    dbStatus === 'down' || authStatus === 'down'
      ? 'down'
      : dbStatus === 'degraded' || authStatus === 'degraded' || deepseekStatus === 'degraded'
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
  const supabase = createServiceClient()

  const [teachersResult, studentsResult, activeResult] = await Promise.all([
    supabase.from('teachers').select('id', { count: 'exact', head: true }),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const total_teachers = teachersResult.count ?? 0
  const total_students = studentsResult.count ?? 0
  const active_teachers = activeResult.count ?? 0

  // Check if we just crossed a milestone
  const { data: lastSnapshot } = await supabase
    .from('app_metrics')
    .select('total_teachers')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prev = lastSnapshot?.total_teachers ?? 0
  const milestone_hit =
    MILESTONES.find((m) => prev < m && total_teachers >= m) ?? null

  return { total_teachers, active_teachers, total_students, milestone_hit }
}

export async function recordMetrics(): Promise<MetricsSnapshot> {
  const supabase = createServiceClient()
  const snapshot = await snapshotMetrics()

  await supabase.from('app_metrics').insert({
    total_teachers: snapshot.total_teachers,
    active_teachers: snapshot.active_teachers,
    total_students: snapshot.total_students,
    milestone_hit: snapshot.milestone_hit,
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
