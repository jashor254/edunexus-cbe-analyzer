// app/api/teacher/assignments/[id]/paper-intelligence/pages/route.ts
//
// Paper Intelligence Phase 1 — capture one page of a learner's script.
//   POST   → store a page (re-capturing a page number replaces it). A page that
//            fails the server's own sharpness check is refused with 422 and
//            NOT stored — the teacher retakes it.
//   DELETE → remove a wrongly captured page.
//   GET ?submissionId= → short-lived signed links to view the pages (review).
//
// Only `submissionId` identifies the learner; student and class come from the
// submission row. Authorization (currently teaches this learner's class)
// happens before any image is decoded or stored.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import { UPLOAD_LIMITS } from '@/lib/config/uploads'
import { requireScriptAccess, ScriptAccessError, SubmissionNotFoundError, type ScriptAccess } from '@/lib/paperIntelligence/auth'
import { saveScriptPage, deleteScriptPage, signScriptPageUrls, BlurryPageError, InvalidPageError } from '@/lib/paperIntelligence/scriptPages'
import type { SharpnessResult } from '@/lib/paperIntelligence/sharpness'

const PageRef = {
  submissionId: z.string().uuid(),
  pageNumber: z.number().int().min(1).max(PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript),
}

const SavePageSchema = z.object({
  ...PageRef,
  // base64 is ~4/3 of the byte size
  imageBase64: z.string().min(1).max(Math.ceil(UPLOAD_LIMITS.maxFileSizeBytes * 4 / 3)),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  // Mark Papers bulk scan: pages split from a scanned PDF in the browser.
  captureSource: z.enum(['phone', 'scan']).optional(),
})

const DeletePageSchema = z.object(PageRef)

export type SavePageResponse = { pageNumber: number; sharpness: SharpnessResult }

async function authorize(assignmentId: string, submissionId: string): Promise<{ access: ScriptAccess } | { response: Response }> {
  const supabase = await createClient()
  try {
    return { access: await requireScriptAccess(supabase, assignmentId, submissionId) }
  } catch (err) {
    if (err instanceof UnauthorizedError) return { response: apiUnauthorized() }
    if (err instanceof SubmissionNotFoundError) return { response: apiNotFound('Submission not found for this assignment') }
    if (err instanceof ScriptAccessError) return { response: apiForbidden() }
    throw err
  }
}

export type PageUrlsResponse = { pages: Array<{ pageNumber: number; url: string }> }

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const submissionId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('submissionId'))
    if (!submissionId.success) return apiBadRequest('submissionId is required')

    const auth = await authorize(assignmentId, submissionId.data)
    if ('response' in auth) return auth.response

    return apiSuccess<PageUrlsResponse>({ pages: await signScriptPageUrls(submissionId.data) })
  } catch (e: unknown) {
    console.error('[paperIntelligence/pages GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const parsed = SavePageSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { submissionId, pageNumber, imageBase64, mimeType, captureSource } = parsed.data

    const auth = await authorize(assignmentId, submissionId)
    if ('response' in auth) return auth.response

    try {
      const { page, sharpness } = await saveScriptPage({ assignmentId, submissionId, pageNumber, imageBase64, mimeType, captureSource })
      return apiSuccess<SavePageResponse>({ pageNumber: page.page_number, sharpness })
    } catch (err) {
      if (err instanceof BlurryPageError) {
        return apiError(captureSource === 'scan'
          ? 'This scanned page is too faint or blurry to read. Rescan it at 300 dpi in greyscale.'
          : 'This photo is too blurry to read. Hold the phone steady and retake it.', 422)
      }
      if (err instanceof InvalidPageError) return apiBadRequest(err.message)
      throw err
    }
  } catch (e: unknown) {
    console.error('[paperIntelligence/pages POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const parsed = DeletePageSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { submissionId, pageNumber } = parsed.data

    const auth = await authorize(assignmentId, submissionId)
    if ('response' in auth) return auth.response

    const removed = await deleteScriptPage(submissionId, pageNumber)
    if (!removed) return apiNotFound('No such page')
    return apiSuccess({ removed: pageNumber })
  } catch (e: unknown) {
    console.error('[paperIntelligence/pages DELETE]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
