// lib/quiz/quizDelivery.integration.test.ts
//
// Sprint 9 Slice 3 — Adaptive Assessment Delivery & Variant-Aware Grading.
// Validates against real, synthetic (throwaway) data and the real,
// migrated schema: a real teacher/class/assignment/canonical question, one
// student seeded with real confirmed Evidence (via recordQuizAutoGradeEvidence,
// the same producer used elsewhere), a real approved variant, and the real
// resolve_served_variants_batch() RPC. No AI calls, no mocks — this slice
// has no AI call of its own (delivery/grading only), so nothing needs mocking.
//
// Run: npx tsx --env-file=.env.local --test lib/quiz/quizDelivery.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { replaceQuestions, findQuestionsForTeacher, gradeAndSubmitQuiz } from '@/lib/quiz/quiz'
import { resolveServedVariantsForStudent, findServedQuestionsForStudent } from '@/lib/quiz/quizDelivery'
import { createDraftVariants, approveVariant, regenerateVariant } from '@/lib/assignments/variants'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_DELIVERY_TEST'
const db = createServiceClient()
const SUBJECT = 'Mathematics'

let authUserId: string
let teacherId: string
let classId: string
let assignmentId: string
let questionId: string
let studentId: string // level 2 -> prerequisite_gap -> foundation

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `delivery-test-${Date.now()}@example.com`,
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

  const { data: student, error: studentErr } = await db
    .from('students').insert({ user_id: null, name: `${SYNTHETIC_MARKER} Student`, grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentErr) throw studentErr
  studentId = student.id
  await db.from('class_students').insert({ class_id: classId, student_id: studentId })

  // Level 2 (40%, thresholds 75/50/30) -> classifyGroup -> prerequisite_gap -> foundation tier.
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: `${SYNTHETIC_MARKER}-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null,
    score: 40, maxScore: 100, academicYear: 2026, term: 1,
  })

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Delivery Test Quiz',
      subject: SUBJECT, topic: 'Fractions', instructions: 'Answer all questions',
      due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 10, is_quiz: true,
    })
    .select('id').single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id
  // The real POST route pre-creates a pending submission row per enrolled
  // student at assignment-creation time — mirrored here since this fixture
  // inserts the assignment directly, not through that route.
  await db.from('assignment_submissions').insert({ assignment_id: assignmentId, student_id: studentId, class_id: classId, status: 'pending' })

  await replaceQuestions(assignmentId, [
    { questionText: 'Calculate: 3/8 + 2/8', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0 },
  ])
  const [question] = await findQuestionsForTeacher(assignmentId)
  questionId = question.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  if (studentId) {
    await db.from('learner_evidence').delete().eq('learner_id', studentId)
    await db.from('students').delete().eq('id', studentId)
  }
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) {
    await db.from('notification_log').delete().eq('user_id', authUserId)
    await db.from('platform_events').delete().eq('actor_id', authUserId)
    await db.from('ingestion_runs').delete().eq('initiated_by', authUserId)
    await deleteAuthUserOrThrow(db, authUserId)
  }
})

test('first open creates exactly one immutable mapping, bound to the approved foundation variant', async () => {
  const [draft] = await createDraftVariants([{
    questionId, variantType: 'foundation',
    questionText: 'Foundation: 3/8 + 2/8, step by step', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0,
  }])
  const approved = await approveVariant(draft.id)

  const map = await resolveServedVariantsForStudent({ assignmentId, studentId, learnerName: 'Test Student' })
  assert.equal(map[questionId], approved.id)

  const { data: submission } = await db.from('assignment_submissions').select('served_variant_map').eq('assignment_id', assignmentId).eq('student_id', studentId).single()
  assert.deepEqual(submission!.served_variant_map, map)
})

test('repeat opens always return the identical variant, even after the bound variant is regenerated (archived)', async () => {
  const firstMap = await resolveServedVariantsForStudent({ assignmentId, studentId, learnerName: 'Test Student' })
  const boundVariantId = firstMap[questionId]!

  // Regenerate — archives the bound variant, approves nothing new automatically.
  await regenerateVariant(boundVariantId, { questionText: 'Regenerated foundation text', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0 })

  const secondMap = await resolveServedVariantsForStudent({ assignmentId, studentId, learnerName: 'Test Student' })
  assert.equal(secondMap[questionId], boundVariantId, 'must never re-roll to a newer variant after first resolution')
})

test('concurrent first-open requests for a fresh (assignment, student) never create two different mappings', async () => {
  // A second, independent student/assignment pair so this test's own
  // concurrency race is isolated from the already-resolved fixture above.
  const { data: student2 } = await db.from('students').insert({ user_id: null, name: `${SYNTHETIC_MARKER} Concurrent`, grade: 8, level: 'Junior School' }).select('id').single()
  await db.from('class_students').insert({ class_id: classId, student_id: student2!.id })
  await recordQuizAutoGradeEvidence({
    studentId: student2!.id, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-concurrent-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null, score: 40, maxScore: 100, academicYear: 2026, term: 1,
  })
  const { data: assignment2 } = await db.from('assignments').insert({
    class_id: classId, teacher_id: teacherId, title: 'Concurrent Test Quiz', subject: SUBJECT, topic: 'Fractions',
    instructions: 'x', due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 10, is_quiz: true,
  }).select('id').single()
  await db.from('assignment_submissions').insert({ assignment_id: assignment2!.id, student_id: student2!.id, class_id: classId, status: 'pending' })
  await replaceQuestions(assignment2!.id, [{ questionText: 'Q', choices: ['A', 'B'], correctIndex: 0 }])
  const [q2] = await findQuestionsForTeacher(assignment2!.id)
  const [draft2] = await createDraftVariants([{ questionId: q2.id, variantType: 'foundation', questionText: 'Foundation Q', choices: ['A', 'B'], correctIndex: 0 }])
  await approveVariant(draft2.id)

  const [resultA, resultB] = await Promise.all([
    resolveServedVariantsForStudent({ assignmentId: assignment2!.id, studentId: student2!.id, learnerName: 'Concurrent' }),
    resolveServedVariantsForStudent({ assignmentId: assignment2!.id, studentId: student2!.id, learnerName: 'Concurrent' }),
  ])

  assert.equal(resultA[q2.id], resultB[q2.id], 'both concurrent callers must agree on the single authoritative variant')

  const { data: finalSubmission } = await db.from('assignment_submissions').select('served_variant_map').eq('assignment_id', assignment2!.id).eq('student_id', student2!.id).single()
  assert.equal(finalSubmission!.served_variant_map[q2.id], resultA[q2.id])

  await db.from('assignments').delete().eq('id', assignment2!.id)
  await db.from('students').delete().eq('id', student2!.id)
})

test('findServedQuestionsForStudent serves the bound variant\'s own (original, pre-regeneration) text, never the canonical text, and never leaks correct_index', async () => {
  const questions = await findServedQuestionsForStudent({ assignmentId, studentId, learnerName: 'Test Student' })
  assert.equal(questions.length, 1)
  // The student is bound to the ORIGINAL approved variant, which the prior
  // test regenerated (archived) — the student must keep seeing that
  // original text, never the new regenerated one, since resolution never
  // re-runs after first open.
  assert.equal(questions[0].question_text, 'Foundation: 3/8 + 2/8, step by step')
  assert.ok(!('correct_index' in questions[0]))
})

test('grading uses the bound variant\'s answer key, not the canonical one — deliberately different correct indices to prove which key wins', async () => {
  // A fresh question+student+assignment, isolated from the shared fixture
  // above: canonical correctIndex=0 ("WrongIfCanonical"), the approved
  // variant's correctIndex=1 ("RightIfVariant") — the two disagree on
  // purpose, so the grade result unambiguously reveals which key was used.
  const { data: student4 } = await db.from('students').insert({ user_id: null, name: `${SYNTHETIC_MARKER} Grading`, grade: 8, level: 'Junior School' }).select('id').single()
  await db.from('class_students').insert({ class_id: classId, student_id: student4!.id })
  await recordQuizAutoGradeEvidence({
    studentId: student4!.id, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-grading-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null, score: 40, maxScore: 100, academicYear: 2026, term: 1,
  })
  const { data: assignment4 } = await db.from('assignments').insert({
    class_id: classId, teacher_id: teacherId, title: 'Grading Test Quiz', subject: SUBJECT, topic: 'Fractions',
    instructions: 'x', due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 10, is_quiz: true,
  }).select('id').single()
  await db.from('assignment_submissions').insert({ assignment_id: assignment4!.id, student_id: student4!.id, class_id: classId, status: 'pending' })
  await replaceQuestions(assignment4!.id, [{ questionText: 'Canonical Q', choices: ['WrongIfCanonical', 'RightIfVariant'], correctIndex: 0 }])
  const [q4] = await findQuestionsForTeacher(assignment4!.id)
  const [draft4] = await createDraftVariants([{ questionId: q4.id, variantType: 'foundation', questionText: 'Variant Q', choices: ['WrongIfCanonical', 'RightIfVariant'], correctIndex: 1 }])
  await approveVariant(draft4.id)

  // Binds the student to the approved foundation variant (correctIndex 1).
  await resolveServedVariantsForStudent({ assignmentId: assignment4!.id, studentId: student4!.id, learnerName: 'Grading' })

  const { grade } = await gradeAndSubmitQuiz({
    assignmentId: assignment4!.id, studentId: student4!.id, classId, maxScore: 10,
    answers: [{ questionId: q4.id, selectedIndex: 1 }], // correct per the VARIANT, wrong per canonical
  })
  assert.equal(grade.correctCount, 1, 'grading must have used the variant\'s correctIndex (1), not the canonical one (0)')

  await db.from('assignments').delete().eq('id', assignment4!.id)
  await db.from('learner_evidence').delete().eq('learner_id', student4!.id)
  await db.from('students').delete().eq('id', student4!.id)
})

test('archived variants remain gradable: a submission bound to an already-archived variant still grades against its answer key', async () => {
  const [question] = await findQuestionsForTeacher(assignmentId)
  // At this point (after the "repeat opens" test earlier) studentId's bound
  // variant for `questionId` has already been regenerated into an archived
  // state — grading it now proves an archived row is still fully readable.
  const { submission, grade } = await gradeAndSubmitQuiz({
    assignmentId, studentId, classId, maxScore: 10,
    answers: [{ questionId: question.id, selectedIndex: 0 }], // the archived variant's own correctIndex
  })
  assert.equal(grade.correctCount, 1)
  assert.equal(submission.status, 'marked')
})

test('evidence emission and Projection recomputation are unchanged — no variant-awareness needed in either', async () => {
  // Deliberately not asserting on history array length: the Evidence
  // Domain's own supersede/corroboration semantics for same-subject,
  // same-topic evidence are out of this delivery-focused test's scope
  // (and out of Sprint 9 Slice 3 entirely — Evidence needs zero changes,
  // confirmed again here). What this test proves is narrower and directly
  // relevant: a normal recordQuizAutoGradeEvidence call, made after a
  // variant-graded submission, produces a normal evidence row, and
  // Projection reflects its score with no variant-specific code path.
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-post-grade`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null,
    score: 100, maxScore: 100, academicYear: 2026, term: 1,
  })

  const { data: evidenceRow } = await db
    .from('learner_evidence')
    .select('evidence_source, score, subject')
    .eq('learner_id', studentId)
    .like('raw_input_ref', `assignment:${SYNTHETIC_MARKER}-post-grade%`)
    .single()
  assert.equal(evidenceRow!.evidence_source, 'quiz_auto_grade')
  assert.equal(evidenceRow!.score, 100)

  const afterProjection = await recomputeLearnerProjection(studentId)
  const afterLatestLevel = afterProjection.academic?.value.bySubject[SUBJECT]?.latestLevel
  assert.equal(afterLatestLevel, 4, 'Projection reflects the new evidence\'s level (100% -> CBC level 4) automatically, no variant-specific code path needed')
})

test('fallback path: a tier with no approved variant serves the canonical question, recorded as a real (not absent) null mapping', async () => {
  const { data: student3 } = await db.from('students').insert({ user_id: null, name: `${SYNTHETIC_MARKER} Fallback`, grade: 8, level: 'Junior School' }).select('id').single()
  await db.from('class_students').insert({ class_id: classId, student_id: student3!.id })
  await db.from('assignment_submissions').insert({ assignment_id: assignmentId, student_id: student3!.id, class_id: classId, status: 'pending' })
  // Level 4 -> on_track -> extension tier; no approved extension variant exists for this question.
  await recordQuizAutoGradeEvidence({
    studentId: student3!.id, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-fallback-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null, score: 95, maxScore: 100, academicYear: 2026, term: 1,
  })

  const map = await resolveServedVariantsForStudent({ assignmentId, studentId: student3!.id, learnerName: 'Fallback' })
  assert.equal(map[questionId], null, 'no approved extension variant exists — honest null, not an error')

  const questions = await findServedQuestionsForStudent({ assignmentId, studentId: student3!.id, learnerName: 'Fallback' })
  assert.equal(questions[0].question_text, 'Calculate: 3/8 + 2/8', 'falls back to the canonical question text')

  // Sticky — a second open must not re-attempt resolution now that an
  // approved extension variant might exist; it stays null.
  const mapAgain = await resolveServedVariantsForStudent({ assignmentId, studentId: student3!.id, learnerName: 'Fallback' })
  assert.equal(mapAgain[questionId], null)

  await db.from('learner_evidence').delete().eq('learner_id', student3!.id)
  await db.from('students').delete().eq('id', student3!.id)
})

// ── Adaptive Remediation Phase 1, Stage 6 ───────────────────────────────────
//
// The audit asked whether the sticky null is intentional product behaviour
// or an accidental artifact of immutability. It is INTENTIONAL, and this
// test exists so that stays a decision rather than a discovery.
//
// The scenario: a learner opens a quiz before the teacher has approved
// variants, is honestly bound to the canonical question (a real null), and
// the teacher approves the matching tier afterwards. The binding must not
// move. Re-resolving would swap the question underneath a learner who may
// be mid-attempt, and — because grading resolves the answer key from this
// same map — would grade them against a key belonging to a question they
// never saw.
//
// The residual cost (a learner in that window stays canonical for the whole
// assignment) is now visible rather than silent: Stage 1's provenance
// records `servedTier: null` with `questionsServedCanonical > 0` on the
// resulting evidence. The real remedy is upstream — not letting learners
// open a quiz whose variants are still unapproved — which is a publishing
// gate, not a change to this binding.

test('Stage 6: a null bound BEFORE approval stays null after the matching tier is approved', async () => {
  const { data: student5 } = await db.from('students')
    .insert({ user_id: null, name: `${SYNTHETIC_MARKER} PreApproval`, grade: 8, level: 'Junior School' })
    .select('id').single()
  await db.from('class_students').insert({ class_id: classId, student_id: student5!.id })
  await db.from('assignment_submissions').insert({ assignment_id: assignmentId, student_id: student5!.id, class_id: classId, status: 'pending' })

  // Level 4 -> on_track -> extension tier, which has no approved variant yet.
  await recordQuizAutoGradeEvidence({
    studentId: student5!.id, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-preapproval-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null, score: 95, maxScore: 100, academicYear: 2026, term: 1,
  })

  const before = await resolveServedVariantsForStudent({ assignmentId, studentId: student5!.id, learnerName: 'PreApproval' })
  assert.equal(before[questionId], null, 'opened before approval — honestly bound to the canonical question')

  // The teacher now approves exactly the tier this learner would have needed.
  const [extensionDraft] = await createDraftVariants([{
    questionId, variantType: 'extension',
    questionText: 'Extension: 3/8 + 2/8, then justify your method', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0,
  }])
  const approvedExtension = await approveVariant(extensionDraft.id)

  const after = await resolveServedVariantsForStudent({ assignmentId, studentId: student5!.id, learnerName: 'PreApproval' })
  assert.equal(after[questionId], null,
    'the binding is immutable in BOTH directions — a later approval never rewrites what a learner was already served')

  const questions = await findServedQuestionsForStudent({ assignmentId, studentId: student5!.id, learnerName: 'PreApproval' })
  assert.equal(questions[0].question_text, 'Calculate: 3/8 + 2/8',
    'and the learner keeps seeing the exact question they started with')

  // A learner who had NOT yet opened is unaffected by the same approval —
  // proof that this is stickiness of an existing binding, not a global
  // refusal to ever serve the extension tier.
  const { data: student6 } = await db.from('students')
    .insert({ user_id: null, name: `${SYNTHETIC_MARKER} PostApproval`, grade: 8, level: 'Junior School' })
    .select('id').single()
  await db.from('class_students').insert({ class_id: classId, student_id: student6!.id })
  await db.from('assignment_submissions').insert({ assignment_id: assignmentId, student_id: student6!.id, class_id: classId, status: 'pending' })
  await recordQuizAutoGradeEvidence({
    studentId: student6!.id, initiatedBy: authUserId, assignmentId: `${SYNTHETIC_MARKER}-postapproval-seed`,
    subject: SUBJECT, topic: 'Fractions', substrandId: null, score: 95, maxScore: 100, academicYear: 2026, term: 1,
  })

  const fresh = await resolveServedVariantsForStudent({ assignmentId, studentId: student6!.id, learnerName: 'PostApproval' })
  assert.equal(fresh[questionId], approvedExtension.id,
    'a learner opening after approval gets the extension variant — the window is the only thing lost, not the tier')

  await db.from('assignment_question_variants').delete().eq('id', approvedExtension.id)
  for (const s of [student5!.id, student6!.id]) {
    await db.from('learner_evidence').delete().eq('learner_id', s)
    await db.from('students').delete().eq('id', s)
  }
})
