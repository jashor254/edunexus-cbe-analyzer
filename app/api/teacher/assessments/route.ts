import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest,
} from '@/lib/api/response'
import { getTeacherAssessments, getClassAssessments, createAssessment } from '@/lib/assessments/queries'

const CreateSchema = z.object({
  classId:        z.uuid(),
  title:          z.string().min(1).max(200),
  assessmentType: z.enum(['exam', 'cat', 'midterm', 'endterm', 'opener', 'assignment']),
  term:           z.enum(['1', '2', '3']),
  year:           z.number().int().min(2020).max(2100),
  maxScore:       z.number().int().min(1).max(1000).default(100),
  subjects:       z.array(z.string().min(1)).min(1),
  curriculumType: z.enum(['cbc', '844']).default('cbc'),
  gradeScaleId:   z.uuid().nullable().optional(),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const classId = new URL(req.url).searchParams.get('classId')
    const assessments = classId
      ? await getClassAssessments(classId, teacher.id)
      : await getTeacherAssessments(teacher.id)

    return apiSuccess({ assessments })
  } catch (e: any) {
    console.error('[teacher/assessments GET]', e.message)
    return apiError('Failed to fetch assessments')
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const parsed = CreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const { classId, title, assessmentType, term, year, maxScore, subjects, curriculumType, gradeScaleId } = parsed.data

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!cls) return apiForbidden()

    const assessment = await createAssessment(teacher.id, classId, {
      title, assessmentType, term, year, maxScore, subjects, curriculumType, gradeScaleId,
    })
    return apiSuccess({ assessment }, 201)
  } catch (e: any) {
    console.error('[teacher/assessments POST]', e.message)
    return apiError('Failed to create assessment')
  }
}
