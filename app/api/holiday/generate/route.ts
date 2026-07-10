import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateHolidayPlan, generateClassHolidayPlans, type HolidayBatchProgress } from '@/lib/holiday/planner'
import { KE_CBC } from '@/lib/curriculum/regional/ke-cbc'
import { repos } from '@/lib/repositories'

export const HOLIDAY_BATCH_JOB_TYPE = 'ai.holiday_plan.generate'

// term/year are derived server-side (like /api/teacher/assessments/topical)
// rather than required from the client — the Holiday Planner UI never
// collected them, which meant every request here previously failed
// validation before this fix.
const SingleSchema = z.object({
  studentId:     z.string().uuid(),
  holidayPeriod: z.string().min(1),
  holidayDays:   z.number().int().min(1).max(90),
  schoolId:      z.string().uuid().optional(),
})

const ClassSchema = z.object({
  classId:       z.string().uuid(),
  holidayPeriod: z.string().min(1),
  holidayDays:   z.number().int().min(1).max(90),
  schoolId:      z.string().uuid().optional(),
  // "Retry Failed Only" passes just the students that failed last time —
  // omit to (re)generate for the whole class roster.
  studentIds:    z.array(z.string().uuid()).optional(),
})

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const body = await req.json()
    const now  = new Date()
    const term = KE_CBC.getCurrentTerm(now)
    const year = now.getFullYear()

    // Class-level generation
    if (body.classId) {
      const parsed = ClassSchema.safeParse(body)
      if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

      // Verify teacher owns this class
      const { data: cls } = await db
        .from('teacher_classes')
        .select('id')
        .eq('id', parsed.data.classId)
        .eq('teacher_id', teacher.id)
        .maybeSingle()
      if (!cls) return apiForbidden()

      const enrollment = await repos.learnerIntelligence.getClassEnrollment(parsed.data.classId)

      // "Retry Failed Only" sends back a subset of studentIds — confirm every
      // one of them is actually enrolled in this class before generating,
      // rather than trusting whatever the client sends.
      if (parsed.data.studentIds?.some(id => !enrollment.includes(id))) {
        return apiForbidden()
      }

      const total = parsed.data.studentIds?.length ?? enrollment.length

      if (total === 0) {
        return apiSuccess({ term, year, generated: 0, failed: 0, total: 0, results: [] })
      }

      // A batch this size (up to a full 45-student roster, each student a
      // multi-second AI call) does not fit inside one request/response —
      // create a trackable job immediately and hand the actual work to
      // `after()`, which keeps running server-side even if the teacher
      // navigates away. The client polls GET /api/holiday/generate/status
      // for live progress and can resume polling after a reload because the
      // progress lives in the `jobs` row, not in page state.
      // Inserted already `processing` (not the default `queued`) in a single
      // write — going through the default `queued` status and flipping it a
      // moment later would open a race where the cron job-processing worker
      // (app/api/cron/jobs/process/route.ts) could claim it in between, and
      // no handler is registered for this job type, so it would immediately
      // fail and clobber the progress this route is about to write.
      const { data: job, error: jobErr } = await db
        .from('jobs')
        .insert({
          // queue_name has an FK to job_queues — 'ai.generation' already
          // exists ("AI content generation (SOW, lessons, assessments)") and
          // fits; nothing polls this queue for us (see `after()` below), so
          // the queue's own concurrency/timeout settings don't apply here,
          // but the FK still requires a real row.
          queue_name:  'ai.generation',
          type:        HOLIDAY_BATCH_JOB_TYPE,
          user_id:     user.id,
          status:      'processing',
          started_at:  new Date().toISOString(),
          payload:     { classId: parsed.data.classId, holidayPeriod: parsed.data.holidayPeriod, holidayDays: parsed.data.holidayDays, total },
          result:      { total, completed: 0, generated: 0, failed: 0, currentStudentName: null, failedStudents: [] },
        })
        .select('id')
        .single()
      if (jobErr || !job) return apiError('Could not start holiday plan generation')

      after(async () => {
        try {
          const results = await generateClassHolidayPlans(
            parsed.data.classId,
            {
              teacherId:     teacher.id,
              term,
              year,
              holidayPeriod: parsed.data.holidayPeriod,
              holidayDays:   parsed.data.holidayDays,
              schoolId:      parsed.data.schoolId,
            },
            async (progress: HolidayBatchProgress) => {
              await repos.jobs.updateProgress(job.id, {
                result: {
                  total:               progress.total,
                  completed:           progress.completed,
                  generated:           progress.generated,
                  failed:              progress.failed,
                  currentStudentName:  progress.phase === 'started' ? progress.currentStudentName : null,
                  failedStudents:      progress.failedStudents,
                },
              })
            },
            parsed.data.studentIds,
          )

          await repos.jobs.markComplete(job.id, {
            total,
            generated: results.filter(r => r.plan !== null).length,
            failed:    results.filter(r => r.plan === null).length,
            completed: total,
            currentStudentName: null,
            failedStudents: results.filter(r => r.plan === null).map(r => ({ studentId: r.studentId, studentName: r.studentName, reason: r.error ?? 'Unknown error' })),
            results: results.map(r => ({ studentId: r.studentId, studentName: r.studentName, success: r.plan !== null })),
          })
        } catch (e) {
          // Not routed through markFailed()/dead_letter — that models the
          // cron worker's automatic-retry queue, which nothing replays this
          // job through. A flat 'failed' status is what the status endpoint
          // and UI actually check for.
          const message = e instanceof Error ? e.message : String(e)
          await repos.jobs.updateProgress(job.id, { status: 'failed', result: { total, completed: 0, generated: 0, failed: total, currentStudentName: null, failedStudents: [], errorMessage: message } })
        }
      })

      return apiSuccess({ jobId: job.id, term, year, total })
    }

    // Single student generation
    const parsed = SingleSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const plan = await generateHolidayPlan({
      studentId:     parsed.data.studentId,
      teacherId:     teacher.id,
      term,
      year,
      holidayPeriod: parsed.data.holidayPeriod,
      holidayDays:   parsed.data.holidayDays,
      schoolId:      parsed.data.schoolId,
    })

    return apiSuccess({ plan, term, year })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[holiday/generate]', msg)
    return apiError('Failed to generate holiday plan')
  }
}

// Fetches the actual generated plan content (WhatsApp message, weeks,
// parent summary) for a class once a batch has completed — the batch job's
// progress record (see status/route.ts) only tracks counts, not full plan
// bodies for every student.
export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('classId')
    if (!classId) return apiBadRequest('classId is required')

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    const now  = new Date()
    const term = KE_CBC.getCurrentTerm(now)
    const year = now.getFullYear()

    const enrollment = await repos.learnerIntelligence.getClassEnrollment(classId)
    const [names, planRows] = await Promise.all([
      repos.learnerIntelligence.getStudentNamesByIds(enrollment),
      repos.learnerIntelligence.findHolidayPlansForStudents(enrollment, term, year),
    ])
    const nameById = new Map(names.map(n => [n.id, n.name?.trim() || n.id]))

    const plans = planRows.map(row => ({
      studentId:      row.student_id,
      studentName:    nameById.get(row.student_id) ?? row.student_id,
      message:        row.plan_data.whatsapp_message ?? '',
      weeks:          row.plan_data.weeks ?? [],
      parent_summary: row.plan_data.parent_summary ?? '',
      published:      row.is_published,
    }))

    return apiSuccess({ term, year, plans })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[holiday/generate GET]', msg)
    return apiError('Could not load holiday plans')
  }
}
