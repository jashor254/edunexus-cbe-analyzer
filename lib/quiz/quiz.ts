// lib/quiz/quiz.ts
// Server-only — DB access for assignment_questions + the quiz-grading
// write path. Pure grading logic lives in quizPure.ts.

import { createServiceClient } from '@/utils/supabase/service'
import { gradeQuiz, type QuizAnswer, type QuizGradeResult } from './quizPure'
import { resolveGradingQuestions } from './quizDelivery'

export type QuestionInput = {
  /** Present when editing an existing question — its id is preserved (Sprint 9 Slice 1 / ADR-0028). Absent (or unrecognized) means a new question. */
  id?: string
  questionText: string
  choices: string[]
  correctIndex: number
}

export type TeacherQuestionRow = {
  id: string
  question_text: string
  choices: string[]
  correct_index: number
  order_index: number
}

export type StudentQuestionRow = {
  id: string
  question_text: string
  choices: string[]
  order_index: number
}

/**
 * Replaces an assignment's question set via an ID-preserving upsert — a
 * question kept across edits (same `id` sent back) keeps its identity;
 * removed questions are deleted explicitly; new ones are inserted. Delegates
 * entirely to the `replace_assignment_questions` Postgres function
 * (Sprint 9 Slice 1 / ADR-0028 / Sprint 4A.1) — one atomic transaction, not
 * sequential delete-then-insert calls, so a mid-operation failure can never
 * leave the assignment with a partial or empty question set. Throws (and
 * leaves every row untouched) if the assignment is locked — real submission
 * activity already exists against its current questions — enforced by a DB
 * trigger inside the function, not by this caller.
 */
export async function replaceQuestions(assignmentId: string, questions: QuestionInput[]): Promise<TeacherQuestionRow[]> {
  const db = createServiceClient()

  const { data, error } = await db.rpc('replace_assignment_questions', {
    p_assignment_id: assignmentId,
    p_questions: questions.map(q => ({
      ...(q.id ? { id: q.id } : {}),
      question_text: q.questionText,
      choices: q.choices,
      correct_index: q.correctIndex,
    })),
  })
  if (error) throw new Error(`Failed to save quiz questions: ${error.message}`)
  return (data ?? []) as TeacherQuestionRow[]
}

export async function findQuestionsForTeacher(assignmentId: string): Promise<TeacherQuestionRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_questions')
    .select('id, question_text, choices, correct_index, order_index')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw new Error('Failed to fetch quiz questions')
  return (data ?? []) as TeacherQuestionRow[]
}

/** One canonical question by id — the source a variant generation pass transforms. */
export async function findQuestionById(questionId: string): Promise<TeacherQuestionRow | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_questions')
    .select('id, question_text, choices, correct_index, order_index')
    .eq('id', questionId)
    .maybeSingle()
  if (error) throw new Error('Failed to fetch question')
  return (data as TeacherQuestionRow | null) ?? null
}

/** Never selects correct_index — this is the one path a student's own session can reach. */
export async function findQuestionsForStudent(assignmentId: string): Promise<StudentQuestionRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_questions')
    .select('id, question_text, choices, order_index')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw new Error('Failed to fetch quiz questions')
  return (data ?? []) as StudentQuestionRow[]
}

export type SubmitQuizResult = {
  submission: Record<string, unknown>
  grade: QuizGradeResult
}

/** Grades and records a quiz submission in one step — status goes straight to 'marked', no manual teacher marking wait. */
export async function gradeAndSubmitQuiz(input: {
  assignmentId: string
  studentId: string
  classId: string
  maxScore: number
  answers: QuizAnswer[]
}): Promise<SubmitQuizResult> {
  const db = createServiceClient()

  const { data: questionRows, error: qErr } = await db
    .from('assignment_questions')
    .select('id, correct_index')
    .eq('assignment_id', input.assignmentId)
  if (qErr) throw new Error('Failed to load quiz questions for grading')

  // Sprint 9 Slice 3: grade against served_variant_map's own answer key when
  // one is bound for this (assignment, student, question) — never the
  // canonical key when a variant was actually served. Never re-resolves the
  // map itself (that only ever happens at first open); an unresolved/absent
  // map here simply means every question falls back to its canonical key,
  // identical to this function's behavior before this slice existed.
  const resolved = await resolveGradingQuestions(
    input.assignmentId,
    input.studentId,
    (questionRows ?? []).map(q => ({ id: q.id as string, correct_index: q.correct_index as number })),
  )
  const questions = resolved.map(q => ({ id: q.id, choices: [], correctIndex: q.correctIndex }))
  const grade = gradeQuiz(questions, input.answers, input.maxScore)

  const now = new Date().toISOString()
  const updatePayload = {
    status: 'marked' as const,
    score: grade.score,
    answers: input.answers,
    submitted_at: now,
    marked_at: now,
  }

  const { data: existing } = await db
    .from('assignment_submissions')
    .select('id')
    .eq('assignment_id', input.assignmentId)
    .eq('student_id', input.studentId)
    .maybeSingle()

  let submission: Record<string, unknown> | null = null
  let opError: { message: string } | null = null

  if (existing) {
    const { data, error } = await db
      .from('assignment_submissions')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single()
    submission = data
    opError = error
  } else {
    const { data, error } = await db
      .from('assignment_submissions')
      .insert({ assignment_id: input.assignmentId, student_id: input.studentId, class_id: input.classId, ...updatePayload })
      .select()
      .single()
    submission = data
    opError = error
  }

  if (opError || !submission) throw new Error('Failed to record quiz submission')

  return { submission, grade }
}
