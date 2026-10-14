// lib/paperIntelligence/markedOutOf.ts
//
// Server-only — the exam's "marked out of", which the teacher confirms with
// the scheme and which becomes the assignment's max_score. It is NOT always
// the sum of the scheme's questions: "answer any five" papers are out of less
// than the total of every question printed. The scheme defines how marks are
// earned; this number defines what the learner's total is out of.

import { createServiceClient } from '@/utils/supabase/service'

/** Learners on this assignment already have scores on the current scale — changing it would silently change what those scores mean. */
export class MarkedOutOfLockedError extends Error {}

export async function setMarkedOutOf(assignmentId: string, markedOutOf: number): Promise<void> {
  if (!Number.isInteger(markedOutOf) || markedOutOf < 1) throw new Error('setMarkedOutOf: markedOutOf must be a positive whole number')
  const db = createServiceClient()
  const { data: assignment, error } = await db.from('assignments').select('max_score').eq('id', assignmentId).single()
  if (error) throw new Error(`setMarkedOutOf lookup: ${error.message}`)
  if (assignment.max_score === markedOutOf) return

  const { count, error: countErr } = await db
    .from('assignment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .not('score', 'is', null)
  if (countErr) throw new Error(`setMarkedOutOf scored check: ${countErr.message}`)
  if ((count ?? 0) > 0) {
    throw new MarkedOutOfLockedError(`${count} learner(s) already have scores out of ${assignment.max_score}. Keep it out of ${assignment.max_score}, or clear those scores first.`)
  }

  const { error: updErr } = await db.from('assignments').update({ max_score: markedOutOf }).eq('id', assignmentId)
  if (updErr) throw new Error(`setMarkedOutOf update: ${updErr.message}`)
}
