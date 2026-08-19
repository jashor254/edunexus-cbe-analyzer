// lib/assignments/assignmentPdfContent.ts
//
// PHASE 3 — INTERMITTENT-CONNECTIVITY ASSIGNMENT DELIVERY.
//
// The content-resolution layer for the learner-facing assignment PDF
// (Step 2/3/14). Deliberately separated from the PDF-rendering module
// (assignmentPdfRenderer.tsx) and from the route (app/api/student/
// assignments/[id]/pdf/route.ts) — this file owns exactly one
// responsibility: given an assignment id that the caller has ALREADY
// proven the authenticated learner may read, produce a PDF-safe content
// DTO. It performs no authorization itself (see the route for the full
// chain) and makes no AI calls (Step 21 — zero AI calls on a basic PDF
// download).
//
// STEP 3 — GENERIC VS ADAPTIVE: this phase renders CANONICAL assignment
// content only, never a per-student adaptive print-run route. The
// Printable Adaptive Assignments pilot (lib/assignments/printRoutePdf.ts)
// has no "find the approved route for exactly this one student" lookup —
// only listRoutesForRun(printRunId) for the teacher's full-class print
// flow — and its content is pre-rendered HTML (@media print), not
// react-pdf-compatible data. Building a per-student route lookup AND an
// HTML-to-react-pdf bridge is exactly the kind of new content-generation
// pipeline the Phase 3 scope lock warns against building without separate
// approval. Canonical assignment content (title/topic/instructions/
// questions) is already fully structured and already the same content
// every non-adaptive learner sees today — reusing it needs zero new
// pipeline. This is a documented, deliberate scope decision, not an
// oversight — see the Phase 3 closeout report §5.
//
// STEP 14 — QUIZ ANSWER KEY SECURITY: quiz questions are sourced from
// lib/quiz/quiz.ts's `findQuestionsForStudent`, whose own `.select(...)`
// never names `correct_index` — the guarantee is enforced at the database
// query itself, not by a field-stripping step here that could be edited
// away later.

import { repos } from '@/lib/repositories'
import { findQuestionsForStudent, type StudentQuestionRow } from '@/lib/quiz/quiz'

export type AssignmentPdfContent = {
  assignmentId: string
  title: string
  subject: string
  topic: string
  instructions: string
  dueDate: string
  type: string
  isQuiz: boolean
  maxScore: number | null
  className: string | null
  grade: number | null
  teacherName: string | null
  schoolName: string | null
  updatedAt: string | null
  /** Empty for non-quiz assignments. Never carries correct_index (Step 14). */
  questions: StudentQuestionRow[]
}

/**
 * Resolves the PDF-safe content DTO for one assignment. Returns `null` if
 * the assignment does not exist — the route treats that as 404, same as
 * every other direct-assignment-read route in this codebase (Step 5:
 * forged/nonexistent assignment UUID -> denied/not found).
 *
 * NEVER selects `learner_evidence`, `learner_projections`, or any
 * projection-recompute path (Step 6/Step 3) — this is a pure read of
 * already-persisted assignment content.
 */
export async function resolveAssignmentPdfContent(assignmentId: string): Promise<AssignmentPdfContent | null> {
  const assignment = await repos.assignments.findPdfContext(assignmentId)
  if (!assignment) return null

  let schoolName: string | null = null
  const schoolId = assignment.teacher_classes?.school_id ?? null
  if (schoolId) {
    // Best-effort only — a missing/unresolvable school name never blocks
    // PDF generation (Step 25: school identification is "where
    // appropriate", not a hard requirement).
    schoolName = await repos.assignments.findSchoolName(schoolId).catch(() => null)
  }

  const questions = assignment.is_quiz
    ? await findQuestionsForStudent(assignmentId)
    : []

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    subject: assignment.subject,
    topic: assignment.topic,
    instructions: assignment.instructions,
    dueDate: assignment.due_date,
    type: assignment.type,
    isQuiz: assignment.is_quiz,
    maxScore: assignment.max_score,
    className: assignment.teacher_classes?.name ?? null,
    grade: assignment.teacher_classes?.grade ?? null,
    teacherName: assignment.teachers?.full_name ?? null,
    schoolName,
    updatedAt: assignment.updated_at,
    questions,
  }
}
