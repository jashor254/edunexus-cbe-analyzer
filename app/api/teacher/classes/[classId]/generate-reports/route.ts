// app/api/teacher/classes/[classId]/generate-reports/route.ts
import { NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateClassReports, type ClassReportProgress } from '@/lib/career/autoReportGenerator'
import { repos } from '@/lib/repositories'

export const dynamic = 'force-dynamic'

export const CLASS_REPORTS_JOB_TYPE = 'ai.class_reports.generate'

const BodySchema = z.object({
  assessmentIds: z.array(z.string().uuid()).min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const db = createServiceClient()

    // Verify teacher owns this class
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const { classId } = await params

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()

    if (!cls) return apiForbidden()

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('assessmentIds array required')

    const { assessmentIds } = parsed.data

    const { count: classSize } = await db
      .from('class_students')
      .select('student_id', { count: 'exact', head: true })
      .eq('class_id', classId)
    const total = classSize ?? 0

    if (total === 0) return apiSuccess({ success: 0, failed: 0, total: 0, results: [] })

    // Same pattern as Holiday Planner (see app/api/holiday/generate/route.ts):
    // a full class of students, each needing its own DeepSeek call, does not
    // fit inside one request/response. Inserted already `processing` in a
    // single write to avoid the cron job-processor claiming a `queued` row
    // for a job type it has no handler for.
    const { data: job, error: jobErr } = await db
      .from('jobs')
      .insert({
        queue_name: 'ai.generation',
        type:       CLASS_REPORTS_JOB_TYPE,
        user_id:    user.id,
        status:     'processing',
        started_at: new Date().toISOString(),
        payload:    { classId, assessmentIds, total },
        result:     { total, completed: 0, currentStudentName: null },
      })
      .select('id')
      .single()
    if (jobErr || !job) return apiError('Could not start report generation')

    after(async () => {
      try {
        const result = await generateClassReports(classId, assessmentIds, db, async (progress: ClassReportProgress) => {
          await repos.jobs.updateProgress(job.id, {
            result: { total: progress.total, completed: progress.completed, currentStudentName: progress.currentStudentName },
          })
        })
        await repos.jobs.markComplete(job.id, {
          total,
          completed: total,
          currentStudentName: null,
          success: result.success,
          failed:  result.failed,
          failedStudents: result.results.filter(r => r.status === 'error').map(r => ({ studentId: r.student_id, studentName: r.student_name, reason: r.error ?? 'Unknown error' })),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await repos.jobs.updateProgress(job.id, { status: 'failed', result: { total, completed: 0, currentStudentName: null, errorMessage: message } })
      }
    })

    return apiSuccess({ jobId: job.id, total })
  } catch (err) {
    console.error('[generate-reports]', err)
    return apiError('Failed to generate reports')
  }
}
