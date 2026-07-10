// POST /api/teacher/assessments/topical
// A fast, single-topic check — one subject, one strand/topic, rate the whole
// class 1-4. Meant to be quick enough that teachers actually do it between
// term assessments, unlike the full multi-subject assessment form.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { recordTopicalAssessment } from '@/lib/assessments/topical'
import { recordTopicalEvidence } from '@/lib/assessments/topicalEvidence'
import { KE_CBC } from '@/lib/curriculum/regional/ke-cbc'

const Schema = z.object({
  classId: z.string().uuid(),
  subject: z.string().min(1),
  strand:  z.string().min(1),
  topic:   z.string().min(1),
  ratings: z.array(z.object({
    studentId: z.string().uuid(),
    rating:    z.number().int().min(1).max(4),
  })).min(1),
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

    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const d = parsed.data

    // Verify this teacher owns the class
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', d.classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    // Verify every rated student belongs to this class
    const { data: classStudents } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', d.classId)
    const validStudentIds = new Set((classStudents ?? []).map(cs => cs.student_id as string))
    if (d.ratings.some(r => !validStudentIds.has(r.studentId))) {
      return apiForbidden()
    }

    const now = new Date()
    const term = KE_CBC.getCurrentTerm(now)
    const year = now.getFullYear()
    const ratings = d.ratings.map(r => ({ studentId: r.studentId, rating: r.rating as 1 | 2 | 3 | 4 }))

    const result = await recordTopicalAssessment({
      classId:   d.classId,
      teacherId: teacher.id,
      subject:   d.subject,
      strand:    d.strand,
      topic:     d.topic,
      term,
      year,
      ratings,
    })

    recordTopicalEvidence({
      teacherId:     teacher.id,
      teacherUserId: user.id,
      subject:       d.subject,
      strand:        d.strand,
      topic:         d.topic,
      term,
      year,
      ratings,
    }).catch(err => console.error('[teacher/assessments/topical] evidence emission failed', err))

    return apiSuccess(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/assessments/topical]', msg)
    return apiError('Failed to record topical assessment')
  }
}
