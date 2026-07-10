import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { repos } from '@/lib/repositories'

// Polled by app/teacher/scheme-of-work/new/page.tsx while a scheme
// generates in the background — see app/api/sow/generate/route.ts. Same
// pattern as the Holiday Planner and class report status endpoints.
export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiUnauthorized()

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return apiBadRequest('jobId is required')

  const job = await repos.jobs.findStatusForUser(jobId, user.id)
  if (!job) return apiNotFound('No matching job')
  return apiSuccess(job)
}
