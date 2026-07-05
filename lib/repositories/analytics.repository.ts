// lib/repositories/analytics.repository.ts
// Handles all DB operations for analytics, AI call logging, audit logs, and metrics.

import { BaseRepository } from './base'
import type { AICallLog } from '@/lib/ai/logger'
import type { AuditLogEntry } from '@/lib/iam/audit'
import type { MetricsSnapshot } from '@/lib/monitoring/metrics'
import type { RecordUsageParams } from '@/lib/infrastructure/analytics'
import type { RequestContext } from '@/lib/environment/types'

// ── Column constants ──────────────────────────────────────────────────────────

const AI_CALL_LOG_COLS = 'feature, model, prompt, response, latency_ms, token_count, success, error, user_id, created_at' as const

const APP_METRICS_COLS = 'total_teachers, active_teachers, total_students, milestone_hit, notes' as const

const APP_METRICS_SELECT_COLS = 'total_teachers' as const

const AUDIT_LOG_SELECT_COLS = 'id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, metadata, created_at' as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type AuditLogOptions = {
  limit?: number
  offset?: number
  action?: string
  resource_type?: string
  from?: string
  to?: string
}

export type AppMetricsInsert = {
  total_teachers: number
  active_teachers: number
  total_students: number
  milestone_hit: number | null
  notes: string | null
}

export class AnalyticsRepository extends BaseRepository {
  // ── AI call logs ────────────────────────────────────────────────────────────

  async insertAICallLog(log: AICallLog): Promise<void> {
    const { error } = await this.db.from('ai_call_logs').insert({
      feature:     log.feature,
      model:       log.model,
      prompt:      log.prompt.substring(0, 500),
      response:    log.response?.substring(0, 500),
      latency_ms:  log.latencyMs,
      token_count: log.tokenCount,
      success:     log.success,
      error:       log.error,
      user_id:     log.userId,
      created_at:  new Date().toISOString(),
    })

    if (error) throw new Error(`Failed to insert AI call log: ${error.message}`)
  }

  // ── App metrics ─────────────────────────────────────────────────────────────

  async getLatestMetricsTeacherCount(): Promise<number> {
    const { data, error } = await this.db
      .from('app_metrics')
      .select(APP_METRICS_SELECT_COLS)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch latest metrics: ${error.message}`)

    return (data?.total_teachers as number | null) ?? 0
  }

  async insertAppMetrics(snapshot: AppMetricsInsert): Promise<void> {
    const { error } = await this.db.from('app_metrics').insert({
      total_teachers:  snapshot.total_teachers,
      active_teachers: snapshot.active_teachers,
      total_students:  snapshot.total_students,
      milestone_hit:   snapshot.milestone_hit,
      notes:           snapshot.notes,
    })

    if (error) throw new Error(`Failed to insert app metrics: ${error.message}`)
  }

  // ── Teacher / student counts ────────────────────────────────────────────────

  async countTeachers(): Promise<number> {
    const { count, error } = await this.db
      .from('teachers')
      .select('id', { count: 'exact', head: true })

    if (error) throw new Error(`Failed to count teachers: ${error.message}`)
    return count ?? 0
  }

  async countActiveTeachers(since: string): Promise<number> {
    const { count, error } = await this.db
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    if (error) throw new Error(`Failed to count active teachers: ${error.message}`)
    return count ?? 0
  }

  async countStudents(): Promise<number> {
    const { count, error } = await this.db
      .from('students')
      .select('id', { count: 'exact', head: true })

    if (error) throw new Error(`Failed to count students: ${error.message}`)
    return count ?? 0
  }

  // ── Audit logs ──────────────────────────────────────────────────────────────

  async insertAuditLog(entry: AuditLogEntry): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert({
      organization_id: entry.organization_id ?? null,
      user_id:         entry.user_id ?? null,
      action:          entry.action,
      resource_type:   entry.resource_type,
      resource_id:     entry.resource_id ?? null,
      old_values:      entry.old_values ?? null,
      new_values:      entry.new_values ?? null,
      ip_address:      entry.ip_address ?? null,
      user_agent:      entry.user_agent ?? null,
      metadata:        entry.metadata ?? {},
    })

    if (error) throw new Error(`Failed to insert audit log: ${error.message}`)
  }

  async getAuditLogs(
    organizationId: string,
    options?: AuditLogOptions,
  ): Promise<AuditLogRow[]> {
    const limit  = options?.limit ?? 50
    const offset = options?.offset ?? 0

    let query = this.db
      .from('audit_logs')
      .select(AUDIT_LOG_SELECT_COLS)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (options?.action)        query = query.eq('action', options.action)
    if (options?.resource_type) query = query.eq('resource_type', options.resource_type)
    if (options?.from)          query = query.gte('created_at', options.from)
    if (options?.to)            query = query.lte('created_at', options.to)

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch audit log: ${error.message}`)

    return (data ?? []).map(row => ({
      ...row,
      old_values: row.old_values as Record<string, unknown> | null,
      new_values: row.new_values as Record<string, unknown> | null,
      metadata:   row.metadata   as Record<string, unknown>,
    }))
  }

  // ── Usage events ────────────────────────────────────────────────────────────

  async insertUsageEvent(
    ctx: RequestContext,
    params: RecordUsageParams,
  ): Promise<void> {
    const { error } = await this.db.from('usage_events').insert({
      organization_id: ctx.orgId,
      user_id:         ctx.userId ?? null,
      api_key_id:      ctx.apiKeyId,
      event_type:      params.event_type,
      resource:        params.resource ?? null,
      quantity:        params.quantity ?? 1,
      cost_tokens:     params.cost_tokens ?? 0,
      cost_units:      params.cost_units ?? 0,
      environment:     ctx.environment,
      metadata: {
        ...params.metadata,
        request_id:         ctx.requestId,
        include_in_reports: ctx.environmentConfig.analytics.includeInReports,
      },
    })

    if (error) throw new Error(`Failed to insert usage event: ${error.message}`)
  }

  // ── Health ping ─────────────────────────────────────────────────────────────

  async pingDatabase(): Promise<void> {
    const { error } = await this.db
      .from('teachers')
      .select('id')
      .limit(1)
      .single()

    // PGRST116 = no rows — DB is up, that is fine
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database ping failed: ${error.message}`)
    }
  }

  async countAICallsByFeature(userId: string, feature: string, since: string): Promise<number> {
    const { count, error } = await this.db
      .from('ai_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature', feature)
      .eq('success', true)
      .gte('created_at', since)

    if (error) return 0
    return count ?? 0
  }
}
