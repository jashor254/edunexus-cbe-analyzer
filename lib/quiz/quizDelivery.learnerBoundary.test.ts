// Learner-facing data boundary for adaptive quizzes (audit F-02 follow-up).
// The teacher review now displays answer keys and generator notes; this pins
// that NONE of it can reach a learner through the questions API, which
// serves findServedQuestionsForStudent()'s output verbatim
// (app/api/student/assignments/[id]/questions/route.ts).
//
// Every dependency is mocked in-process — no database, no network, no AI.
// Not in the STANDARD manifest only because it must mock the service-client
// module, which that manifest's guard forbids by name.
import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

const CANONICAL_QUESTIONS = [
  { id: 'q1', assignment_id: 'a1', question_text: 'Canonical Q1', choices: ['w', 'x', 'y', 'z'], correct_index: 2, order_index: 0, created_at: '' },
  { id: 'q2', assignment_id: 'a1', question_text: 'Canonical Q2', choices: ['p', 'q'], correct_index: 1, order_index: 1, created_at: '' },
]

const TEACHER_ONLY_MARKERS = ['TEACHER-EXPLANATION-SECRET', 'LEARNER-EXPLANATION-HIDDEN', 'MISCONCEPTION-SECRET', 'RATIONALE-SECRET', 'INTENT-SECRET', 'OUTCOME-SECRET']

const FOUNDATION_VARIANT = {
  id: 'v1', question_id: 'q1', variant_type: 'foundation', status: 'approved', generated_by: 'ai',
  question_text: 'Foundation Q1 with a worked example', choices: ['y', 'w', 'x', 'z'], correct_index: 0,
  teacher_explanation: TEACHER_ONLY_MARKERS[0], learner_explanation: TEACHER_ONLY_MARKERS[1],
  expected_misconceptions: [TEACHER_ONLY_MARKERS[2]], difficulty_rationale: TEACHER_ONLY_MARKERS[3],
  cognitive_intent: TEACHER_ONLY_MARKERS[4], learning_outcome: TEACHER_ONLY_MARKERS[5],
  sub_strand_id: null, supersedes: null, superseded_by: null, created_at: '', updated_at: '', approved_at: '', archived_at: null,
}

let servedMap: Record<string, string | null> | null = null

function chain(table: string) {
  const self = {
    select: () => self,
    eq: () => self,
    maybeSingle: async () => ({
      data: table === 'assignment_submissions' ? { served_variant_map: servedMap } : { subject: 'Integrated Science', substrand_id: null },
      error: null,
    }),
  }
  return self
}

mock.module('@/utils/supabase/service', {
  namedExports: {
    createServiceClient: () => ({
      from: chain,
      rpc: async (_fn: string, args: { p_pairs: Record<string, string | null> }) => {
        servedMap = { ...(servedMap ?? {}), ...args.p_pairs }
        return { data: servedMap, error: null }
      },
    }),
  },
})
mock.module('@/lib/projection/recompute', { namedExports: { recomputeLearnerProjection: async () => ({}) } })
mock.module('@/lib/adaptiveLearning/recommend', { namedExports: { buildAdaptiveTask: () => ({ groupType: 'BE' }) } })
mock.module('@/lib/curriculum/service', { namedExports: { CurriculumService: { resolveSubstrandContext: async () => null } } })
mock.module('@/lib/assignments/variantGeneration', {
  namedExports: { BAND_TO_TIER: { BE: 'foundation', AE: 'guided_practice', ME: 'supported_practice', EE: 'extension' } },
})
mock.module('@/lib/assignments/variants', {
  namedExports: {
    findApprovedVariant: async (questionId: string, tier: string) => (questionId === 'q1' && tier === 'foundation' ? FOUNDATION_VARIANT : null),
    findVariantById: async (id: string) => (id === 'v1' ? FOUNDATION_VARIANT : null),
  },
})
mock.module('./quiz', { namedExports: { findQuestionsForTeacher: async () => CANONICAL_QUESTIONS } })

let findServedQuestionsForStudent: typeof import('./quizDelivery').findServedQuestionsForStudent
before(async () => {
  ;({ findServedQuestionsForStudent } = await import('./quizDelivery'))
})

const ALLOWED_KEYS = ['choices', 'id', 'order_index', 'question_text']

function assertLearnerSafe(questions: unknown[]): void {
  for (const q of questions) assert.deepEqual(Object.keys(q as object).sort(), ALLOWED_KEYS)
  const wire = JSON.stringify(questions)
  assert.doesNotMatch(wire, /correct_index|correctIndex|explanation|misconception|rationale|cognitive_intent|learning_outcome|variant_type|status/)
  for (const marker of TEACHER_ONLY_MARKERS) assert.equal(wire.includes(marker), false, marker)
}

test('G: first open — the learner gets the variant text/choices only; no answer key or teacher notes cross the boundary', async () => {
  servedMap = null
  const questions = await findServedQuestionsForStudent({ assignmentId: 'a1', studentId: 's1', learnerName: 'Learner' })
  assert.deepEqual(questions, [
    { id: 'q1', question_text: 'Foundation Q1 with a worked example', choices: ['y', 'w', 'x', 'z'], order_index: 0 },
    { id: 'q2', question_text: 'Canonical Q2', choices: ['p', 'q'], order_index: 1 },
  ])
  assertLearnerSafe(questions)
})

test('G: repeat open (already-bound map) — same learner-safe shape', async () => {
  servedMap = { q1: 'v1', q2: null }
  const questions = await findServedQuestionsForStudent({ assignmentId: 'a1', studentId: 's1', learnerName: 'Learner' })
  assert.equal(questions[0].question_text, 'Foundation Q1 with a worked example')
  assertLearnerSafe(questions)
})
