// POST: Generate a Quick Check for a specific remedial bank item
// Body: { substrandHealthId, sowId, strand, subStrand, grade, learningArea, struggleCount, rootCause }
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateQuickCheck } from '@/lib/teachingIntelligence/quickCheckGenerator'

const BodySchema = z.object({
  substrandHealthId: z.string().uuid(),
  sowId:             z.string().uuid(),
  strand:            z.string().min(1),
  subStrand:         z.string().min(1),
  grade:             z.string().min(1),
  learningArea:      z.string().min(1),
  struggleCount:     z.number().int().min(1),
  rootCause:         z.string().nullable(),
})

export async function POST(req: Request) {
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

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const body = parsed.data

    // Verify the teacher owns this SOW before generating
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', body.sowId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!sow) return apiForbidden()

    const quickCheck = await generateQuickCheck({
      substrandHealthId: body.substrandHealthId,
      sowId:             body.sowId,
      teachersId:        teacher.id,
      authUserId:        user.id,
      strand:            body.strand,
      subStrand:         body.subStrand,
      grade:             body.grade,
      learningArea:      body.learningArea,
      struggleCount:     body.struggleCount,
      rootCause:         body.rootCause,
    })

    return apiSuccess({ quickCheck })
  } catch (err: unknown) {
    console.error('[teaching-intelligence/quick-check]', err)
    return apiError(err instanceof Error ? err.message : 'Quick check generation failed')
  }
}
