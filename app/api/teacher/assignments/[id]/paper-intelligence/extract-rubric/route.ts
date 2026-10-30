// app/api/teacher/assignments/[id]/paper-intelligence/extract-rubric/route.ts
//
// Paper Intelligence Phase 1 — scheme → rubric extraction endpoint. Thin:
// authenticate + confirm assignment ownership, then hand the photographed
// scheme pages to the vision engine. Produces PROPOSED rubrics only — nothing
// is persisted here; the teacher reviews and confirms on the editor screen,
// and the separate `rubrics` POST writes them.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireOwnedAssignment, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { extractRubricsFromScheme, SchemeExtractionInputError } from '@/lib/paperIntelligence/schemeExtraction'
import { SchemeExtractionParseError } from '@/lib/paperIntelligence/schemeValidation'
import { checkDailyCallLimit, releaseDailyCall } from '@/lib/ai/rateLimit'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

const ImageSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const RequestSchema = z.object({
  images: z.array(ImageSchema).min(1).max(12),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const supabase = await createClient()
    let owned: Awaited<ReturnType<typeof requireOwnedAssignment>>
    try {
      owned = await requireOwnedAssignment(supabase, assignmentId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof AssignmentOwnershipError) return apiNotFound('Assignment not found')
      throw err
    }

    const parsed = RequestSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    // Daily cap on vision calls, reserved before the pages are sent.
    const quota = await checkDailyCallLimit(owned.teacherUserId, 'paper_rubric_extraction')
    if (quota.allowed === false) {
      return apiError(`Daily limit of ${quota.limit} scheme extractions reached. Resets at ${quota.resetAt}`, 429)
    }

    try {
      const { response, rejected } = await extractRubricsFromScheme(parsed.data.images)
      return apiSuccess({ rubrics: response.rubrics, rejected, metadata: response.metadata })
    } catch (err) {
      // No rubrics were produced — refund the slot.
      await releaseDailyCall(quota)
      if (err instanceof SchemeExtractionInputError) return apiBadRequest(err.message)
      if (err instanceof SchemeExtractionParseError) return apiError('Could not read the scheme pages — try clearer photos', 502)
      console.error('[paperIntelligence/extract-rubric]', err instanceof Error ? err.message : String(err))
      return apiError('Scheme extraction failed', 502)
    }
  } catch (e: unknown) {
    if (e instanceof AttemptLimiterUnavailableError) return apiError(e.message, 503)
    console.error('[paperIntelligence/extract-rubric]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
