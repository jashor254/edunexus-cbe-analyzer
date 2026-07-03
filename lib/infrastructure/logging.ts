// lib/infrastructure/logging.ts
// Request-level audit logging.
// Reads ctx.environmentConfig.logging.persistToAudit —
// non-persisting environments write to console only at the configured level.

import type { RequestContext } from '@/lib/environment/types'

export type LogRequestParams = {
  action:        string
  resource_type: string
  resource_id?:  string
  metadata?:     Record<string, unknown>
}

export async function logRequest(
  ctx: RequestContext,
  params: LogRequestParams
): Promise<void> {
  const { logging } = ctx.environmentConfig
  const entry = {
    requestId:     ctx.requestId,
    environment:   ctx.environment,
    orgId:         ctx.orgId,
    action:        params.action,
    resource_type: params.resource_type,
    resource_id:   params.resource_id,
    ...params.metadata,
  }

  if (!logging.persistToAudit) {
    if (logging.level === 'debug') console.debug('[infrastructure/logging]', entry)
    return
  }

  // Lazy import to avoid circular deps
  const { writeAuditLog } = await import('@/lib/iam/audit')
  await writeAuditLog({
    organization_id: ctx.orgId,
    user_id:         ctx.userId,
    action:          params.action,
    resource_type:   params.resource_type,
    resource_id:     params.resource_id,
    metadata:        { request_id: ctx.requestId, environment: ctx.environment, ...params.metadata },
  })
}
