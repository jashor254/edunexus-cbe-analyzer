// app/api/core/school/end-of-term/route.ts
// Runs the End-of-Term workflow (lib/core/endOfTerm.ts) for one class/term.
// School-admin gated via the canonical requireSchoolAdmin (Sprint 1B).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { runEndOfTerm } from '@/lib/core/endOfTerm'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

const BodySchema = z.object({
  schoolId: z.string().uuid(),
  classId:  z.string().uuid(),
  termId:   z.string().uuid(),
  term:     z.string().min(1),
  year:     z.number().int(),
  nextTerm: z.object({
    academic_year_id: z.string().uuid(),
    term_number:      z.number().int().min(1).max(3),
    name:             z.string().min(1),
    start_date:       z.string().min(1),
    end_date:         z.string().min(1),
  }),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    await requireSchoolAdmin(supabase, parsed.data.schoolId)
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
    throw err
  }

  const { nextTerm, ...rest } = parsed.data
  let result
  try {
    result = await runEndOfTerm({
      ...rest,
      nextTerm: { ...nextTerm, term_number: nextTerm.term_number as 1 | 2 | 3 },
    })
  } catch (err) {
    // Sprint 5B: runEndOfTerm calls generateReportCards internally, which
    // now throws a plain Error (not an EduNexusError) when it refuses to
    // overwrite already-published report cards — e.g. End-of-Term run
    // twice for the same class/term. Surfaced explicitly per the sprint's
    // Failure Behaviour requirement, rather than falling through to a
    // generic 500.
    return NextResponse.json({ error: err instanceof Error ? err.message : 'End-of-Term run failed' }, { status: 409 })
  }
  if (result.ok === false) return NextResponse.json({ error: result.reason, unpublished: result.unpublished }, { status: 409 })

  return NextResponse.json({ data: result })
}
