import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiNotFound,
  apiError,
  getErrorMessage,
} from '@/lib/api/response'
import { addEvidence } from '@/lib/academy/evidence'
import { recordXpEvent } from '@/lib/academy/missions'
import type { AcademyEvidence } from '@/lib/academy/types'

const bodySchema = z.object({
  lesson_id:     z.string().uuid(),
  evidence_type: z.enum(['text', 'link', 'plan_id']),
  content:       z.string().trim().default(''),
  linked_id:     z.string().trim().default(''),
  linked_title:  z.string().trim().default(''),
  description:   z.string().trim().min(1, 'Please describe what this evidence shows.'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0].message)

    const input = parsed.data
    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiNotFound('Teacher profile not found')

    // Verify lesson exists
    const { data: lesson } = await db
      .from('academy_lessons')
      .select('id')
      .eq('id', input.lesson_id)
      .maybeSingle()

    if (!lesson) return apiNotFound('Lesson not found')

    // Validate per type
    if (input.evidence_type === 'text' && !input.content.trim()) {
      return apiBadRequest('Please write your classroom observation.')
    }
    if (input.evidence_type === 'link') {
      if (!input.content.trim()) return apiBadRequest('Please provide a link.')
      try { new URL(input.content.trim()) } catch {
        return apiBadRequest('Please enter a valid URL (starting with https://).')
      }
    }
    if (input.evidence_type === 'plan_id' && !input.linked_id.trim()) {
      return apiBadRequest('Please select a lesson plan.')
    }

    // Verify lesson is completed by this teacher before accepting evidence
    const { data: progress } = await db
      .from('academy_progress')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('lesson_id', input.lesson_id)
      .maybeSingle()

    if (!progress) {
      return apiBadRequest('Mwalimu, please complete the lesson before submitting evidence.')
    }

    const evidence = await addEvidence(teacher.id, input)

    // First evidence submission earns XP (25 per piece, capped to stop farming)
    await recordXpEvent(teacher.id, 'evidence_submitted', 25, {
      lesson_id: input.lesson_id,
      evidence_type: input.evidence_type,
    }).catch(() => { /* XP is nice-to-have — never block on it */ })

    return apiSuccess<AcademyEvidence>(evidence, 201)
  } catch (err: unknown) {
    return apiError(getErrorMessage(err), 500)
  }
}
