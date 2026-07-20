// app/api/teacher/assignments/[id]/questions/route.ts
// Teacher authoring for a quiz-type assignment's MCQ question set.
// PUT replaces the whole set (no per-question versioning in this slice —
// matches ADR-free "smallest correct slice" scope for Phase 3a).

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { replaceQuestions, findQuestionsForTeacher } from '@/lib/quiz/quiz'

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  questionText: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
}).refine(q => q.correctIndex < q.choices.length, { message: 'correctIndex must reference a real choice' })

const ReplaceQuestionsSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
})

async function loadAssignmentClassId(assignmentId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db.from('assignments').select('class_id').eq('id', assignmentId).maybeSingle()
  return data?.class_id ?? null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const classId = await loadAssignmentClassId(id)
    if (!classId) return apiNotFound('Assignment not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const questions = await findQuestionsForTeacher(id)
    return apiSuccess({ questions })
  } catch (e: unknown) {
    console.error('[teacher/assignments/questions GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const classId = await loadAssignmentClassId(id)
    if (!classId) return apiNotFound('Assignment not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const parsed = ReplaceQuestionsSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const questions = await replaceQuestions(id, parsed.data.questions)
    return apiSuccess({ questions })
  } catch (e: unknown) {
    console.error('[teacher/assignments/questions PUT]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
