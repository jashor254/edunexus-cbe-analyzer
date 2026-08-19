// app/api/student/assignments/[id]/pdf/route.ts
//
// PHASE 3 — INTERMITTENT-CONNECTIVITY ASSIGNMENT DELIVERY.
//
// A learner with occasional internet access downloads this assignment as a
// PDF, works offline, and returns it later through the EXISTING submission
// paths (submit / submit-file / teacher paper mark) — no second assignment
// identity, no new evidence writer. See docs — Phase 3 closeout for the
// full design rationale.
//
// AUTHORIZATION CHAIN (Step 4/5) — mirrors app/api/student/assignments/
// [id]/questions/route.ts's proven pattern exactly, generalized from
// quiz-only to any assignment:
//   auth.getUser()
//     -> legacy self:      resolveStudent(userId) + requireClassMembership(assignment.class_id)
//     -> legacy parent:    resolveParent(userId).studentIds + requireClassMembership(assignment.class_id)
//     -> institutional:    resolveInstitutionalAssignmentReadAccess(userId, assignmentId)
//     -> none of the above -> 403 (assignment exists but caller has no read grant)
//     -> assignment does not exist / malformed id -> 404
// Never trusts a client-supplied studentId/learnerId (Step 4) — every
// candidate studentId here is derived server-side from the verified
// `auth.getUser()` subject.
//
// STEP 6 — this route performs ZERO writes. No learner_evidence, no
// learner_projections, no submission-status mutation, no projection
// recompute. Downloading proves delivery, not attempt.
// STEP 21 — zero AI calls; the only DB work is the auth-resolution
// queries already proven elsewhere plus one content read.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireClassMembership } from '@/lib/core/permissions'
import { resolveStudent, resolveParent } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { resolveInstitutionalAssignmentReadAccess } from '@/lib/core/assignmentDiscovery'
import { resolveAssignmentPdfContent } from '@/lib/assignments/assignmentPdfContent'
import { generateAssignmentPdf } from '@/lib/assignments/assignmentPdfRenderer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** Printable-ASCII-only, underscored slug — never the raw assignment UUID (Step 26). */
function safeFileSlug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
  return normalized.length > 0 ? normalized : 'Assignment'
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buf.byteLength)
  new Uint8Array(out).set(buf)
  return out
}

async function resolveReadAccess(
  userId: string,
  assignmentId: string,
  classId: string,
): Promise<boolean> {
  // Legacy self.
  const student = await resolveStudent(userId)
  if (student) {
    try {
      await requireClassMembership(student.id, classId)
      return true
    } catch {
      // Falls through — a legacy learner with no membership in THIS
      // assignment's class still might be a parent of one who does, or
      // (impossible in practice, but never assumed) an institutional
      // learner too; keep checking rather than deny early.
    }
  }

  // Legacy parent — any linked child enrolled in this assignment's class.
  const parent = await resolveParent(userId)
  for (const studentId of parent.studentIds) {
    try {
      await requireClassMembership(studentId, classId)
      return true
    } catch {
      continue
    }
  }

  // Institutional learner (Phase 2's proven recipient-materialization signal).
  const access = await resolveInstitutionalAssignmentReadAccess(userId, assignmentId)
  return access !== null
}

export async function handlePdfGet(req: NextRequest, { params }: Params): Promise<Response> {
  const { id: assignmentId } = await params
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    throw err
  }

  // A malformed/forged UUID resolves to `null` here (Step 5) — never a 500,
  // never a distinguishing error message between "does not exist" and
  // "not yours" beyond the standard 404/403 split every other assignment
  // route in this codebase already uses.
  const assignmentContext = await repos.assignments.findPdfContext(assignmentId)
  if (!assignmentContext) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const authorized = await resolveReadAccess(userId, assignmentId, assignmentContext.class_id)
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const content = await resolveAssignmentPdfContent(assignmentId)
  if (!content) {
    // Vanishingly unlikely (assignment existed a moment ago) — treated as
    // not-found rather than 500, matching the rest of this route's
    // fail-closed-to-404 posture for anything assignment-shaped.
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  try {
    const generatedAt = new Date().toISOString()
    const pdf = await generateAssignmentPdf(content, generatedAt)
    const filename = `${safeFileSlug(content.subject)}-${safeFileSlug(content.title)}.pdf`

    return new Response(toArrayBuffer(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.byteLength.toString(),
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    })
  } catch (err) {
    console.error('[student/assignments/pdf GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to generate assignment PDF' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: Params): Promise<Response> {
  return handlePdfGet(req, context)
}
