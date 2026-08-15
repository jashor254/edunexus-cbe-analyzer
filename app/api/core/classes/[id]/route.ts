import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { updateClass } from '@/lib/core/classes'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

// Phase 8 — updateClass (lib/core/classes.ts) existed with zero HTTP caller.
// This is the smallest wiring to reach it: only the fields updateClass
// already supports (display_name, class_teacher_id, capacity). No grade/
// stream/academic_year change — that would touch historical placement
// semantics this phase deliberately does not redesign.
const UpdateClassSchema = z.object({
  schoolId: z.string().uuid(),
  display_name: z.string().min(1).optional(),
  class_teacher_id: z.string().uuid().optional(),
  capacity: z.number().int().positive().optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  const parsed = UpdateClassSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...updates } = parsed.data
  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await updateClass(id, schoolId, updates)
  return NextResponse.json({ data })
}
