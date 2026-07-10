import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { HOLIDAY_BATCH_JOB_TYPE } from '../route'

// Polled by the Holiday Planner UI while a batch is generating, and once on
// tab-load to reconnect to an in-flight (or just-finished) batch after a
// page reload — see HOTFIX 2 in the pilot-readiness sprint. A teacher who
// starts a 45-student batch, leaves the tab, and comes back must see real
// progress, not the empty "Generate Plans" button again.
export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiUnauthorized()

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  const classId = searchParams.get('classId')

  if (jobId) {
    const job = await repos.jobs.findStatusForUser(jobId, user.id)
    if (!job) return apiNotFound('No matching job')
    return apiSuccess(job)
  }

  if (classId) {
    const job = await repos.jobs.findLatestJobForUser(user.id, HOLIDAY_BATCH_JOB_TYPE, { classId })
    if (!job) return apiSuccess(null)
    return apiSuccess(job)
  }

  return apiBadRequest('Provide jobId or classId')
}
