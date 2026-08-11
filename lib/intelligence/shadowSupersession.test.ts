// lib/intelligence/shadowSupersession.test.ts
//
// Phase E3 — tests for the shadow comparison engine itself.
//
// The engine is what E4's go/no-go rests on, so it has to be trustworthy
// before its output is. Pure functions over synthetic rows; no database.
//
// The most important test here is #10: a deliberately constructed
// OLD_COEXISTS_NEW_SUPERSEDES fixture, proving the detector can actually
// catch the forbidden category. A gate that cannot fail proves nothing.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/shadowSupersession.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyDecision, nextDecision, compareRow, verdictFor } from './shadowSupersession'
import { assignmentMarkKey, quizAttemptKey, reportCardResultKey } from './correctionKey'

const LEARNER = 'learner-1'
const ASSIGNMENT_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const ASSIGNMENT_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const SUBSTRAND_X = 'ssx'
const SUBSTRAND_Y = 'ssy'

type Row = Parameters<typeof compareRow>[0]

let seq = 0
function row(overrides: Partial<Row> = {}): Row {
  seq++
  return {
    id: `e${seq}`,
    learner_id: LEARNER,
    subject: 'mathematics',
    sub_strand_id: SUBSTRAND_X,
    assessment_type: 'assignment',
    academic_year: 2026,
    term: 2,
    evidence_source: 'teacher_upload',
    correction_key: null,
    // Strictly increasing and unbounded — an earlier version saturated after
    // nine rows, so later pairs shared a timestamp and the strict
    // "prior must be older" filter silently never matched.
    created_at: new Date(Date.UTC(2026, 0, 1) + seq * 60_000).toISOString(),
    lifecycle_state: 'auto_confirmed',
    ...overrides,
  }
}

// ── 1. Same artifact regraded ──────────────────────────────────────────────

test('1. same assignment regraded → BOTH_SUPERSEDE', () => {
  const key = assignmentMarkKey({ assignmentId: ASSIGNMENT_A, studentId: LEARNER, source: 'teacher_upload' })
  const first = row({ correction_key: key })
  const regrade = row({ correction_key: key })

  const c = compareRow(regrade, [first])
  assert.equal(c.verdict, 'BOTH_SUPERSEDE', 'a genuine correction supersedes under both rules')
  assert.equal(c.legacy.kind === 'SUPERSEDE' && c.legacy.priorId, first.id)
  assert.equal(c.next.kind === 'SUPERSEDE' && c.next.priorId, first.id)
  assert.equal(c.differentPrior, false, 'and both target the same prior row')
})

// ── 2. THE BUG BEING FIXED ─────────────────────────────────────────────────

test('2. different assignments, same sub-strand/term → OLD_SUPERSEDES_NEW_COEXISTS', () => {
  const first = row({ correction_key: assignmentMarkKey({ assignmentId: ASSIGNMENT_A, studentId: LEARNER, source: 'teacher_upload' }) })
  const second = row({ correction_key: assignmentMarkKey({ assignmentId: ASSIGNMENT_B, studentId: LEARNER, source: 'teacher_upload' }) })

  const c = compareRow(second, [first])
  assert.equal(c.verdict, 'OLD_SUPERSEDES_NEW_COEXISTS',
    'this is the accidental collision that removed 32 real observations from production records')
  assert.equal(c.next.kind, 'COEXIST')
})

// ── 3. Namespace collision impossible ──────────────────────────────────────

test('3. an assignment and a quiz sharing one UUID cannot collide under the new rule', () => {
  const assignment = row({
    evidence_source: 'teacher_upload',
    correction_key: assignmentMarkKey({ assignmentId: ASSIGNMENT_A, studentId: LEARNER, source: 'teacher_upload' }),
  })
  const quiz = row({
    evidence_source: 'quiz_auto_grade',
    correction_key: quizAttemptKey({ assignmentId: ASSIGNMENT_A, studentId: LEARNER, source: 'quiz_auto_grade' }),
  })

  assert.notEqual(assignment.correction_key, quiz.correction_key, 'different namespaces on the same UUID')
  assert.equal(nextDecision(quiz, [assignment]).kind, 'COEXIST')
})

// ── 4-5. Independent evidence ──────────────────────────────────────────────

test('4. different sub-strands → BOTH_COEXIST (Phase 2 already fixed this half)', () => {
  const first = row({ sub_strand_id: SUBSTRAND_X })
  const second = row({ sub_strand_id: SUBSTRAND_Y })
  assert.equal(compareRow(second, [first]).verdict, 'BOTH_COEXIST')
})

test('5. a repeated formative observation stays independent under the new rule', () => {
  const first = row({ evidence_source: 'classroom_observation', sub_strand_id: null })
  const second = row({ evidence_source: 'classroom_observation', sub_strand_id: null })

  assert.equal(nextDecision(second, [first]).kind, 'COEXIST', 'no key — an observation, never a correction')
  assert.equal(compareRow(second, [first]).verdict, 'OLD_SUPERSEDES_NEW_COEXISTS',
    'and the legacy rule was wrongly superseding it')
})

// ── 6. Report-card correction ──────────────────────────────────────────────

test('6. the same report-card result reprocessed → BOTH_SUPERSEDE', () => {
  const key = reportCardResultKey({ assessmentId: 'as1', studentId: LEARNER, canonicalSubject: 'mathematics', source: 'teacher_upload' })
  const first = row({ assessment_type: 'term_exam', sub_strand_id: null, correction_key: key })
  const second = row({ assessment_type: 'term_exam', sub_strand_id: null, correction_key: key })
  assert.equal(compareRow(second, [first]).verdict, 'BOTH_SUPERSEDE')
})

// ── 7. Cross-source supersession is impossible ─────────────────────────────

test('7. a different source cannot supersede via the same key — the trust boundary', () => {
  const key = reportCardResultKey({ assessmentId: 'as1', studentId: LEARNER, canonicalSubject: 'mathematics', source: 'teacher_upload' })
  const teacherRow = row({ evidence_source: 'teacher_upload', assessment_type: 'term_exam', sub_strand_id: null, correction_key: key })
  // A parent row bearing the identical key — the exact threat E1 §13 named.
  const parentRow = row({ evidence_source: 'parent_observation', assessment_type: 'term_exam', sub_strand_id: null, correction_key: key })

  assert.equal(nextDecision(parentRow, [teacherRow]).kind, 'COEXIST',
    'evidence_source is part of the lookup scope, so a producer can never reach another producer\'s artifact')
})

test('7b. an unrecognised namespace is never trusted', () => {
  const first = row({ correction_key: 'made_up_namespace:x:y' })
  const second = row({ correction_key: 'made_up_namespace:x:y' })
  const d = nextDecision(second, [first])
  assert.equal(d.kind, 'COEXIST')
  assert.match(d.reason, /unrecognised namespace/)
})

// ── 8-9. Event evidence stays exempt ───────────────────────────────────────

test('8. Compass session evidence remains event-exempt under both rules', () => {
  const first = row({ evidence_source: 'compass_session', sub_strand_id: null })
  const second = row({ evidence_source: 'compass_session', sub_strand_id: null })
  assert.equal(legacyDecision(second, [first]).kind, 'COEXIST', 'Phase 1.5 exemption intact')
  assert.equal(compareRow(second, [first]).verdict, 'BOTH_COEXIST')
})

test('9. teacher remarks remain event-exempt under both rules', () => {
  const first = row({ evidence_source: 'teacher_remark', sub_strand_id: null })
  const second = row({ evidence_source: 'teacher_remark', sub_strand_id: null })
  assert.equal(legacyDecision(second, [first]).kind, 'COEXIST', 'Phase C exemption intact')
  assert.equal(compareRow(second, [first]).verdict, 'BOTH_COEXIST')
})

// ════════════════════════════════════════════════════════════════════════════
// 10. THE DETECTOR MUST BE ABLE TO FAIL
//
// A gate that cannot trip proves nothing. This constructs the forbidden
// category deliberately: two rows the LEGACY rule considers independent
// (different sub-strands, so different claim keys) that nonetheless share a
// correction key. If E4's gate ever reports this category in real data, this
// test is the proof the harness would have caught it.
// ════════════════════════════════════════════════════════════════════════════

test('10. the harness detects OLD_COEXISTS_NEW_SUPERSEDES — the STOP category', () => {
  const key = assignmentMarkKey({ assignmentId: ASSIGNMENT_A, studentId: LEARNER, source: 'teacher_upload' })
  const first = row({ sub_strand_id: SUBSTRAND_X, correction_key: key })
  const second = row({ sub_strand_id: SUBSTRAND_Y, correction_key: key })

  const c = compareRow(second, [first])
  assert.equal(c.legacy.kind, 'COEXIST', 'different sub-strands — the legacy rule sees two claims')
  assert.equal(c.next.kind, 'SUPERSEDE', 'but the same artifact key — the new rule would supersede')
  assert.equal(c.verdict, 'OLD_COEXISTS_NEW_SUPERSEDES',
    'the harness MUST surface this. A gate that cannot fail is not a gate.')
})

// ── Verdict mapping is exhaustive ──────────────────────────────────────────

test('V. every combination maps to exactly one mandated verdict', () => {
  const sup = { kind: 'SUPERSEDE', priorId: 'p', reason: '' } as const
  const co = { kind: 'COEXIST', reason: '' } as const
  assert.equal(verdictFor(sup, sup), 'BOTH_SUPERSEDE')
  assert.equal(verdictFor(co, co), 'BOTH_COEXIST')
  assert.equal(verdictFor(sup, co), 'OLD_SUPERSEDES_NEW_COEXISTS')
  assert.equal(verdictFor(co, sup), 'OLD_COEXISTS_NEW_SUPERSEDES')
})

test('T. E3_TRANSITION_GUARD — the shadow module is read-only by construction', async () => {
  const src = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('./shadowSupersession.ts', import.meta.url), 'utf8'))
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  for (const writer of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
    assert.ok(!code.includes(writer), `the shadow engine must contain no ${writer} — it measures, it never acts`)
  }
  assert.ok(code.includes('.select('), 'it does read')
})
