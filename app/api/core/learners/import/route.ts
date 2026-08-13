// app/api/core/learners/import/route.ts
//
// Bulk learner roster import — preview and commit.
//
// Thin per RAS §2: auth, authorization, one service call. All parsing,
// normalisation, validation and duplicate analysis live in
// lib/core/learnerRoster.ts.
//
// AUTHORIZATION
// requireSchoolAdmin(schoolId) — the same gate the existing single-learner
// admission path (app/api/core/learners POST) already uses, so bulk import
// grants no authority that adding one learner did not. A plain teacher cannot
// import a roster; a school admin of another school cannot import into this
// one. `schoolId` is verified against the caller's own membership and is never
// taken from the CSV.
//
// A platform/growth admin is deliberately NOT given a bypass here: institutional
// membership is the existing convention for learner data, and equating platform
// authority with school membership is exactly the conflation the last three
// security phases removed.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import {
  analyseLearnerRoster,
  importLearnerRoster,
  MAX_ROSTER_BYTES,
} from '@/lib/core/learnerRoster'

// `csv` is the raw file text. `schoolId` establishes ownership and is checked
// against the caller's membership below — the file itself carries no school,
// teacher or owner column, by design.
const ImportSchema = z.object({
  action:   z.enum(['preview', 'commit']),
  schoolId: z.string().uuid(),
  csv:      z.string().min(1).max(MAX_ROSTER_BYTES),
}).strict()

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const parsed = ImportSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 422 })
  }
  const { action, schoolId, csv } = parsed.data

  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  try {
    if (action === 'preview') {
      // Zero writes. The service only reads existing admission numbers and
      // class names to classify each row.
      return NextResponse.json({ data: await analyseLearnerRoster(schoolId, csv) })
    }

    return NextResponse.json({ data: await importLearnerRoster(schoolId, csv) })
  } catch (err) {
    // Never hand a raw database error to a school administrator.
    console.error('[core/learners/import]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Could not process this roster. Please check the file and try again.' },
      { status: 500 }
    )
  }
}
