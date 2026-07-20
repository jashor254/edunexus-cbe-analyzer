// POST — generates adaptive variants (draft only, never auto-approved) for
// one canonical question, for exactly the instructional tiers this class
// roster needs. See lib/assignments/variantGeneration.ts for the pipeline.
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { generateAdaptiveVariants } from '@/lib/assignments/variantGeneration'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id: assignmentId, questionId } = await params
    const db = createServiceClient()

    const { data: assignment } = await db
      .from('assignments')
      .select('class_id, subject, substrand_id')
      .eq('id', assignmentId)
      .maybeSingle()
    if (!assignment) return apiNotFound('Assignment not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, assignment.class_id)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const { data: question } = await db.from('assignment_questions').select('id').eq('id', questionId).eq('assignment_id', assignmentId).maybeSingle()
    if (!question) return apiNotFound('Question not found on this assignment')

    const studentIds = await repos.learnerIntelligence.getClassEnrollment(assignment.class_id)
    if (studentIds.length === 0) return apiBadRequest('Class has no enrolled students to ground generation in')

    const names = await repos.learnerIntelligence.getStudentNamesByIds(studentIds)
    const nameById = new Map(names.map(n => [n.id, n.name?.trim() || 'Student']))
    const learners = studentIds.map(sid => ({ learnerId: sid, learnerName: nameById.get(sid) ?? 'Student' }))

    const result = await generateAdaptiveVariants({
      questionId,
      learners,
      subject: assignment.subject,
      subStrandId: assignment.substrand_id,
    })

    return apiSuccess(result)
  } catch (e: unknown) {
    console.error('[variants generate POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
