import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound,
} from '@/lib/api/response'
import { getAssessmentContext } from '@/lib/assessments/getters'
import { updateAssessment } from '@/lib/assessments/mutations'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const ctx = await getAssessmentContext(assessmentId, teacher.id)
    if (!ctx) return apiNotFound('Assessment not found')

    return apiSuccess(ctx)
  } catch (e: unknown) {
    console.error('[assessments/:id GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch assessment')
  }
}

const PatchSchema = z.object({
  title:          z.string().min(1).max(200).optional(),
  assessmentType: z.enum(['exam', 'cat', 'midterm', 'endterm', 'opener', 'assignment']).optional(),
  term:           z.enum(['1', '2', '3']).optional(),
  year:           z.number().int().min(2020).max(2100).optional(),
  maxScore:       z.number().int().min(1).max(1000).optional(),
  subjects:       z.array(z.string().min(1)).min(1).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map((i) => i.message).join(', '))
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.title)          updates.title           = parsed.data.title
    if (parsed.data.assessmentType) updates.assessment_type = parsed.data.assessmentType
    if (parsed.data.term)           updates.term            = parsed.data.term
    if (parsed.data.year)           updates.year            = parsed.data.year
    if (parsed.data.maxScore)       updates.max_score       = parsed.data.maxScore
    if (parsed.data.subjects)       updates.subjects        = parsed.data.subjects

    const assessment = await updateAssessment(
      assessmentId,
      teacher.id,
      updates as Parameters<typeof updateAssessment>[2]
    )
    return apiSuccess({ assessment })
  } catch (e: unknown) {
    console.error('[assessments/:id PATCH]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to update assessment')
  }
}
