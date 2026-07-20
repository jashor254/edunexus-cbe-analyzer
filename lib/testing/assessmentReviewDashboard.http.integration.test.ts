// lib/testing/assessmentReviewDashboard.http.integration.test.ts
//
// Sprint 8 (Assessment Excellence) — proves the three new Review Dashboard
// endpoints against real, signed-in HTTP clients: the batched GET (fixes
// the prior one-request-per-question N+1), bulk-action approve/reject
// (loops the exact same approveVariant()/rejectVariant() every single-
// variant click already calls — no new lifecycle logic), and generate-all's
// skip-already-covered-questions logic. Draft variants are inserted
// directly via the service client rather than through real AI generation —
// deterministic, fast, and doesn't burn AI cost testing the review/bulk
// layer, which is what this file is actually about.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/assessmentReviewDashboard.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT8_REVIEW_DASHBOARD_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const teacherRowIds: string[] = []
const classIds: string[] = []
const assignmentIds: string[] = []
const questionIds: string[] = []
const variantIds: string[] = []

let teacherSession: SyntheticSession
let otherTeacherSession: SyntheticSession
let assignmentId: string
let questionAId: string
let questionBId: string
let variantAId: string
let variantBId: string
let foreignVariantId: string

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { authId: data.user.id, session }
}

before(async () => {
  const teacher = await createUser('teacher')
  const otherTeacher = await createUser('other-teacher')
  teacherSession = teacher.session
  otherTeacherSession = otherTeacher.session

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  const { data: otherTeacherRow, error: otherTeacherErr } = await db
    .from('teachers').insert({ user_id: otherTeacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (otherTeacherErr) throw otherTeacherErr
  teacherRowIds.push(otherTeacherRow.id)

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  classIds.push(cls.id)

  // A second class/assignment owned by the OTHER teacher — proves bulk-action
  // can't be used to touch a variant outside this assignment's own questions.
  const { data: foreignCls, error: foreignClsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: otherTeacherRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_foreign_${Date.now()}` })
    .select('id').single()
  if (foreignClsErr) throw foreignClsErr
  classIds.push(foreignCls.id)

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: cls.id, teacher_id: teacherRow.id, title: SYNTHETIC_MARKER, subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Adaptive quiz', type: 'graded', max_score: 10, is_quiz: true, is_adaptive: true, status: 'draft',
      due_date: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })
    .select('id').single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id
  assignmentIds.push(assignmentId)

  const { data: foreignAssignment, error: foreignAssignErr } = await db
    .from('assignments')
    .insert({
      class_id: foreignCls.id, teacher_id: otherTeacherRow.id, title: SYNTHETIC_MARKER, subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Foreign adaptive quiz', type: 'graded', max_score: 10, is_quiz: true, is_adaptive: true, status: 'draft',
      due_date: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })
    .select('id').single()
  if (foreignAssignErr) throw foreignAssignErr
  assignmentIds.push(foreignAssignment.id)

  const { data: qA, error: qAErr } = await db
    .from('assignment_questions')
    .insert({ assignment_id: assignmentId, question_text: 'What is 1/2 + 1/4?', choices: ['3/4', '1/2', '1', '2/6'], correct_index: 0, order_index: 0 })
    .select('id').single()
  if (qAErr) throw qAErr
  questionAId = qA.id
  questionIds.push(questionAId)

  const { data: qB, error: qBErr } = await db
    .from('assignment_questions')
    .insert({ assignment_id: assignmentId, question_text: 'What is 2/3 of 9?', choices: ['6', '3', '9', '2'], correct_index: 0, order_index: 1 })
    .select('id').single()
  if (qBErr) throw qBErr
  questionBId = qB.id
  questionIds.push(questionBId)

  const { data: foreignQ, error: foreignQErr } = await db
    .from('assignment_questions')
    .insert({ assignment_id: foreignAssignment.id, question_text: 'Foreign question', choices: ['A', 'B'], correct_index: 0, order_index: 0 })
    .select('id').single()
  if (foreignQErr) throw foreignQErr
  questionIds.push(foreignQ.id)

  const { data: vA, error: vAErr } = await db
    .from('assignment_question_variants')
    .insert({ question_id: questionAId, variant_type: 'foundation', question_text: 'Foundation: 1/2 + 1/4?', choices: ['3/4', '1/2'], correct_index: 0, status: 'draft', generated_by: 'ai' })
    .select('id').single()
  if (vAErr) throw vAErr
  variantAId = vA.id
  variantIds.push(variantAId)

  const { data: vB, error: vBErr } = await db
    .from('assignment_question_variants')
    .insert({ question_id: questionBId, variant_type: 'extension', question_text: 'Extension: 2/3 of 9?', choices: ['6', '3'], correct_index: 0, status: 'draft', generated_by: 'ai' })
    .select('id').single()
  if (vBErr) throw vBErr
  variantBId = vB.id
  variantIds.push(variantBId)

  const { data: fV, error: fVErr } = await db
    .from('assignment_question_variants')
    .insert({ question_id: foreignQ.id, variant_type: 'foundation', question_text: 'Foreign variant', choices: ['A', 'B'], correct_index: 0, status: 'draft', generated_by: 'ai' })
    .select('id').single()
  if (fVErr) throw fVErr
  foreignVariantId = fV.id
  variantIds.push(foreignVariantId)
})

after(async () => {
  await db.from('assignment_question_variants').delete().in('id', variantIds)
  await db.from('assignment_questions').delete().in('id', questionIds)
  await db.from('assignments').delete().in('id', assignmentIds)
  await db.from('teacher_classes').delete().in('id', classIds)
  await db.from('teachers').delete().in('id', teacherRowIds)
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
  console.log('[cleanup] synthetic Sprint 8 Review Dashboard fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── Batched GET (fixes the N+1 fetch) ────────────────────────────────────────

test('GET /api/teacher/assignments/[id]/variants: owning teacher gets every question\'s variants in one call', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants`, { headers: cookie(teacherSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  const ids = body.data.variants.map((v: { id: string }) => v.id)
  assert.ok(ids.includes(variantAId))
  assert.ok(ids.includes(variantBId))
  assert.ok(!ids.includes(foreignVariantId), 'must not leak a variant from another teacher\'s assignment')
})

test('GET /api/teacher/assignments/[id]/variants: a non-owning teacher is forbidden', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants`, { headers: cookie(otherTeacherSession) })
  assert.equal(res.status, 403)
})

test('GET /api/teacher/assignments/[id]/variants: unauthenticated is rejected', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants`)
  assert.equal(res.status, 401)
})

// ── Bulk approve/reject ──────────────────────────────────────────────────────

test('POST /api/teacher/assignments/[id]/variants/bulk-action: approves multiple variants in one call, ignores a foreign variant id', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants/bulk-action`, {
    method: 'POST',
    headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantIds: [variantAId, variantBId, foreignVariantId], action: 'approve' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.deepEqual(new Set(body.data.succeeded), new Set([variantAId, variantBId]))
  assert.equal(body.data.skipped.count, 1)

  const { data: refetched } = await db.from('assignment_question_variants').select('id, status').in('id', [variantAId, variantBId])
  assert.ok(refetched?.every(v => v.status === 'approved'))

  const { data: foreignAfter } = await db.from('assignment_question_variants').select('status').eq('id', foreignVariantId).single()
  assert.equal(foreignAfter?.status, 'draft', 'the foreign variant must be untouched, not silently approved')
})

test('POST /api/teacher/assignments/[id]/variants/bulk-action: a non-owning teacher is forbidden', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants/bulk-action`, {
    method: 'POST',
    headers: { ...cookie(otherTeacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantIds: [variantAId], action: 'reject' }),
  })
  assert.equal(res.status, 403)
})

test('POST /api/teacher/assignments/[id]/variants/bulk-action: rejects a malformed body', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants/bulk-action`, {
    method: 'POST',
    headers: { ...cookie(teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantIds: [], action: 'approve' }),
  })
  assert.equal(res.status, 400)
})

// ── Generate All — skip-already-covered logic (no real AI call needed) ──────

test('POST /api/teacher/assignments/[id]/variants/generate-all: skips questions that already have variants', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants/generate-all`, {
    method: 'POST',
    headers: cookie(teacherSession),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  // Both questionA and questionB already have a (now-approved) variant from
  // the bulk-approve test above, so generate-all must skip both — proving
  // the skip logic without needing a real, costly AI generation call.
  assert.equal(body.data.processedCount, 0)
  assert.equal(body.data.skippedCount, 2)
})

test('POST /api/teacher/assignments/[id]/variants/generate-all: a non-owning teacher is forbidden', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${assignmentId}/variants/generate-all`, {
    method: 'POST',
    headers: cookie(otherTeacherSession),
  })
  assert.equal(res.status, 403)
})
