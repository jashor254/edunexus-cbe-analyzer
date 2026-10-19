// app/api/teacher/paper-intelligence/papers/route.ts
//
// Mark Papers — the papers a teacher can mark (docs/engineering/
// mark-papers-flow-plan.md).
//   GET  → the teacher's markable papers (quick papers + topical assignments;
//          no adaptive, no quizzes), newest first, with where each was filed.
//   POST → quick-create a paper (title, class, subject, out of) and start
//          marking immediately. Created draft — learners never see it.
// Thin: auth, validation, then lib/paperIntelligence/papers.ts.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ForbiddenError, ValidationError } from '@/lib/core/errors'
import { listMarkablePapers, quickCreatePaper, type MarkablePaper } from '@/lib/paperIntelligence/papers'

const QuickPaperSchema = z.object({
  // Exactly one: Solo Teacher class or institutional class subject (Phase 1D).
  class_id:         z.string().uuid().optional(),
  class_subject_id: z.string().uuid().optional(),
  title:            z.string().trim().min(1).max(200),
  subject:          z.string().trim().min(1).max(100),
  max_score:        z.number().int().positive().max(1000),
})

export type PapersResponse = { papers: MarkablePaper[] }
export type QuickPaperResponse = { paperId: string }

export async function GET() {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }
    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    return apiSuccess<PapersResponse>({ papers: await listMarkablePapers(teacher.id) })
  } catch (e: unknown) {
    console.error('[paperIntelligence/papers GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    // Auth before anything else is parsed or acted on.
    try {
      await requireAuthentication(supabase)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = QuickPaperSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { class_id, class_subject_id, title, subject, max_score } = parsed.data
    if (!!class_id === !!class_subject_id) {
      return apiBadRequest('Choose the class this paper is for.')
    }

    // createAssignment authorizes the class (requireClassTeacher /
    // institutional authority) from the session — never from the body.
    const { id } = await quickCreatePaper(supabase, {
      classId: class_id,
      classSubjectId: class_subject_id,
      title,
      subject,
      maxScore: max_score,
    })
    return apiSuccess<QuickPaperResponse>({ paperId: id }, 201)
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof ForbiddenError) return apiForbidden()
    if (e instanceof ValidationError) return apiBadRequest(e.message)
    console.error('[paperIntelligence/papers POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
