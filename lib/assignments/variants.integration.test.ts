// lib/assignments/variants.integration.test.ts
//
// Sprint 9 Slice 1 (ADR-0025 / Sprint 4B design) — validates the variant
// persistence schema and lifecycle against real, synthetic (throwaway)
// data: the partial-unique-approved index, the lifecycle-transition
// trigger, and the atomic archive-on-regenerate operation.
//
// Run: npx tsx --env-file=.env.local --test lib/assignments/variants.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { replaceQuestions, findQuestionsForTeacher } from '@/lib/quiz/quiz'
import {
  createDraftVariants, findVariantsForQuestion, findApprovedVariant, findVariantById,
  approveVariant, rejectVariant, regenerateVariant,
} from './variants'

const SYNTHETIC_MARKER = 'SYNTHETIC_VARIANT_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let assignmentId: string
let questionId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `variant-test-${Date.now()}@example.com`,
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
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  classId = cls.id

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Variant Test Quiz',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Answer all questions',
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
  if (classId) await db.from('teacher_classes').delete().eq('id', classId) // cascades assignments/assignment_questions/variants
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('createDraftVariants + findVariantsForQuestion: round-trips, always status=draft, generated_by=ai by default', async () => {
  const [created] = await createDraftVariants([{
    questionId, variantType: 'foundation',
    questionText: 'Step 1: are the denominators the same? Step 2: add only the numerators.',
    choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0,
    difficultyRationale: 'Guided reasoning for a critical_gap learner.',
  }])

  assert.equal(created.status, 'draft')
  assert.equal(created.generated_by, 'ai')
  assert.equal(created.variant_type, 'foundation')

  const all = await findVariantsForQuestion(questionId)
  assert.equal(all.length, 1)
  assert.equal(all[0].id, created.id)
})

test('findApprovedVariant: returns null until a draft is actually approved', async () => {
  const [draft] = await findVariantsForQuestion(questionId)
  assert.equal(await findApprovedVariant(questionId, 'foundation'), null)

  const approved = await approveVariant(draft.id)
  assert.equal(approved.status, 'approved')
  assert.ok(approved.approved_at)

  const found = await findApprovedVariant(questionId, 'foundation')
  assert.equal(found?.id, draft.id)
})

test('DB constraint: a second approved variant for the same (question, tier) is rejected — the one guarantee this design leans on', async () => {
  const [second] = await createDraftVariants([{
    questionId, variantType: 'foundation',
    questionText: 'A second foundation attempt', choices: ['5/8', '5/16'], correctIndex: 0,
  }])

  await assert.rejects(
    () => approveVariant(second.id),
    /duplicate key|unique/i,
  )
})

test('Lifecycle trigger: an approved variant can never be edited back to draft', async () => {
  const approved = await findApprovedVariant(questionId, 'foundation')
  await assert.rejects(
    async () => { await db.from('assignment_question_variants').update({ status: 'draft' }).eq('id', approved!.id).throwOnError() },
    /Invalid variant lifecycle transition/i,
  )
})

test('rejectVariant: a rejected variant is not approved, and rejection itself is terminal (except via regeneration)', async () => {
  const [rejectable] = await createDraftVariants([{
    questionId, variantType: 'extension',
    questionText: 'An extension variant', choices: ['5/8', '5/16'], correctIndex: 0,
  }])
  const rejected = await rejectVariant(rejectable.id)
  assert.equal(rejected.status, 'rejected')
  assert.equal(await findApprovedVariant(questionId, 'extension'), null)
})

test('regenerateVariant: archives the old row (superseded_by set) and inserts a fresh draft, atomically', async () => {
  const approvedBefore = await findApprovedVariant(questionId, 'foundation')
  assert.ok(approvedBefore)

  const regenerated = await regenerateVariant(approvedBefore!.id, {
    questionText: 'Regenerated: Step 1... Step 2...',
    choices: ['5/8', '5/16', '1', '6/8'],
    correctIndex: 0,
  })

  assert.equal(regenerated.status, 'draft')
  assert.equal(regenerated.variant_type, 'foundation') // tier preserved
  assert.equal(regenerated.question_id, questionId)    // canonical question preserved

  const oldRow = await findVariantById(approvedBefore!.id)
  assert.equal(oldRow?.status, 'archived')
  assert.ok(oldRow?.archived_at)
  assert.equal(oldRow?.superseded_by, regenerated.id)

  // The old (now archived) row is STILL fully readable — a future grading
  // path must be able to resolve it for a learner already served it.
  assert.equal(oldRow?.question_text, approvedBefore!.question_text)
})

test('An archived variant is fully immutable — even a status-only update is rejected', async () => {
  const archived = await db
    .from('assignment_question_variants')
    .select('id')
    .eq('question_id', questionId)
    .eq('status', 'archived')
    .limit(1)
    .single()

  await assert.rejects(
    async () => { await db.from('assignment_question_variants').update({ teacher_explanation: 'trying to edit anyway' }).eq('id', archived.data!.id).throwOnError() },
    /is archived and immutable/i,
  )
})
