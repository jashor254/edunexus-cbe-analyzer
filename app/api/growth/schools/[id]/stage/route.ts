import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { changeStage } from '@/lib/growth/services/schools'
import { changeStageSchema } from '@/lib/growth/validation/schools'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import type { GrowthPipelineStage } from '@/lib/growth/types'

// Dedicated route for stage changes (Blueprint §11 API architecture) — Kanban
// drag-drop always calls this, never a generic PATCH /schools/[id], so a
// stage move is never silently bundled with an unrelated field edit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = changeStageSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const school = await changeStage(id, parsed.data.stage as GrowthPipelineStage)
    return apiSuccess({ school })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/stage PATCH]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
