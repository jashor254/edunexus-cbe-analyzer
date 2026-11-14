import { z } from 'zod'

// Server-side contract for a report the owner asks us to share. This route has
// no first-party UI caller, so the payload is untrusted input: unknown keys are
// rejected (not silently dropped) and every field is bounded.
export const SHARE_TTL_DAYS = 30
// Hard ceiling, enforced independently by the shared_reports_expiry_cap CHECK
// in the database (20261104120000_shared_reports_token_boundary.sql).
export const SHARE_MAX_TTL_DAYS = 90
// Request-body ceiling, checked before parsing. The stored report is further
// capped by the shared_reports_report_size CHECK (16 KiB of jsonb text).
export const SHARE_MAX_BODY_BYTES = 32 * 1024

const line = z.string().trim().min(1).max(500)

export const SharedReportContentSchema = z.object({
  strengths:     z.array(line).max(10).default([]),
  priorityAreas: z.array(line).max(10).default([]),
  actionPlan:    z.array(line).max(10).default([]),
  subjectScores: z.record(z.string().regex(/^[a-z0-9_]{1,60}$/), z.number().int().min(1).max(4)).default({}),
  overallLevel:  z.number().int().min(1).max(4),
  overallLabel:  z.string().trim().max(40).optional(),
}).strict()

export type SharedReportContent = z.infer<typeof SharedReportContentSchema>

export const ShareGenerateSchema = z.object({
  studentId:  z.string().uuid(),
  reportData: SharedReportContentSchema,
}).strict()
