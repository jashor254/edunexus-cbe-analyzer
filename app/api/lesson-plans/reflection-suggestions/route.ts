// POST: Generate 3 reflection suggestion options for a lesson plan
// Body: { planId: string }
// Returns: { suggestions: string[] }
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateReflectionSuggestions } from '@/lib/lessonPlan/generator'
import type { LessonPlanContext } from '@/lib/lessonPlan/types'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { planId } = await req.json()
    if (!planId) return apiBadRequest('planId required')

    const db = createServiceClient()

    const { data: plan, error } = await db
      .from('lesson_plans')
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, organisation_of_learning, introduction, step_1, step_2, step_3, conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at')
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .single()

    if (error || !plan) return apiForbidden()

    // Fetch SOW for teacher/school meta
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('school, grade, learning_area, term, year, teacher_name, tsc_number')
      .eq('id', plan.sow_id)
      .single()

    const ctx: LessonPlanContext = {
      teacherName: sow?.teacher_name || '',
      tscNumber: sow?.tsc_number || '',
      school: sow?.school || '',
      learningArea: sow?.learning_area || '',
      grade: sow?.grade || '',
      term: Number(sow?.term || 1),
      year: sow?.year || new Date().getFullYear(),
      weekNumber: plan.week_number,
      lessonNumber: plan.lesson_number,
      strand: plan.strand,
      subStrand: plan.sub_strand,
      learningOutcomes: (plan.learning_outcomes as string[]) || [],
      keyInquiryQuestions: (plan.key_inquiry_questions as string[]) || [],
      learningResources: (plan.learning_resources as string[]) || [],
      learningExperiences: [],
      assessmentMethods: [],
    }

    const taughtDate = plan.taught_date || new Date().toISOString().split('T')[0]
    const suggestions = await generateReflectionSuggestions(ctx, taughtDate)

    return apiSuccess({ suggestions })
  } catch (err: unknown) {
    console.error('[lesson-plans/reflection-suggestions]', err)
    return apiError(err instanceof Error ? err.message : 'Failed to generate suggestions')
  }
}
