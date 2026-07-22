import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { logQuickAction } from '@/lib/growth/services/activities'
import { getSchool } from '@/lib/growth/services/schools'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

const QuickActionSchema = z.object({
  actionKey: z.string().min(1),
  extraNotes: z.string().max(2000).nullable().optional(),
  gotReply: z.boolean().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const parsed = QuickActionSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const school = await getSchool(id)
    const result = await logQuickAction(
      { schoolId: id, actionKey: parsed.data.actionKey, extraNotes: parsed.data.extraNotes, gotReply: parsed.data.gotReply, currentStage: school.pipeline_stage },
      growthUser.id,
    )
    return apiSuccess({ activity: result.activity, newStage: result.newStage }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.startsWith('Unknown quick action')) return apiBadRequest(err.message)
    console.error('[growth/schools/[id]/quick-action POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
