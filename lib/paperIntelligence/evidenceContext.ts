// lib/paperIntelligence/evidenceContext.ts
//
// Server-only — the two facts an evidence row needs that the script itself
// does not carry: the learner's school and the assignment's subject. Read from
// trusted rows, never from the client.

import { createServiceClient } from '@/utils/supabase/service'

export type EvidenceContext = {
  schoolId: string | null
  subject: string
}

export async function resolveEvidenceContext(studentId: string, assignmentId: string): Promise<EvidenceContext> {
  const db = createServiceClient()
  const [{ data: student, error: studentErr }, { data: assignment, error: assignmentErr }] = await Promise.all([
    db.from('students').select('school_id').eq('id', studentId).maybeSingle(),
    db.from('assignments').select('subject').eq('id', assignmentId).maybeSingle(),
  ])
  if (studentErr) throw new Error(`resolveEvidenceContext student: ${studentErr.message}`)
  if (assignmentErr) throw new Error(`resolveEvidenceContext assignment: ${assignmentErr.message}`)
  return { schoolId: student?.school_id ?? null, subject: assignment?.subject ?? 'Unknown' }
}
