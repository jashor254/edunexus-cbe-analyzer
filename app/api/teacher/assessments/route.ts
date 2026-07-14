import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest,
} from '@/lib/api/response'
import { getTeacherAssessments, getClassAssessments } from '@/lib/assessments/getters'
import { createAssessment } from '@/lib/assessments/mutations'

const CreateSchema = z.object({
  classId:        z.uuid(),
  title:          z.string().min(1).max(200),
  // Phase B (docs/architecture/academic-evidence-layer.md §7, Rule 5):
  // no longer a hardcoded enum — school/teacher-configurable. The 6
  // previously-hardcoded values are still available to every existing
  // teacher (seeded as real assessment_types rows by the Phase B
  // migration); this just stops the API from being the thing that
  // permanently forecloses anything else a teacher — or curriculum,
  // or country — might ever call an assessment. Validated against the
  // teacher's own configured types by createAssessment's resolve-or-create
  // step, not here — an unknown name is registered, not rejected.
  assessmentType: z.string().min(1).max(50),
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

    const url     = new URL(req.url)
    const classId = url.searchParams.get('classId')
    const term    = url.searchParams.get('term') ?? undefined
    const yearRaw = url.searchParams.get('year')
    const year    = yearRaw ? parseInt(yearRaw, 10) : undefined

    const assessments = classId
      ? await getClassAssessments(classId, teacher.id)
      : await getTeacherAssessments(teacher.id, { term, year })

    return apiSuccess({ assessments })
  } catch (e: unknown) {
    console.error('[teacher/assessments GET]', e instanceof Error ? e.message : String(e))
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
  } catch (e: unknown) {
    console.error('[teacher/assessments POST]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to create assessment')
  }
}
