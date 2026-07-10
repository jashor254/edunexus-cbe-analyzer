import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { CLASS_REPORTS_JOB_TYPE } from '../route'

// Polled while a class's reports are generating, and once on page load to
// reconnect after a reload — same pattern as
// app/api/holiday/generate/status/route.ts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiUnauthorized()

  const { classId } = await params
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  if (jobId) {
    const job = await repos.jobs.findStatusForUser(jobId, user.id)
    if (!job) return apiNotFound('No matching job')
    return apiSuccess(job)
  }

  const job = await repos.jobs.findLatestJobForUser(user.id, CLASS_REPORTS_JOB_TYPE, { classId })
  return apiSuccess(job ?? null)
}
