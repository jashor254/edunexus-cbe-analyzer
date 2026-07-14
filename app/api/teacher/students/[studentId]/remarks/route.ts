import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { recordRemarkEvidence, getRemarksForStudent } from '@/lib/remarks/evidence'
import { reserveIdempotencyKey } from '@/lib/idempotency/reserveKey'

// Phase C (docs/architecture/learner-record-layer-decisions.md Decision 1).
// No UI yet — API surface only, same confirmed 2026-07-13 scope pattern as
// Phase A/B.
const RemarkSchema = z.object({
  body:         z.string().min(1).max(2000),
  subject:      z.string().min(1).max(100).nullable().optional(),
  term:         z.number().int().min(1).max(3).nullable().optional(),
  academicYear: z.number().int().min(2020).max(2100),
})

async function verifyTeacherTeachesStudent(
  db: ReturnType<typeof createServiceClient>,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const { data } = await db
    .from('class_students')
    .select('class_id, teacher_classes!inner(teacher_id)')
    .eq('student_id', studentId)
    .eq('teacher_classes.teacher_id', teacherId)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id, full_name').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: student } = await db.from('students').select('id, name').eq('id', studentId).maybeSingle()
    if (!student) return apiNotFound('Student not found')

    if (!(await verifyTeacherTeachesStudent(db, teacher.id, studentId))) {
      return apiNotFound('Student not found in any of your classes')
    }

    const parsed = RemarkSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    const { body, subject, term, academicYear } = parsed.data

    // Production Hardening Audit finding: a remark is permanent, immutable
    // Evidence (CLAUDE.md) — a retried request (double-click, network
    // retry) had no guard and would silently create a second, indistinct
    // remark forever. Idempotency-Key is optional; callers that don't send
    // one keep today's exact behavior.
    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey && !(await reserveIdempotencyKey('teacher_remark', idempotencyKey))) {
      return apiSuccess({ recorded: true }, 200)
    }

    await recordRemarkEvidence({
      studentId,
      studentName: student.name,
      teacherId: teacher.id,
      initiatedByUserId: user.id,
      body,
      subject: subject ?? null,
      term: term ?? null,
      academicYear,
    })
    return apiSuccess({ recorded: true }, 201)
  } catch (e: unknown) {
    console.error('[teacher/students/remarks POST]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to record remark')
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    if (!(await verifyTeacherTeachesStudent(db, teacher.id, studentId))) {
      return apiNotFound('Student not found in any of your classes')
    }

    const remarks = await getRemarksForStudent(studentId)
    return apiSuccess({ remarks })
  } catch (e: unknown) {
    console.error('[teacher/students/remarks GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch remarks')
  }
}
