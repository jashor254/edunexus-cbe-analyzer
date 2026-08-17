// lib/assignments/variantGeneration.integration.test.ts
//
// Adaptive Variant Generation Pipeline — validates against real, synthetic
// (throwaway) data: a real teacher, class, 3 students seeded with real
// confirmed Evidence at distinct CBC levels (via recordQuizAutoGradeEvidence,
// the same producer this platform already uses elsewhere), a real
// assignment + canonical question, and the real Sprint 9 Slice 1 schema
// (assignment_question_variants, its partial unique index, its lifecycle
// trigger, its atomic regenerate function).
//
// The AI Router call (routedCompletion) is injected directly as a plain
// function parameter (`callAI`) — NOT node:test's experimental
// mock.module. mock.module was tried first and rejected: in practice it
// intermittently failed to intercept this module's import, letting real
// DeepSeek API calls fire despite the test intending to mock them
// (confirmed by real token/latency logs appearing in a run that should
// have been fully mocked) — a real-money risk and a source of
// non-deterministic failure-path tests. Plain parameter injection has
// neither problem: no real AI calls, no tokens spent, fully deterministic.
//
// Run: npx tsx --env-file=.env.local --test lib/assignments/variantGeneration.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'
import { findQuestionById, replaceQuestions, findQuestionsForTeacher } from '@/lib/quiz/quiz'
import { createDraftVariants, approveVariant, findApprovedVariant, editVariant } from '@/lib/assignments/variants'
import { generateAdaptiveVariants, regenerateOneVariant, type RoutedCompletionFn } from './variantGeneration'
import type { AIResponse } from '@/lib/ai-orchestration/types'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_VARIANT_GEN_TEST'
const db = createServiceClient()
const SUBJECT = 'Mathematics'

function aiResponse(text: string): AIResponse {
  return { text, provider: 'deepseek', model: 'deepseek-chat', prompt_tokens: 50, completion_tokens: 50, total_tokens: 100, latency_ms: 100, cost_units: 0.0001, fallback_used: false }
}

const VALID_GENERATED = JSON.stringify({
  questionText: 'Generated variant: which fraction equals one half?',
  choices: ['1/2', '1/3', '1/4', '2/3'],
  correctIndex: 0,
  cognitiveIntent: 'apply',
  difficultyRationale: 'test rationale',
  expectedMisconceptions: ['confuses numerator/denominator'],
  teacherExplanation: 'teacher note',
  learnerExplanation: 'learner note',
})

/** A fresh fake AI call per test, injected directly — no shared mutable global, no module mocking. */
function fakeAI(behavior: 'success' | 'invalid-structure' | 'verification-fails' | 'router-down'): RoutedCompletionFn {
  return async (request) => {
    if (behavior === 'router-down') throw new Error('All AI providers failed. Last error: timeout')

    if (request.feature === 'adaptive_variant.generate') {
      if (behavior === 'invalid-structure') return aiResponse('this is not valid JSON {{{')
      return aiResponse(VALID_GENERATED)
    }
    // adaptive_variant.verify
    if (behavior === 'verification-fails') return aiResponse(JSON.stringify({ valid: false, reason: 'choices[1] could also be defended as correct' }))
    return aiResponse(JSON.stringify({ valid: true, reason: 'single unambiguous correct answer, same learning outcome' }))
  }
}

let authUserId: string
let teacherId: string
let classId: string
let assignmentId: string
let questionId: string
const studentIds: string[] = []

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `variant-gen-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: SUBJECT, class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  classId = cls.id

  // 3 students, seeded with real confirmed Evidence at levels 2 / 3 / 4 —
  // classifyGroup() maps these to prerequisite_gap (foundation),
  // concept_confusion (supported_practice), and on_track (extension)
  // respectively, via the real, unmodified Recommendation layer.
  const levelScores = [40, 60, 90] // -> CBC levels 2, 3, 4 (thresholds 75/50/30)
  for (const score of levelScores) {
    const { data: student, error: studentErr } = await db
      .from('students').insert({ user_id: null, name: `${SYNTHETIC_MARKER} Student ${score}`, grade: 8, level: 'Junior School' })
      .select('id').single()
    if (studentErr) throw studentErr
    studentIds.push(student.id)
    await db.from('class_students').insert({ class_id: classId, student_id: student.id })

    await recordQuizAutoGradeEvidence({
      studentId: student.id, initiatedBy: authUserId,
      assignmentId: `${SYNTHETIC_MARKER}-seed-${student.id}`,
      subject: SUBJECT, topic: 'Fractions', substrandId: null,
      score, maxScore: 100, academicYear: 2026, term: 1,
    })
  }

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Variant Gen Test Quiz',
      subject: SUBJECT, topic: 'Fractions', instructions: 'Answer all questions',
      due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 10, is_quiz: true,
    })
    .select('id').single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id

  await replaceQuestions(assignmentId, [
    { questionText: 'Calculate: 3/8 + 2/8', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0 },
  ])
  const [question] = await findQuestionsForTeacher(assignmentId)
  questionId = question.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  for (const id of studentIds) {
    await db.from('learner_evidence').delete().eq('learner_id', id)
    await db.from('students').delete().eq('id', id)
  }
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) {
    await db.from('notification_log').delete().eq('user_id', authUserId)
    await db.from('platform_events').delete().eq('actor_id', authUserId)
    await db.from('ingestion_runs').delete().eq('initiated_by', authUserId)
    await deleteAuthUserOrThrow(db, authUserId)
  }
})

const learners = () => studentIds.map((id, i) => ({ learnerId: id, learnerName: `Student ${i}` }))

test('one canonical question produces exactly three draft variants (foundation, supported_practice, extension)', async () => {
  const result = await generateAdaptiveVariants({ questionId, learners: learners(), subject: SUBJECT, callAI: fakeAI('success') })

  assert.equal(result.failed.length, 0)
  assert.equal(result.created.length, 3)
  const tiers = result.created.map(v => v.variant_type).sort()
  assert.deepEqual(tiers, ['extension', 'foundation', 'supported_practice'])
  assert.ok(result.created.every(v => v.status === 'draft'))
  assert.ok(result.created.every(v => v.generated_by === 'ai'))

  const { count } = await db.from('assignment_question_variants').select('id', { count: 'exact', head: true }).eq('question_id', questionId)
  assert.equal(count, 3)
})

test('verification rejects an intentionally invalid variant — nothing is persisted for that tier', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)

  const result = await generateAdaptiveVariants({ questionId, learners: learners(), subject: SUBJECT, callAI: fakeAI('verification-fails') })

  assert.equal(result.created.length, 0)
  assert.equal(result.failed.length, 3)
  assert.ok(result.failed.every(f => /Independent verification failed/.test(f.reason)))

  const { count } = await db.from('assignment_question_variants').select('id', { count: 'exact', head: true }).eq('question_id', questionId)
  assert.equal(count, 0, 'a failed verification must never leave a row behind')
})

test('structural validation rejects malformed JSON before verification even runs', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)

  const result = await generateAdaptiveVariants({ questionId, learners: learners(), subject: SUBJECT, callAI: fakeAI('invalid-structure') })

  assert.equal(result.created.length, 0)
  assert.ok(result.failed.every(f => /Structural validation failed/.test(f.reason)))
})

test('regeneration archives the old approved variant and persists a fresh draft, atomically', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)
  const { created } = await generateAdaptiveVariants({ questionId, learners: learners(), subject: SUBJECT, callAI: fakeAI('success') })
  const foundation = created.find(v => v.variant_type === 'foundation')!
  const approved = await approveVariant(foundation.id)

  const result = await regenerateOneVariant({ variantId: approved.id, learners: learners(), subject: SUBJECT, callAI: fakeAI('success') })
  assert.ok('variant' in result)
  const regenerated = (result as { variant: { id: string; status: string; variant_type: string } }).variant
  assert.equal(regenerated.status, 'draft')
  assert.equal(regenerated.variant_type, 'foundation')

  const { data: oldRow } = await db.from('assignment_question_variants').select('status, superseded_by, question_text').eq('id', approved.id).single()
  assert.equal(oldRow!.status, 'archived')
  assert.equal(oldRow!.superseded_by, regenerated.id)
  assert.ok(oldRow!.question_text, 'the archived row keeps its full content, still readable')
})

test('approval obeys the DB partial unique constraint — a second approved variant for the same tier is rejected', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)
  const [first] = await createDraftVariants([{ questionId, variantType: 'foundation', questionText: 'First draft', choices: ['A', 'B'], correctIndex: 0 }])
  const [second] = await createDraftVariants([{ questionId, variantType: 'foundation', questionText: 'Second draft', choices: ['A', 'B'], correctIndex: 0 }])

  await approveVariant(first.id)
  await assert.rejects(() => approveVariant(second.id), /duplicate key|unique/i)

  const stillApproved = await findApprovedVariant(questionId, 'foundation')
  assert.equal(stillApproved?.id, first.id)
})

test('manual teacher edits preserve provenance — same id, question_id, and variant_type; generated_by flips to teacher_edited', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)
  const [draft] = await createDraftVariants([{ questionId, variantType: 'supported_practice', questionText: 'AI draft text', choices: ['A', 'B'], correctIndex: 0, generatedBy: 'ai' }])

  const edited = await editVariant(draft.id, { questionText: 'Teacher-edited text', correctIndex: 1 })

  assert.equal(edited.id, draft.id)
  assert.equal(edited.question_id, questionId)
  assert.equal(edited.variant_type, 'supported_practice')
  assert.equal(edited.generated_by, 'teacher_edited')
  assert.equal(edited.question_text, 'Teacher-edited text')
  assert.equal(edited.correct_index, 1)
})

test('router failure leaves the canonical question completely untouched', async () => {
  await db.from('assignment_question_variants').delete().eq('question_id', questionId)
  const before1 = await findQuestionById(questionId)

  const result = await generateAdaptiveVariants({ questionId, learners: learners(), subject: SUBJECT, callAI: fakeAI('router-down') })

  assert.equal(result.created.length, 0)
  assert.equal(result.failed.length, 3)
  assert.ok(result.failed.every(f => /All AI providers failed/.test(f.reason)))

  const after1 = await findQuestionById(questionId)
  assert.deepEqual(after1, before1)

  const { count } = await db.from('assignment_question_variants').select('id', { count: 'exact', head: true }).eq('question_id', questionId)
  assert.equal(count, 0)
})
