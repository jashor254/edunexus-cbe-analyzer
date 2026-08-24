// app/api/parent/gradebook/route.ts
// Sprint 5 (Parent Experience Convergence) — a parent-facing gradebook for
// one linked learner. Zero new grading logic: this resolves which classes
// the learner is on the roster of (class_students -> teacher_classes, the
// same join app/api/teacher/gradebook/[classId] itself reads from), then
// calls the exact same buildGradebook(classId, teacherId) that route calls,
// and returns only the one row belonging to this learner from each class's
// gradebook. No new scores, no new columns, no recomputation.
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication, requireParentOfLegacyStudent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { buildGradebook, type GradebookColumn, type GradebookRow } from '@/lib/gradebook/gradebook'
import { asStudentId } from '@/lib/core/identityTypes'

export type ParentGradebookClass = {
  classId: string
  className: string
  subject: string
  columns: GradebookColumn[]
  row: GradebookRow | null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId required')

    const supabase = await createClient()
    try {
      await requireAuthentication(supabase)
      // Parent Portal Phase P1: requireParentOfLegacyStudent (not bare
      // requireParent) so an institutional-only guardian — linked via
      // learner_guardians, never students.parent_user_id — is recognized
      // for this bridged compatibility studentId (P0 §26 follow-up).
      await requireParentOfLegacyStudent(supabase, asStudentId(studentId))  // trust origin: class_students.student_id → students
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const db = createServiceClient()
    const { data: rosterRows, error } = await db
      .from('class_students')
      .select('class_id, teacher_classes(id, name, subject, teacher_id)')
      .eq('student_id', studentId)
    if (error) throw new Error(`parent gradebook roster lookup: ${error.message}`)

    type RosterRow = { class_id: string; teacher_classes: { id: string; name: string; subject: string; teacher_id: string } | { id: string; name: string; subject: string; teacher_id: string }[] | null }
    const classes = ((rosterRows ?? []) as RosterRow[])
      .map(r => (Array.isArray(r.teacher_classes) ? r.teacher_classes[0] : r.teacher_classes))
      .filter((c): c is { id: string; name: string; subject: string; teacher_id: string } => !!c)

    const classGradebooks: ParentGradebookClass[] = await Promise.all(
      classes.map(async cls => {
        const gradebook = await buildGradebook(cls.id, cls.teacher_id)
        const row = gradebook.rows.find(r => r.studentId === studentId) ?? null
        return { classId: cls.id, className: cls.name, subject: cls.subject, columns: gradebook.columns, row }
      })
    )

    return apiSuccess({ classes: classGradebooks })
  } catch (e: unknown) {
    console.error('[parent/gradebook GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
