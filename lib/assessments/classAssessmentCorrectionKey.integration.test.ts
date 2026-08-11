// lib/assessments/classAssessmentCorrectionKey.integration.test.ts
//
// Phase E4 §4 — the MANDATORY pre-cutover test, closing the one namespace
// E3.5 left without an end-to-end run: `class_assessment_result`.
//
// This namespace matters more than the others because it is what the real
// teacher CSV mark-upload path uses. `POST /api/teacher/assessments/
// [assessmentId]/upload` parses the CSV into `learner_marks` and then calls
// the same `recordAssessmentEvidence()` that manual marking calls — so
// manual and CSV marking of one assessment result MUST resolve to one
// correction identity. If they did not, E4 would have to stop.
//
// ⚠️ Synthetic fixtures only; created and deleted here.
//
// Run: npx tsx --env-file=.env.local --test lib/assessments/classAssessmentCorrectionKey.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { recordAssessmentEvidence } from './evidence'
import { classAssessmentResultKey, correctionKeyNamespace } from '@/lib/intelligence/correctionKey'
import { compareRow } from '@/lib/intelligence/shadowSupersession'

const SYNTHETIC_MARKER = 'SYNTHETIC_E4_CLASS_ASSESSMENT_KEY_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let learnerId: string
let assessmentA: string
let assessmentB: string

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

async function mkAssessment(title: string): Promise<string> {
  const d = await q(() => db.from('class_assessments')
    .insert({
      class_id: classId, teacher_id: teacherId, title, assessment_type: 'CAT',
      term: 2, year: 2026, max_score: 100, subjects: ['mathematics'],
      curriculum_type: 'cbc', weight_percent: 100, grading_type: 'marks', is_published: false,
    })
    .select('id').single())
  return d!.id
}

/** Writes/overwrites the learner's mark row for an assessment — what both the manual and CSV paths ultimately do. */
async function upsertMark(assessmentId: string, score: number): Promise<void> {
  const existing = await q(() => db.from('learner_marks')
    .select('id').eq('assessment_id', assessmentId).eq('student_id', learnerId).maybeSingle())
  if (existing) {
    await q(() => db.from('learner_marks').update({ subject_scores: { mathematics: score } }).eq('id', existing.id).select('id').single())
    return
  }
  await q(() => db.from('learner_marks')
    .insert({
      assessment_id: assessmentId, class_id: classId, teacher_id: teacherId,
      student_name: 'E4 Class Assessment Learner', student_id: learnerId,
      subject_scores: { mathematics: score },
    })
    .select('id').single())
}

async function evidenceRows() {
  const { data } = await db.from('learner_evidence')
    .select('id, learner_id, subject, sub_strand_id, assessment_type, academic_year, term, evidence_source, correction_key, created_at, lifecycle_state, raw_input_ref, cbc_level')
    .eq('learner_id', learnerId)
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

  learnerId = (await q(() => db.from('students')
    .insert({ name: 'E4 Class Assessment Learner', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId })
    .select('id').single()))!.id

  assessmentA = await mkAssessment('CAT 1')
  assessmentB = await mkAssessment('CAT 2')
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (learnerId) {
    const { data } = await db.from('learner_evidence').select('id, ingestion_run_id').eq('learner_id', learnerId)
    const ids = (data ?? []).map(r => r.id)
    const runs = [...new Set((data ?? []).map(r => r.ingestion_run_id as string).filter(Boolean))]
    if (ids.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', ids))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids))
      await safely(() => db.from('learner_evidence').delete().in('id', ids))
    }
    await safely(() => db.from('learner_projections').delete().eq('learner_id', learnerId))
    if (runs.length) await safely(() => db.from('ingestion_runs').delete().in('id', runs))
  }
  for (const a of [assessmentA, assessmentB].filter(Boolean)) {
    await safely(() => db.from('learner_marks').delete().eq('assessment_id', a))
    await safely(() => db.from('class_assessments').delete().eq('id', a))
  }
  if (learnerId) await safely(() => db.from('students').delete().eq('id', learnerId))
  if (classId) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

// ── Scenario A — same assessment result corrected ──────────────────────────

test('A. the same class-assessment result, corrected, keeps ONE correction identity → BOTH_SUPERSEDE', async () => {
  await upsertMark(assessmentA, 45)
  await recordAssessmentEvidence(assessmentA, teacherId, authUserId)

  await new Promise(r => setTimeout(r, 1100))

  // The teacher corrects the mark and the assessment is reprocessed —
  // whether they did that by hand or by re-uploading a CSV.
  await upsertMark(assessmentA, 78)
  await recordAssessmentEvidence(assessmentA, teacherId, authUserId)

  const rows = await evidenceRows()
  assert.equal(rows.length, 2, 'two evidence rows for one result — the original and its correction')
  for (const r of rows) {
    assert.equal(correctionKeyNamespace(r.correction_key), 'class_assessment_result')
  }
  assert.equal(rows[0].correction_key, rows[1].correction_key, 'a corrected result keeps the artifact identity')
  assert.notEqual(rows[0].cbc_level, rows[1].cbc_level, 'and the value genuinely changed')

  const comparisons = rows.map((r, i) => compareRow(r, rows.slice(0, i)))
  assert.equal(comparisons[1].verdict, 'BOTH_SUPERSEDE',
    'a genuine correction supersedes under both the legacy and the correction-key rule')
})

// ── Scenario B — a different assessment is a different observation ─────────

test('B. a DIFFERENT class assessment, same learner/subject/term → OLD_SUPERSEDES_NEW_COEXISTS', async () => {
  await upsertMark(assessmentB, 60)
  await recordAssessmentEvidence(assessmentB, teacherId, authUserId)

  const rows = await evidenceRows()
  const a = rows.filter(r => r.correction_key!.includes(assessmentA))
  const b = rows.filter(r => r.correction_key!.includes(assessmentB))
  assert.ok(a.length >= 1 && b.length === 1)

  assert.notEqual(a[0].correction_key, b[0].correction_key, 'two assessments are two artifacts')
  assert.equal(a[0].assessment_type, b[0].assessment_type, 'while every legacy claim-key field matches')
  assert.equal(a[0].term, b[0].term)
  assert.equal(a[0].academic_year, b[0].academic_year)
  assert.equal(a[0].subject, b[0].subject)

  const comparisons = rows.map((r, i) => compareRow(r, rows.slice(0, i)))
  const bComparison = comparisons.find(c => c.evidenceId === b[0].id)!
  assert.equal(bComparison.verdict, 'OLD_SUPERSEDES_NEW_COEXISTS',
    'CAT 2 is a second observation, not a correction of CAT 1')
})

// ── The mandatory identity-unification proof ──────────────────────────────

test('C. manual marking and CSV upload of the SAME result resolve to the SAME correction identity', async () => {
  // Both paths converge on `recordAssessmentEvidence(assessmentId, ...)`,
  // which derives the key from (assessmentId, mark.student_id,
  // canonicalSubject) — none of which depends on HOW the mark was entered.
  // `POST /api/teacher/assessments/[assessmentId]/upload` calls
  // `upsertMarksCSV` and then that same producer; manual marking calls
  // `upsertMarks` and then that same producer.
  const expected = classAssessmentResultKey({
    assessmentId: assessmentA, studentId: learnerId,
    canonicalSubject: 'mathematics', source: 'teacher_upload',
  })

  const rows = await evidenceRows()
  const forA = rows.filter(r => r.correction_key!.includes(assessmentA))
  assert.ok(forA.length >= 2)
  for (const r of forA) {
    assert.equal(r.correction_key, expected,
      'the identity is a property of the RESULT, not of the entry method — ' +
      'if this ever diverges, a CSV re-upload would stop correcting a manually entered mark')
  }
})

test('D. one assessment carrying several subjects yields one identity PER SUBJECT CELL', async () => {
  const maths = classAssessmentResultKey({ assessmentId: assessmentA, studentId: learnerId, canonicalSubject: 'mathematics', source: 'teacher_upload' })
  const english = classAssessmentResultKey({ assessmentId: assessmentA, studentId: learnerId, canonicalSubject: 'english', source: 'teacher_upload' })
  assert.notEqual(maths, english, 'correcting the Maths cell must never touch the English cell')
})
