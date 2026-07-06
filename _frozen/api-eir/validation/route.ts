// app/api/eir/validation/route.ts
// GET  /api/eir/validation?studentId=   — validation summary
// POST /api/eir/validation/accept       — mark recommendation accepted
// POST /api/eir/validation/dismiss      — mark recommendation dismissed

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { isTeacherOfLearner } from '@/lib/api/middleware'
import { buildValidationSummary, markRecommendationAccepted, markRecommendationDismissed } from '@/_frozen/eir'
import { getUserRole } from '@/lib/auth/getRole'

const QuerySchema = z.object({
  studentId: z.string().uuid().optional(),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const role = await getUserRole(user.id)
    if (!role || !['teacher', 'admin', 'school_admin'].includes(role)) {
      return apiForbidden()
    }

    const url    = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      studentId: url.searchParams.get('studentId') ?? undefined,
    })
    if (!parsed.success) return apiError('Invalid query parameters', 400)

    const summary = await buildValidationSummary(parsed.data.studentId)
    return apiSuccess(summary)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build validation summary')
  }
}

const AcceptBodySchema = z.object({
  recommendationId: z.string().uuid(),
  studentId:        z.string().uuid(),
})

const DismissBodySchema = z.object({
  recommendationId: z.string().uuid(),
  reason:           z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url    = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'accept') {
      const body   = await req.json()
      const parsed = AcceptBodySchema.safeParse(body)
      if (!parsed.success) return apiError(parsed.error.message, 400)

      // Verify teacher access
      const isTeacher = await isTeacherOfLearner(parsed.data.studentId, user.id)
      if (!isTeacher) return apiForbidden()

      await markRecommendationAccepted(parsed.data.recommendationId, parsed.data.studentId)
      return apiSuccess({ accepted: true })
    }

    if (action === 'dismiss') {
      const body   = await req.json()
      const parsed = DismissBodySchema.safeParse(body)
      if (!parsed.success) return apiError(parsed.error.message, 400)

      await markRecommendationDismissed(parsed.data.recommendationId, parsed.data.reason)
      return apiSuccess({ dismissed: true })
    }

    return apiError('action param required: accept | dismiss', 400)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to process validation action')
  }
}
