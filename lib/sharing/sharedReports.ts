// lib/sharing/sharedReports.ts
//
// The ONLY read path for public.shared_reports. A share token grants access
// to exactly the one report it identifies — nothing else.
//
// Before this module, app/shared/[token]/page.tsx read the table with the
// user-scoped client, which only worked because the table carried an
// always-true public SELECT policy ("Anyone can read shared reports",
// production migration 20260327105501). That policy let anyone holding the
// public anon key list EVERY shared report — learner names, grades, scores,
// action plans — straight from /rest/v1/shared_reports, expired rows
// included. The policy is dropped by
// supabase/migrations/20261030120000_shared_reports_close_public_read.sql;
// this lookup replaces it with a server-side, exact-token read.

import { createServiceClient } from '@/utils/supabase/service'

// Current tokens are 12 uppercase hex chars (app/api/share/generate). The
// shape check is deliberately looser than that, so any older link that was
// ever issued keeps working — the security property comes from the exact
// `.eq('token', …)` match below, not from this pattern. It only stops
// obviously malformed input from reaching the database.
const SHARE_TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,64}$/

/** Exactly the columns the public share page renders — never user_id, student_id or token. */
const SHARED_REPORT_COLUMNS = 'student_name, grade, report_data, created_at, expires_at'

export type SharedReport = {
  studentName: string
  grade: string
  reportData: unknown
  createdAt: string
  expiresAt: string
}

export type SharedReportLookup =
  | { status: 'found'; report: SharedReport }
  // An expired report returns no content at all — the page shows its
  // "link expired" screen without the report ever leaving the server.
  | { status: 'expired' }
  | { status: 'not_found' }

type SharedReportRow = {
  student_name: string
  grade:        string
  report_data:  unknown
  created_at:   string
  expires_at:   string
}

type SharedReportDeps = {
  /** Injected only by tests — production always uses the service client. */
  db?:  ReturnType<typeof createServiceClient>
  now?: Date
}

export async function getSharedReportByToken(
  token: string,
  deps: SharedReportDeps = {}
): Promise<SharedReportLookup> {
  if (!SHARE_TOKEN_SHAPE.test(token)) return { status: 'not_found' }

  const db  = deps.db ?? createServiceClient()
  const now = deps.now ?? new Date()

  const { data, error } = await db
    .from('shared_reports')
    .select(SHARED_REPORT_COLUMNS)
    .eq('token', token)
    .maybeSingle()

  // Never include the token in the message — it is the credential.
  if (error) throw new Error(`getSharedReportByToken: lookup failed: ${error.message}`)
  const row = data as SharedReportRow | null
  if (!row) return { status: 'not_found' }

  if (new Date(row.expires_at).getTime() <= now.getTime()) return { status: 'expired' }

  return {
    status: 'found',
    report: {
      studentName: row.student_name,
      grade:       row.grade,
      reportData:  row.report_data,
      createdAt:   row.created_at,
      expiresAt:   row.expires_at,
    },
  }
}
