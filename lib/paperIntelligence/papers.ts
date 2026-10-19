// lib/paperIntelligence/papers.ts
//
// Mark Papers — the papers a teacher can mark (docs/engineering/
// mark-papers-flow-plan.md). Two sources:
//
//   * a quick paper — created on the spot (title, class, subject, out of) so
//     the teacher can start marking immediately. It is an ordinary assignment
//     with origin = 'paper_marking', created 'draft' (learners never see it),
//     so the whole Paper Intelligence flow works on it unchanged.
//   * an existing topical assignment the teacher set.
//
// Adaptive assignments are left out: they are not finalised, and Paper
// Intelligence marks against one rubric, so a learner's variant paper would be
// marked against the wrong questions. Online quizzes are left out too — they
// are auto-marked, there is no paper.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { createAssignment } from '@/lib/assignments/create'
import type { UploadDestination } from './upload'

export type QuickPaperInput = {
  /** Exactly one: Solo Teacher class (teacher_classes.id) or institutional class subject (class_subjects.id). */
  classId?: string
  classSubjectId?: string
  title: string
  subject: string
  maxScore: number
}

export async function quickCreatePaper(supabase: SupabaseClient, input: QuickPaperInput): Promise<{ id: string }> {
  const { assignment } = await createAssignment(supabase, {
    classId: input.classId,
    classSubjectId: input.classSubjectId,
    title: input.title,
    subject: input.subject,
    topic: input.title,
    substrandId: null,
    instructions: 'Paper marked with Paper Intelligence.',
    dueDate: new Date().toISOString(),
    type: 'graded',
    maxScore: input.maxScore,
    isQuiz: false,
    isAdaptive: false,
    isCompassGuided: false,
    isHolidayAssignment: false,
    holidayPeriod: undefined,
    lessonPlanId: undefined,
    origin: 'paper_marking',
  })
  return { id: assignment.id }
}

export type MarkablePaper = {
  id: string
  title: string
  subject: string
  className: string | null
  grade: number | null
  maxScore: number
  dueDate: string
  createdAt: string
  /** true = quick-created from Mark Papers. */
  quickPaper: boolean
  upload: { destination: UploadDestination; uploadedAt: string; learnerCount: number } | null
}

const PAPER_LIST_COLS = 'id, title, subject, max_score, due_date, created_at, origin, teacher_classes(name, grade)' as const

/** Every paper this teacher can mark, newest first, with where (if anywhere) its marks were filed. Two queries. */
export async function listMarkablePapers(teacherId: string): Promise<MarkablePaper[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignments')
    .select(PAPER_LIST_COLS)
    .eq('teacher_id', teacherId)
    .eq('is_adaptive', false)
    .eq('is_quiz', false)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listMarkablePapers: ${error.message}`)
  const rows = (data ?? []) as unknown as Array<{
    id: string; title: string; subject: string; max_score: number | null; due_date: string; created_at: string; origin: string
    teacher_classes: { name: string; grade: number } | { name: string; grade: number }[] | null
  }>
  if (rows.length === 0) return []

  const { data: uploads, error: uploadError } = await db
    .from('paper_mark_uploads')
    .select('assignment_id, destination, uploaded_at, learner_count')
    .in('assignment_id', rows.map(r => r.id))
  if (uploadError) throw new Error(`listMarkablePapers uploads: ${uploadError.message}`)
  const uploadByPaper = new Map((uploads ?? []).map(u => [u.assignment_id as string, u]))

  return rows.map(r => {
    const cls = Array.isArray(r.teacher_classes) ? r.teacher_classes[0] : r.teacher_classes
    const u = uploadByPaper.get(r.id)
    return {
      id: r.id,
      title: r.title,
      subject: r.subject,
      className: cls?.name ?? null,
      grade: cls?.grade ?? null,
      maxScore: r.max_score ?? 100,
      dueDate: r.due_date,
      createdAt: r.created_at,
      quickPaper: r.origin === 'paper_marking',
      upload: u ? { destination: u.destination as UploadDestination, uploadedAt: u.uploaded_at as string, learnerCount: u.learner_count as number } : null,
    }
  })
}
