import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { promoteStudent, getPromotionHistory } from '@/lib/promotions/promote'
import { reserveIdempotencyKey } from '@/lib/idempotency/reserveKey'

// Production Hardening Audit finding: fromClassId/toClassId were accepted
// from the request body and used to write (student_promotions, then
// class_students) with no check that they belong to the requesting
// teacher — a teacher who legitimately teaches this student could target
// any class in the whole platform (IDOR). class_students/teacher_classes
// ownership is already the codebase's standard shape for "does this
// teacher own this class" (see promotion.repository.ts's archiveClass).
async function verifyTeacherOwnsClass(
  db: ReturnType<typeof createServiceClient>,
  teacherId: string,
  classId: string,
): Promise<boolean> {
  const { data } = await db
    .from('teacher_classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .maybeSingle()
  return !!data
}

// Phase A (docs/architecture/academic-evidence-layer.md §2, Rule 1: learner
// permanence). No UI yet — API surface only, per the confirmed 2026-07-13
// scope decision. Operates on one student + at most one class transition
// per call (see lib/promotions/promote.ts's scope note — teacher_classes
// is subject-scoped, so a full-schedule promotion is N calls, one per
// subject class, not one call).
const PromoteSchema = z.object({
  toGrade:      z.number().int().min(1).max(12),
  fromClassId:  z.uuid().nullable().optional(),
  toClassId:    z.uuid().nullable().optional(),
  academicYear: z.string().min(4).max(9),
  notes:        z.string().max(500).nullable().optional(),
})

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
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    // Ownership check: the student must be one this teacher currently
    // teaches (same class_students-scoped check as the rest of this app's
    // teacher-facing routes) — a promotion is not something any teacher
    // may perform on any learner.
    const { data: taught } = await db
      .from('class_students')
      .select('class_id, teacher_classes!inner(teacher_id)')
      .eq('student_id', studentId)
      .eq('teacher_classes.teacher_id', teacher.id)
      .limit(1)
      .maybeSingle()
    if (!taught) return apiNotFound('Student not found in any of your classes')

    const parsed = PromoteSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    const { toGrade, fromClassId, toClassId, academicYear, notes } = parsed.data

    if (fromClassId && !(await verifyTeacherOwnsClass(db, teacher.id, fromClassId))) {
      return apiForbidden()
    }
    if (toClassId && !(await verifyTeacherOwnsClass(db, teacher.id, toClassId))) {
      return apiForbidden()
    }

    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey && !(await reserveIdempotencyKey('student_promotion', idempotencyKey))) {
      const history = await getPromotionHistory(studentId)
      return apiSuccess({ promotion: history[history.length - 1] ?? null }, 200)
    }

    const promotion = await promoteStudent({
      studentId,
      toGrade,
      fromClassId: fromClassId ?? null,
      toClassId: toClassId ?? null,
      academicYear,
      promotedBy: user.id,
      notes: notes ?? null,
    })
    return apiSuccess({ promotion }, 201)
  } catch (e: unknown) {
    console.error('[teacher/students/promote POST]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to promote student')
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

    const { data: taught } = await db
      .from('class_students')
      .select('class_id, teacher_classes!inner(teacher_id)')
      .eq('student_id', studentId)
      .eq('teacher_classes.teacher_id', teacher.id)
      .limit(1)
      .maybeSingle()
    if (!taught) return apiNotFound('Student not found in any of your classes')

    const history = await getPromotionHistory(studentId)
    return apiSuccess({ history })
  } catch (e: unknown) {
    console.error('[teacher/students/promote GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch promotion history')
  }
}
