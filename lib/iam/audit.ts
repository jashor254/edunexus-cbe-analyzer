// lib/iam/audit.ts
// Write immutable audit log entries. Always use the service client.
import { repos } from '@/lib/repositories'
import type { AuditLogRow, AuditLogOptions } from '@/lib/repositories/analytics.repository'

export type AuditLogEntry = {
  organization_id?: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an immutable audit log entry.
 * Never throws — audit log failures must not break the primary operation.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await repos.analytics.insertAuditLog(entry)
  } catch {
    // Audit log writes are best-effort — never surface to callers
  }
}

/**
 * Read audit log entries for an organization.
 * Caller's permission is checked by the RLS policy (owner/admin only).
 */
export async function getAuditLog(
  organizationId: string,
  options?: AuditLogOptions,
): Promise<AuditLogRow[]> {
  return repos.analytics.getAuditLogs(organizationId, options)
}
