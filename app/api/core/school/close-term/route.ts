// app/api/core/school/close-term/route.ts
//
// Phase 12 — the principal-facing counterpart to the old, class-level
// POST /api/core/school/end-of-term (left untouched, zero UI caller, per
// endOfTermFullChain.test.ts's own single-class contract). This route
// always operates on the WHOLE school's current term, never one class,
// closing exactly the DR-05/DR-03 gap the Phase 10 rehearsal found: no UI
// called end-of-term at all, and the class-level route mutated school-wide
// state (current_term) after only one class had actually rolled forward.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { runSchoolEndOfTerm } from '@/lib/core/endOfTerm'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

const BodySchema = z.object({
  schoolId: z.string().uuid(),
  currentTermId: z.string().uuid(),
  // Omitted when closing the final term of the academic year — there is no
  // Term 4 to roll into; see runSchoolEndOfTerm's own doc comment.
  nextTerm: z.object({
    academic_year_id: z.string().uuid(),
    term_number:      z.union([z.literal(1), z.literal(2), z.literal(3)]) as z.ZodType<1 | 2 | 3>,
    name:             z.string().min(1),
    start_date:       z.string().min(1),
    end_date:         z.string().min(1),
  }).optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  let actorUserId: string
  try {
    actorUserId = (await requireSchoolAdmin(supabase, parsed.data.schoolId)).userId
  } catch (err) {
    return errorResponse(err)
  }

  let result
  try {
    result = await runSchoolEndOfTerm(
      parsed.data.schoolId,
      actorUserId,
      parsed.data.currentTermId,
      parsed.data.nextTerm,
    )
  } catch (err) {
    if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Term closure failed' }, { status: 409 })
  }

  if (result.ok === false) return NextResponse.json({ error: 'incomplete_classes', failures: result.failures }, { status: 409 })

  return NextResponse.json({ data: result })
}
