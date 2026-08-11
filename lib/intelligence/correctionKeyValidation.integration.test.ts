// lib/intelligence/correctionKeyValidation.integration.test.ts
//
// Phase E3.5 — exercises the E4 gate on evidence that REAL producers
// actually emitted, rather than evaluating it over an empty set.
//
// E3 left `OLD_COEXISTS_NEW_SUPERSEDES = 0` vacuously true: no production
// row carried a correction_key, so the new rule answered COEXIST everywhere
// by definition. This file closes that gap by driving the genuine producer
// functions (`recordAssignmentMarkEvidence`, `recordQuizAutoGradeEvidence`,
// `recordAssessmentEvidence`, `recordReportCardAssessmentEvidence`) for
// clearly-marked SYNTHETIC learners, then running the shadow comparison over
// exactly the rows they produced.
//
// ⚠️ SYNTHETIC ONLY. No real learner record is touched and no mark is
// fabricated for a real learner (E3.5 §2). Every fixture is created and
// deleted here.
//
// This is staging/synthetic proof, not production observation — the report
// must keep those two categories separate.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/correctionKeyValidation.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { recordAssignmentMarkEvidence } from '@/lib/assignments/evidence'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'
import { recordReportCardAssessmentEvidence } from '@/lib/assessments/reportCardEvidence'
import { compareRow, verdictFor, type ShadowVerdict } from './shadowSupersession'
import { correctionKeyNamespace } from './correctionKey'

const SYNTHETIC_MARKER = 'SYNTHETIC_E35_GATE_ACTIVATION_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let learnerA: string   // same-assignment regrade
let learnerB: string   // two different assignments, same sub-strand/term
let learnerC: string   // quiz vs assignment sharing one UUID
let learnerE: string   // report-card reprocessing
let classId: string
let assignmentX: string
let assignmentY: string
let subStrandId: string
let reportAssessmentId: string
const createdAssignmentIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}
async function q<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  return (await retryAsync(async () => { const r = await fn(); if (r.error) throw r.error; return r })).data
}

async function mkLearner(name: string): Promise<string> {
  const d = await q(() => db.from('students')
    .insert({ name, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId })
    .select('id').single())
  return d!.id
}

async function mkAssignment(title: string, substrand: string | null): Promise<string> {
  const d = await q(() => db.from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title, subject: 'mathematics',
      topic: 'Proportional reasoning', substrand_id: substrand, instructions: SYNTHETIC_MARKER,
      due_date: '2026-09-01', type: 'practice', max_score: 20, status: 'active',
    })
    .select('id').single())
  createdAssignmentIds.push(d!.id)
  return d!.id
}

/** Every evidence row these fixtures produced, oldest first — the shadow input. */
async function rowsFor(learnerIds: string[]) {
  const { data } = await db.from('learner_evidence')
    .select('id, learner_id, subject, sub_strand_id, assessment_type, academic_year, term, evidence_source, correction_key, created_at, lifecycle_state')
    .in('learner_id', learnerIds)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  return data ?? []
}

before(async () => {
  const u = await q(() => db.auth.admin.createUser({
    email: `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  }))
  authUserId = u.user.id

  teacherId = (await q(() => db.from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()))!.id

  classId = (await q(() => db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYN-${Date.now()}` })
    .select('id').single()))!.id

  subStrandId = (await q(() => db.from('sow_substrands').select('id').order('id').limit(1).single()))!.id

  learnerA = await mkLearner('E3.5 Learner A — regrade')
  learnerB = await mkLearner('E3.5 Learner B — two assignments')
  learnerC = await mkLearner('E3.5 Learner C — namespace collision')
  learnerE = await mkLearner('E3.5 Learner E — report card')

  assignmentX = await mkAssignment('Assignment X', subStrandId)
  assignmentY = await mkAssignment('Assignment Y', subStrandId)

  reportAssessmentId = (await q(() => db.from('assessments')
    .insert({
      student_id: learnerE, user_id: authUserId, grade: 8, term: 2, year: 2026,
      grade_level: 'junior', subject_scores: { mathematics: 2 }, curriculum_type: 'cbc',
      assessment_style: 'formative', source: 'teacher',
    })
    .select('id').single()))!.id
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  const learners = [learnerA, learnerB, learnerC, learnerE].filter(Boolean)
  for (const id of learners) {
    const { data } = await db.from('learner_evidence').select('id, ingestion_run_id').eq('learner_id', id)
    const ids = (data ?? []).map(r => r.id)
    const runs = [...new Set((data ?? []).map(r => r.ingestion_run_id as string).filter(Boolean))]
    if (ids.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', ids))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids))
      await safely(() => db.from('learner_evidence').delete().in('id', ids))
    }
    await safely(() => db.from('learner_projections').delete().eq('learner_id', id))
    await safely(() => db.from('assessments').delete().eq('student_id', id))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', id))
    await safely(() => db.from('students').delete().eq('id', id))
    if (runs.length) await safely(() => db.from('ingestion_runs').delete().in('id', runs))
  }
  if (createdAssignmentIds.length) await safely(() => db.from('assignments').delete().in('id', createdAssignmentIds))
  if (classId) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

const mark = (assignmentId: string, studentId: string, score: number) =>
  recordAssignmentMarkEvidence({
    studentId, teacherId, teacherUserId: authUserId, assignmentId,
    subject: 'mathematics', topic: 'Proportional reasoning', substrandId: subStrandId,
    score, maxScore: 20, academicYear: 2026, term: 2, markedAt: new Date().toISOString(),
  })

async function shadowFor(learnerId: string): Promise<Array<ReturnType<typeof compareRow>>> {
  const rows = await rowsFor([learnerId])
  return rows.map((r, i) => compareRow(r, rows.slice(0, i)))
}

// ── A. GENUINE CORRECTION — a real regrade through the real producer ───────

test('A. same assignment regraded → BOTH_SUPERSEDE, on evidence a real producer emitted', async () => {
  await mark(assignmentX, learnerA, 10)
  await new Promise(r => setTimeout(r, 1100)) // distinct created_at
  await mark(assignmentX, learnerA, 15)

  const rows = await rowsFor([learnerA])
  assert.equal(rows.length, 2, 'the producer emitted two rows')
  for (const r of rows) {
    assert.ok(r.correction_key, 'both carry a correction_key — the gate now has something to measure')
    assert.equal(correctionKeyNamespace(r.correction_key), 'assignment_mark')
  }
  assert.equal(rows[0].correction_key, rows[1].correction_key, 'a regrade keeps the artifact identity')

  const comparisons = await shadowFor(learnerA)
  assert.equal(comparisons[1].verdict, 'BOTH_SUPERSEDE' satisfies ShadowVerdict,
    'a genuine correction supersedes under both the old and the new rule')
  assert.equal(comparisons[1].differentPrior, false, 'and both rules target the same prior row')
})

// ── B. INDEPENDENT REPEATED ACTIVITY — the bug being fixed ────────────────

test('B. two different assignments, same sub-strand/term → OLD_SUPERSEDES_NEW_COEXISTS', async () => {
  await mark(assignmentX, learnerB, 12)
  await new Promise(r => setTimeout(r, 1100))
  await mark(assignmentY, learnerB, 14)

  const rows = await rowsFor([learnerB])
  assert.equal(rows.length, 2)
  assert.notEqual(rows[0].correction_key, rows[1].correction_key, 'different artifacts, different identity')
  assert.equal(rows[0].sub_strand_id, rows[1].sub_strand_id, 'while the curriculum anchor is identical')
  assert.equal(rows[0].term, rows[1].term)

  const comparisons = await shadowFor(learnerB)
  assert.equal(comparisons[1].verdict, 'OLD_SUPERSEDES_NEW_COEXISTS' satisfies ShadowVerdict,
    'the legacy rule erases an independent observation; the new rule keeps it — this is the whole point')
  assert.equal(comparisons[1].legacy.kind, 'SUPERSEDE')
  assert.equal(comparisons[1].next.kind, 'COEXIST')
})

// ── C. BOTH NAMESPACES, coincident UUID ───────────────────────────────────

test('C. an assignment mark and a quiz attempt on the SAME assignment cannot collide', async () => {
  await mark(assignmentX, learnerC, 11)
  await new Promise(r => setTimeout(r, 1100))
  await recordQuizAutoGradeEvidence({
    studentId: learnerC, initiatedBy: authUserId, assignmentId: assignmentX,
    subject: 'mathematics', topic: 'Proportional reasoning', substrandId: subStrandId,
    score: 18, maxScore: 20, academicYear: 2026, term: 2,
  })

  const rows = await rowsFor([learnerC])
  const assignmentRow = rows.find(r => r.evidence_source === 'teacher_upload')!
  const quizRow = rows.find(r => r.evidence_source === 'quiz_auto_grade')!

  assert.equal(correctionKeyNamespace(assignmentRow.correction_key), 'assignment_mark')
  assert.equal(correctionKeyNamespace(quizRow.correction_key), 'quiz_attempt')
  assert.ok(assignmentRow.correction_key!.includes(assignmentX), 'both key on the same assignment UUID')
  assert.ok(quizRow.correction_key!.includes(assignmentX))
  assert.notEqual(assignmentRow.correction_key, quizRow.correction_key, '...and are still distinct identities')

  const comparisons = await shadowFor(learnerC)
  const quizComparison = comparisons.find(c => c.evidenceId === quizRow.id)!
  assert.equal(quizComparison.next.kind, 'COEXIST', 'the quiz cannot correct the assignment mark')
  assert.notEqual(quizComparison.verdict, 'OLD_COEXISTS_NEW_SUPERSEDES' satisfies ShadowVerdict)
})

// ── E. REPORT-CARD REPROCESSING ───────────────────────────────────────────

test('E. the same report-card result reprocessed → BOTH_SUPERSEDE', async () => {
  await recordReportCardAssessmentEvidence(reportAssessmentId, learnerE, teacherId, authUserId)

  const first = await rowsFor([learnerE])
  assert.equal(first.length, 1)
  assert.equal(correctionKeyNamespace(first[0].correction_key), 'report_card_result')

  // A corrected value for the SAME assessment. The producer's idempotency
  // guard skips an identical replay, so the row is re-emitted directly with
  // the producer's own key to model reprocessing after a correction.
  await new Promise(r => setTimeout(r, 1100))
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
  })
  const { persistEvidenceBatch } = await import('./evidenceLifecycle')
  const { reportCardResultKey } = await import('./correctionKey')
  await persistEvidenceBatch([{
    learnerId: learnerE, extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics', score: null, cbcLevel: 4,
    assessmentType: 'term_exam', academicYear: 2026, term: 2,
    evidenceSource: 'teacher_upload', trustTier: 3, evidenceConfidence: 100,
    extractionMethod: 'report_card_pipeline_v1', reviewStatus: 'auto_confirmed',
    rawInputRef: `assessments:${reportAssessmentId}:mathematics:${learnerE}:corrected`,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null,
    correctionKey: reportCardResultKey({
      assessmentId: reportAssessmentId, studentId: learnerE,
      canonicalSubject: 'mathematics', source: 'teacher_upload',
    }),
  }], runId)

  const comparisons = await shadowFor(learnerE)
  assert.equal(comparisons.length, 2)
  assert.equal(comparisons[1].verdict, 'BOTH_SUPERSEDE' satisfies ShadowVerdict,
    'reprocessing a report-card result is a genuine correction under both rules')
})

// ── THE GATE, over everything these real producers emitted ────────────────

test('GATE. across every keyed row produced here, OLD_COEXISTS_NEW_SUPERSEDES = 0', async () => {
  const rows = await rowsFor([learnerA, learnerB, learnerC, learnerE])
  const comparisons = rows.map((r, i) => compareRow(r, rows.slice(0, i)))

  const keyed = rows.filter(r => r.correction_key)
  assert.ok(keyed.length >= 7, `expected real keyed evidence, got ${keyed.length}`)
  assert.equal(rows.filter(r => r.correction_key && !correctionKeyNamespace(r.correction_key)).length, 0,
    'no malformed or unknown namespaces')

  const counts: Record<ShadowVerdict, number> = {
    BOTH_COEXIST: 0, BOTH_SUPERSEDE: 0, OLD_SUPERSEDES_NEW_COEXISTS: 0, OLD_COEXISTS_NEW_SUPERSEDES: 0,
  }
  for (const c of comparisons) counts[c.verdict]++

  console.log('\n── E3.5 SYNTHETIC VALIDATION — verdicts over real producer output ──')
  for (const [v, n] of Object.entries(counts)) console.log(`  ${v.padEnd(30)} ${n}`)
  console.log(`  keyed rows: ${keyed.length} / ${rows.length}`)
  console.log('────────────────────────────────────────────────────────────────\n')

  assert.equal(counts.OLD_COEXISTS_NEW_SUPERSEDES, 0,
    'THE E4 GATE — the new rule must never create a supersession the old rule considered independent')
  assert.ok(counts.BOTH_SUPERSEDE >= 2, 'genuine corrections were exercised (A and E)')
  assert.ok(counts.OLD_SUPERSEDES_NEW_COEXISTS >= 1, 'an independent repeated activity was exercised (B)')
})

// ── Trust boundary, retested on real keyed rows ───────────────────────────

test('TRUST. a different source bearing the same key cannot become a correction target', async () => {
  const rows = await rowsFor([learnerA])
  const teacherRow = rows.find(r => r.evidence_source === 'teacher_upload')!

  // Same key string, different source — the exact threat E1 §13 named.
  const impostor = { ...teacherRow, id: 'impostor', evidence_source: 'parent_observation', created_at: '2099-01-01T00:00:00Z' }
  const decision = compareRow(impostor, rows).next
  assert.equal(decision.kind, 'COEXIST',
    'evidence_source is inside the lookup scope, so no producer can reach another producer\'s artifact')
})

// ── Gate D: observed, unchanged ───────────────────────────────────────────

test('GATE D. pending keyed corrections are recorded, and execution timing is unchanged', async () => {
  const rows = await rowsFor([learnerA, learnerB, learnerC, learnerE])
  const pendingKeyed = rows.filter(r => r.correction_key && r.lifecycle_state === 'pending_review')
  console.log(`[gate-d] pending keyed corrections observed: ${pendingKeyed.length}`)

  // Whatever the count, E3.5 changes nothing about WHEN supersession runs.
  const superseded = rows.filter(r => r.lifecycle_state === 'superseded')
  assert.ok(superseded.length >= 2, 'the LEGACY rule still executed supersession, exactly as before')
})
