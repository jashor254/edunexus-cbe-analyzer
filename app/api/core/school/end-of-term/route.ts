// app/api/core/school/end-of-term/route.ts
// Runs the End-of-Term workflow (lib/core/endOfTerm.ts) for one class/term.
// School-admin gated — same isSchoolAdmin check already used for other
// school-management actions (lib/repositories/teacher.repository.ts).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { runEndOfTerm } from '@/lib/core/endOfTerm'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const isAdmin = await repos.teachers.isSchoolAdmin(user.id, parsed.data.schoolId)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { nextTerm, ...rest } = parsed.data
  const result = await runEndOfTerm({
    ...rest,
    nextTerm: { ...nextTerm, term_number: nextTerm.term_number as 1 | 2 | 3 },
  })
  if (result.ok === false) return NextResponse.json({ error: result.reason, unpublished: result.unpublished }, { status: 409 })

  return NextResponse.json({ data: result })
}
