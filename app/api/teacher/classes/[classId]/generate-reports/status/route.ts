import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { CLASS_REPORTS_JOB_TYPE } from '../route'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

// ARCHITECTURAL FINDING (Sprint 1B Batch C): unlike every other route in this
// batch, this one performs no `teacher_classes` ownership check at all — it
// relies entirely on `repos.jobs.findStatusForUser`/`findLatestJobForUser`
// scoping by `user.id`. `classId` is used only as a filter, never verified
// against teacher ownership. Preserved exactly (not a new gap introduced by
// this migration — pre-existing), flagged here rather than silently fixed,
// per this sprint's "do not improve, only replace duplicated auth" scope.

// Polled while a class's reports are generating, and once on page load to
// reconnect after a reload — same pattern as
// app/api/holiday/generate/status/route.ts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
): Promise<Response> {
  const supabase = await createClient()
  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    throw err
  }

  const { classId } = await params
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  if (jobId) {
    const job = await repos.jobs.findStatusForUser(jobId, userId)
    if (!job) return apiNotFound('No matching job')
    return apiSuccess(job)
  }

  const job = await repos.jobs.findLatestJobForUser(userId, CLASS_REPORTS_JOB_TYPE, { classId })
  return apiSuccess(job ?? null)
}
