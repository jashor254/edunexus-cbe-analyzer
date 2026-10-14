// lib/paperIntelligence/reviewContext.ts
//
// Server-only — the rows review needs besides the proposals themselves: the
// assignment's learners (names for the review cards, class for the access
// check) and the assignment fields the shared mark path writes with.

import { createServiceClient } from '@/utils/supabase/service'
import type { MarkableAssignment } from '@/lib/assignments/markSubmission'

export type ReviewSubmission = {
  submissionId: string
  studentId: string
  classId: string
  name: string
}

export async function findReviewSubmissions(assignmentId: string): Promise<ReviewSubmission[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_submissions')
    .select('id, student_id, class_id, students(name)')
    .eq('assignment_id', assignmentId)
  if (error) throw new Error(`findReviewSubmissions: ${error.message}`)
  return ((data ?? []) as unknown as Array<{ id: string; student_id: string; class_id: string; students: { name: string } | null }>)
    .map(r => ({ submissionId: r.id, studentId: r.student_id, classId: r.class_id, name: r.students?.name ?? 'Unnamed learner' }))
}

export async function findMarkableAssignment(assignmentId: string): Promise<MarkableAssignment> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignments')
    .select('id, max_score, subject, topic, substrand_id')
    .eq('id', assignmentId)
    .single()
  if (error || !data) throw new Error(`findMarkableAssignment: ${error?.message ?? 'not found'}`)
  return data as unknown as MarkableAssignment
}
