// lib/repositories/sharedReport.repository.ts
// All DB access for public.shared_reports bearer-token sharing (DSA-01).
// Deliberately NOT registered in the `repos` barrel: the public share page must
// not pull in every repository's eager service-client construction.

import { BaseRepository } from './base'

export type SharedReportRpcRow = {
  status: string
  student_name: string | null
  grade: string | null
  report_data: unknown
  created_at: string | null
  expires_at: string | null
  provenance: string | null
}

export class SharedReportRepository extends BaseRepository {
  async findByToken(token: string): Promise<SharedReportRpcRow | null> {
    const { data, error } = await this.db.rpc('get_shared_report_by_token', { p_token: token })
    if (error) {
      throw new Error(`Failed to look up shared report: ${error.message}`)
    }
    const rows = (data ?? []) as SharedReportRpcRow[]
    return rows[0] ?? null
  }

  /** Marks the caller's own report revoked. Returns false if nothing matched. */
  async revokeOwned(token: string, ownerId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('shared_reports')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token)
      .eq('user_id', ownerId)
      .is('revoked_at', null)
      .select('id')
    if (error) {
      throw new Error(`Failed to revoke shared report: ${error.message}`)
    }
    return (data ?? []).length > 0
  }
}
