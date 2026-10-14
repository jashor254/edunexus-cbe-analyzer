// app/api/teacher/assignments/[id]/paper-intelligence/scripts/route.ts
//
// Paper Intelligence Phase 1 — the capture screen's class list.
//   GET → every learner on the assignment, captured page numbers, AI marking
//         status, plus the confirmed scheme's size and max total.
// Gated on currently teaching the assignment's class (requireClassTeacher),
// not on who created the assignment.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireAssignmentClassTeacher, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { getScriptRoster, type ScriptRoster } from '@/lib/paperIntelligence/scriptRoster'

export type ScriptsResponse = ScriptRoster & { assignmentTitle: string | null }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const supabase = await createClient()
    let title: string | null
    try {
      title = (await requireAssignmentClassTeacher(supabase, assignmentId)).assignment.title
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof AssignmentOwnershipError) return apiNotFound('Assignment not found')
      throw err
    }
    const roster = await getScriptRoster(assignmentId)
    return apiSuccess<ScriptsResponse>({ ...roster, assignmentTitle: title })
  } catch (e: unknown) {
    console.error('[paperIntelligence/scripts GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
