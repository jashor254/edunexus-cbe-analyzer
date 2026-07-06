// app/api/eils/profile/[studentId]/route.ts
// GET /api/eils/profile/:studentId
// Returns the full unified IntelligenceSnapshot for a student.
// Teachers can query their students; parents can query their own child.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { buildIntelligenceSnapshot } from '@/_frozen/eils'

const QuerySchema = z.object({
  grade: z.coerce.number().int().min(1).max(12),
})

export async function GET(
  req:     Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params
    const url           = new URL(req.url)
    const parsed        = QuerySchema.safeParse({ grade: url.searchParams.get('grade') })
    if (!parsed.success) return apiError('grade query param required (1–12)', 400)

    const { grade } = parsed.data
    const db        = createServiceClient()

    // Authorization: must be a teacher with this student in their class,
    // OR a parent of this student, OR an admin.
    const [teacherRes, parentRes] = await Promise.all([
      db.from('class_enrollments')
        .select('class_id, teacher_classes!inner(teacher_id, teachers!inner(user_id))')
        .eq('student_id', studentId)
        .limit(1),
      db.from('learners')
        .select('parent_user_id')
        .eq('id', studentId)
        .single(),
    ])

    const parentUserId  = parentRes.data?.parent_user_id
    const teacherRows   = teacherRes.data ?? []
    const isParent      = parentUserId === user.id
    const isTeacher     = teacherRows.some(row => {
      const tc = row.teacher_classes as { teachers?: { user_id?: string } } | null
      return tc?.teachers?.user_id === user.id
    })

    if (!isParent && !isTeacher) return apiForbidden()

    const snapshot = await buildIntelligenceSnapshot(studentId, grade)
    return apiSuccess(snapshot)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build intelligence snapshot')
  }
}
