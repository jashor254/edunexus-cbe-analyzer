// app/api/assessments/create/route.ts
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'

const CreateAssessmentSchema = z.object({
  student_id:              z.string().uuid(),
  grade:                   z.number().int().optional(),
  term:                    z.number().int().min(1).max(3),
  year:                    z.number().int(),
  grade_level:             z.enum(['junior', 'senior']).optional(),
  subject_scores:          z.record(z.string(), z.unknown()).refine(s => Object.keys(s).length >= 5, {
    message: 'At least 5 subject scores are required',
  }),
  curriculum_type:         z.string().optional(),
  assessment_style:        z.string().optional(),
  mathematics_type:        z.string().optional(),
  pathway_electives:       z.unknown().optional(),
  pathway_recommendations: z.unknown().optional(),
  source:                  z.enum(['teacher', 'parent']).optional(),
  raw_marks:               z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const parsed = CreateAssessmentSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const {
      student_id,
      grade,
      term,
      year,
      grade_level,
      subject_scores,
      curriculum_type,
      assessment_style,
      mathematics_type,
      pathway_electives,
      pathway_recommendations,
      source,
      raw_marks,
    } = parsed.data

    const service = createServiceClient()

    // Verify student belongs to this user
    const { data: student, error: studentError } = await service
      .from('students')
      .select('id, grade, curriculum_type')
      .eq('id', student_id)
      .eq('user_id', user.id)
      .single()

    if (studentError || !student) return apiBadRequest('Student not found or does not belong to you')

    const resolvedCurriculumType = curriculum_type ?? student.curriculum_type ?? 'cbc'
    const resolvedAssessmentStyle = assessment_style ?? 'formative'

    const { data: assessment, error: insertError } = await service
      .from('assessments')
      .insert({
        student_id,
        user_id:                 user.id,
        grade:                   grade ?? student.grade,
        term,
        year,
        grade_level:             grade_level ?? (student.grade <= 9 ? 'junior' : 'senior'),
        subject_scores,
        curriculum_type:         resolvedCurriculumType,
        assessment_style:        resolvedAssessmentStyle,
        mathematics_type:        mathematics_type ?? null,
        pathway_electives:       pathway_electives ?? null,
        pathway_recommendations: pathway_recommendations ?? null,
        source:                  source === 'teacher' ? 'teacher' : 'parent',
        raw_marks:               raw_marks ?? {},
      })
      .select()
      .single()

    if (insertError) {
      console.error('[assessments/create] insert error:', insertError)
      return apiError(insertError.message)
    }

    return apiSuccess({ assessment }, 201)
  } catch (err) {
    console.error('[assessments/create]', err)
    return apiError('Server error')
  }
}
