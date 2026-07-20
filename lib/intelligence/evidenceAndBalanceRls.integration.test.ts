// lib/intelligence/evidenceAndBalanceRls.integration.test.ts
//
// Sprint 1 (Platform Audit v1.0, Blockers #1 and #2) — proves the two
// Critical RLS fixes against real, signed-in, RLS-bound clients (not the
// service-role client every other test in this codebase uses to set up
// fixtures). Two things must be true after the migration
// 20260720120000_sprint1_critical_rls_fixes.sql:
//
//   1. learner_evidence is readable by the CURRENT teacher/parent of the
//      learner it's about — never by who happened to enter the record
//      (the anti-pattern CLAUDE.md forbids). An unrelated teacher who
//      entered a record for a student they do not teach must NOT be able
//      to read it back.
//   2. token_balances can no longer be updated directly by the user it
//      belongs to — only through deduct_tokens()/grant functions or the
//      service-role client.
//
// ⚠️ Creates real (throwaway) auth.users accounts, teachers/students/
// teacher_classes/class_students/ingestion_runs/learner_evidence rows, all
// deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/evidenceAndBalanceRls.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { startIngestionRun } from './ingestionRun'
import { persistEvidenceBatch } from './evidenceLifecycle'
import type { LearnerEvidence } from './evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT1_RLS_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const authUserIds: string[] = []
const teacherRowIds: string[] = []
const studentIds: string[] = []
const teacherClassIds: string[] = []
const ingestionRunIds: string[] = []

let teacherA: { id: string; email: string }   // direct-link owner of studentDirect
let teacherB: { id: string; email: string }   // unrelated teacher — must be denied everywhere
let teacherC: { id: string; email: string }   // roster owner (via class_students) of studentRoster
let parentRoster: { id: string; email: string }   // linked via class_students.parent_id to studentRoster
let parentDirect: { id: string; email: string }   // linked via students.parent_user_id to studentParent

let teacherAId: string
let teacherCId: string
let studentDirectId: string
let studentRosterId: string
let studentParentId: string

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

async function mkEvidenceFor(learnerId: string, initiatedBy: string): Promise<void> {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy, teacherId: null, institution: SYNTHETIC_MARKER })
  ingestionRunIds.push(run.id)
  const evidence: LearnerEvidence = {
    learnerId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 80, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: `test:${SYNTHETIC_MARKER}:${learnerId}`,
    importedAt: new Date().toISOString(), issues: [],
  }
  await persistEvidenceBatch([evidence], run.id)
}

before(async () => {
  teacherA = await mkAuthUser('sprint1-teacherA')
  teacherB = await mkAuthUser('sprint1-teacherB')
  teacherC = await mkAuthUser('sprint1-teacherC')
  parentRoster = await mkAuthUser('sprint1-parentRoster')
  parentDirect = await mkAuthUser('sprint1-parentDirect')

  // Real signups get a token_balances row via app-level onboarding code
  // (app/api/admin/activate-user, students/create, etc. all upsert one
  // explicitly) — auth.admin.createUser() alone does not go through any of
  // those flows, so the fixture creates it directly, matching what a real
  // onboarded user would already have.
  {
    const { error } = await db.from('token_balances').upsert({ user_id: teacherA.id, balance: 10, total_ever: 10 })
    if (error) throw error
  }

  for (const [label, u] of [['A', teacherA], ['C', teacherC]] as const) {
    const { data, error } = await db.from('teachers')
      .insert({ user_id: u.id, full_name: `${SYNTHETIC_MARKER}_${label}`, school: SYNTHETIC_MARKER })
      .select('id').single()
    if (error) throw error
    teacherRowIds.push(data.id)
    if (label === 'A') teacherAId = data.id
    if (label === 'C') teacherCId = data.id
  }

  // studentDirect: owned via students.teacher_id (teacherA)
  {
    const { data, error } = await db.from('students')
      .insert({ teacher_id: teacherAId, name: `${SYNTHETIC_MARKER}_direct`, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
      .select('id').single()
    if (error) throw error
    studentDirectId = data.id
    studentIds.push(data.id)
  }

  // studentRoster: owned via class_students roster (teacherC's class), parent via class_students.parent_id
  {
    const { data, error } = await db.from('students')
      .insert({ name: `${SYNTHETIC_MARKER}_roster`, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
      .select('id').single()
    if (error) throw error
    studentRosterId = data.id
    studentIds.push(data.id)
  }
  {
    const { data: cls, error: clsErr } = await db.from('teacher_classes')
      .insert({ teacher_id: teacherCId, name: `${SYNTHETIC_MARKER}_class`, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
      .select('id').single()
    if (clsErr) throw clsErr
    teacherClassIds.push(cls.id)
    const { error: csErr } = await db.from('class_students')
      .insert({ class_id: cls.id, student_id: studentRosterId, parent_id: parentRoster.id })
    if (csErr) throw csErr
  }

  // studentParent: owned via students.parent_user_id (parentDirect) — no teacher link
  {
    const { data, error } = await db.from('students')
      .insert({ name: `${SYNTHETIC_MARKER}_parentdirect`, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, parent_user_id: parentDirect.id, added_by: 'parent' })
      .select('id').single()
    if (error) throw error
    studentParentId = data.id
    studentIds.push(data.id)
  }

  // Evidence for all three, deliberately entered by teacherB (the unrelated
  // teacher) — proving access no longer depends on who entered the record.
  await mkEvidenceFor(studentDirectId, teacherB.id)
  await mkEvidenceFor(studentRosterId, teacherB.id)
  await mkEvidenceFor(studentParentId, teacherB.id)
})

after(async () => {
  if (ingestionRunIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', ingestionRunIds)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('ingestion_runs').delete().in('id', ingestionRunIds)
  }
  if (teacherClassIds.length > 0) await db.from('teacher_classes').delete().in('id', teacherClassIds) // cascades class_students
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().in('id', teacherRowIds)
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
  console.log('[cleanup] synthetic Sprint 1 RLS fixtures removed')
})

// ── learner_evidence: current-teacher/parent read, not entering-teacher ─────

test('the direct-link teacher (students.teacher_id) can read the learner\'s evidence', async () => {
  const client = await signInAs(teacherA.email)
  const { data, error } = await client.from('learner_evidence').select('id').eq('learner_id', studentDirectId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('the roster teacher (class_students) can read the learner\'s evidence', async () => {
  const client = await signInAs(teacherC.email)
  const { data, error } = await client.from('learner_evidence').select('id').eq('learner_id', studentRosterId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('the linked parent (students.parent_user_id) can read the learner\'s evidence', async () => {
  const client = await signInAs(parentDirect.email)
  const { data, error } = await client.from('learner_evidence').select('id').eq('learner_id', studentParentId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('the linked parent (class_students.parent_id) can read the learner\'s evidence', async () => {
  const client = await signInAs(parentRoster.email)
  const { data, error } = await client.from('learner_evidence').select('id').eq('learner_id', studentRosterId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('the teacher who entered the evidence, but does not teach the learner, cannot read it back', async () => {
  const client = await signInAs(teacherB.email)
  const { data: direct } = await client.from('learner_evidence').select('id').eq('learner_id', studentDirectId)
  const { data: roster } = await client.from('learner_evidence').select('id').eq('learner_id', studentRosterId)
  const { data: parented } = await client.from('learner_evidence').select('id').eq('learner_id', studentParentId)
  assert.equal(direct?.length, 0, 'entering teacher must not read a direct-link student they do not own')
  assert.equal(roster?.length, 0, 'entering teacher must not read a roster student they are not on the roster for')
  assert.equal(parented?.length, 0, 'entering teacher must not read a parent-linked student they have no relation to')
})

test('an unrelated parent cannot read a different learner\'s evidence', async () => {
  const client = await signInAs(parentRoster.email)
  const { data } = await client.from('learner_evidence').select('id').eq('learner_id', studentDirectId)
  assert.equal(data?.length, 0)
})

// ── token_balances: no direct self-update ───────────────────────────────────

test('a user can no longer update their own token_balances row directly', async () => {
  const client = await signInAs(teacherA.email)
  const { data: before } = await db.from('token_balances').select('balance').eq('user_id', teacherA.id).single()

  const { data: updateResult } = await client
    .from('token_balances')
    .update({ balance: 999999 })
    .eq('user_id', teacherA.id)
    .select('balance')

  // RLS with no UPDATE policy silently matches zero rows (not an error) —
  // the correct proof is that the row is unaffected when re-read via the
  // service client.
  assert.equal(updateResult?.length ?? 0, 0)

  const { data: after } = await db.from('token_balances').select('balance').eq('user_id', teacherA.id).single()
  assert.equal(after?.balance, before?.balance)
  assert.notEqual(after?.balance, 999999)
})

test('a user can still read their own token_balances row', async () => {
  const client = await signInAs(teacherA.email)
  const { data, error } = await client.from('token_balances').select('balance').eq('user_id', teacherA.id).single()
  assert.equal(error, null)
  assert.ok(typeof data?.balance === 'number')
})
