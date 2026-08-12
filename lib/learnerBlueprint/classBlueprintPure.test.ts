// lib/learnerBlueprint/classBlueprintPure.test.ts
//
// Run: npx tsx --test lib/learnerBlueprint/classBlueprintPure.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeClassBlueprint,
  attentionReasonFor,
  learnerDisplayName,
  ATTENTION_LEVEL_CEILING,
  type RosterLearner,
  type LearnerProjectionInput,
} from './classBlueprintPure'
import type { AcademicValue, RiskValue, SubjectPerformance, Trend } from '@/lib/projection/types'

function learner(id: string, first: string, last: string, className = 'Grade 9'): RosterLearner {
  return { id, first_name: first, last_name: last, admission_number: `ADM-${id}`, current_class_name: className }
}

function subject(name: string, level: 1 | 2 | 3 | 4, trend: Trend = 'stable', history = 2): SubjectPerformance {
  return {
    subject: name,
    latestLevel: level,
    trend,
    history: Array.from({ length: history }, (_, i) => ({
      level, score: null, at: `2026-0${i + 1}-01T00:00:00Z`, evidenceId: `${name}-${i}`,
    })),
  }
}

function academic(...subjects: SubjectPerformance[]): AcademicValue {
  return { bySubject: Object.fromEntries(subjects.map(s => [s.subject, s])), bySubStrand: {} }
}

function projection(over: Partial<LearnerProjectionInput> & { coreLearnerId: string }): LearnerProjectionInput {
  return { academic: null, risk: null, evidenceCount: 4, lastComputed: '2026-08-01T00:00:00Z', ...over }
}

function risk(level: RiskValue['overallRiskLevel']): RiskValue {
  return { flags: [], overallRiskLevel: level }
}

// ── Names ────────────────────────────────────────────────────────────────────

test('display name joins the parts that exist and never leaves stray spacing', () => {
  assert.equal(learnerDisplayName(learner('1', 'Kevin', 'Otieno')), 'Kevin Otieno')
  assert.equal(learnerDisplayName({ id: '2', first_name: 'Amina', middle_name: 'Wanjiru', last_name: 'Njeri' }), 'Amina Wanjiru Njeri')
  assert.equal(learnerDisplayName({ id: '3', first_name: 'Brian', middle_name: '  ', last_name: 'Matthias' }), 'Brian Matthias')
})

// ── Attention reason ─────────────────────────────────────────────────────────

test('an unbridged learner is reported as a plumbing problem, never as a learning concern', () => {
  // The platform genuinely cannot compute anything for them. Calling that "no
  // evidence" would read as a statement about the child rather than the data.
  assert.equal(attentionReasonFor({ bridged: false, subjects: [], riskLevel: null, evidenceCount: 0 }), 'not_bridged')
})

test('a learner nobody has assessed outranks every academic signal', () => {
  // Invisibility is the failure mode a class view exists to catch.
  assert.equal(attentionReasonFor({ bridged: true, subjects: [], riskLevel: null, evidenceCount: 0 }), 'no_evidence')
})

test('risk outranks low levels, and multiple low subjects outrank one', () => {
  const low = [{ subject: 'Mathematics', latestLevel: 1 as const, trend: 'stable' as const, evidenceCount: 2 }]
  assert.equal(attentionReasonFor({ bridged: true, subjects: low, riskLevel: 'at_risk', evidenceCount: 2 }), 'at_risk')
  assert.equal(attentionReasonFor({ bridged: true, subjects: low, riskLevel: 'critical', evidenceCount: 2 }), 'at_risk')

  const twoLow = [...low, { subject: 'English', latestLevel: 2 as const, trend: 'stable' as const, evidenceCount: 2 }]
  assert.equal(attentionReasonFor({ bridged: true, subjects: twoLow, riskLevel: 'watch', evidenceCount: 4 }), 'multiple_subjects_below')
  assert.equal(attentionReasonFor({ bridged: true, subjects: low, riskLevel: 'normal', evidenceCount: 2 }), 'one_subject_below')
})

test('a declining subject is surfaced even when every level is secure', () => {
  const declining = [{ subject: 'Mathematics', latestLevel: 3 as const, trend: 'declining' as const, evidenceCount: 3 }]
  assert.equal(attentionReasonFor({ bridged: true, subjects: declining, riskLevel: 'normal', evidenceCount: 3 }), 'declining')
})

test('a learner who is fine is reported as fine', () => {
  const secure = [{ subject: 'Mathematics', latestLevel: 4 as const, trend: 'improving' as const, evidenceCount: 3 }]
  assert.equal(attentionReasonFor({ bridged: true, subjects: secure, riskLevel: 'normal', evidenceCount: 3 }), 'none')
})

test('the attention ceiling is the CBC band boundary the rest of the platform uses', () => {
  assert.equal(ATTENTION_LEVEL_CEILING, 2)
})

// ── Ordering ─────────────────────────────────────────────────────────────────

test('the list puts the learners who need the teacher first, deterministically', () => {
  const roster = [
    learner('fine', 'Zawadi', 'Achieng'),
    learner('risk', 'Brian', 'Matthias'),
    learner('none-yet', 'Amina', 'Njeri'),
    learner('one-low', 'Kevin', 'Otieno'),
    learner('unbridged', 'Faith', 'Mwikali'),
  ]

  const result = computeClassBlueprint({
    classId: 'c1', className: 'Grade 9Y', termId: 't1',
    roster,
    bridgedLearnerIds: new Set(['fine', 'risk', 'none-yet', 'one-low']),
    projections: [
      projection({ coreLearnerId: 'fine', academic: academic(subject('Mathematics', 4, 'improving')) }),
      projection({ coreLearnerId: 'risk', academic: academic(subject('Mathematics', 3)), risk: risk('at_risk') }),
      projection({ coreLearnerId: 'none-yet', evidenceCount: 0 }),
      projection({ coreLearnerId: 'one-low', academic: academic(subject('Mathematics', 2)) }),
    ],
  })

  // 'not_bridged' sorts above 'none' on purpose: a learner the platform cannot
  // compute anything for is something the teacher should chase, whereas a
  // learner who is doing fine needs nothing from them today.
  assert.deepEqual(result.rows.map(r => r.coreLearnerId), ['none-yet', 'risk', 'one-low', 'unbridged', 'fine'])
  assert.deepEqual(result.rows.map(r => r.attentionReason), ['no_evidence', 'at_risk', 'one_subject_below', 'not_bridged', 'none'])
})

test('ties break on level then name, so the same class never reorders between renders', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: 'Grade 9Y', termId: 't1',
    roster: [learner('b', 'Brian', 'Zulu'), learner('a', 'Amina', 'Zulu'), learner('c', 'Chris', 'Zulu')],
    bridgedLearnerIds: new Set(['a', 'b', 'c']),
    projections: [
      projection({ coreLearnerId: 'b', academic: academic(subject('Mathematics', 2)) }),
      projection({ coreLearnerId: 'a', academic: academic(subject('Mathematics', 2)) }),
      projection({ coreLearnerId: 'c', academic: academic(subject('Mathematics', 1)) }),
    ],
  })
  assert.deepEqual(result.rows.map(r => r.learnerName), ['Chris Zulu', 'Amina Zulu', 'Brian Zulu'])
})

test('a learner’s own subjects are ordered lowest-first so the eye lands on the gap', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: null, termId: 't1',
    roster: [learner('x', 'Kevin', 'Otieno')],
    bridgedLearnerIds: new Set(['x']),
    projections: [projection({
      coreLearnerId: 'x',
      academic: academic(subject('English', 4), subject('Mathematics', 1), subject('Kiswahili', 3)),
    })],
  })
  assert.deepEqual(result.rows[0].subjects.map(s => s.subject), ['Mathematics', 'Kiswahili', 'English'])
  assert.equal(result.rows[0].lowestLevel, 1)
  assert.deepEqual(result.rows[0].subjectsNeedingAttention, ['Mathematics'])
})

// ── The no-ranking guarantee ─────────────────────────────────────────────────

test('the class summary contains no mean, total or position — only a distribution', () => {
  // KNEC warned schools in December 2025 against circulating analyses using
  // aggregate scores or school mean scores. This shape must stay un-rankable.
  const result = computeClassBlueprint({
    classId: 'c1', className: 'Grade 9Y', termId: 't1',
    roster: [learner('a', 'Amina', 'Njeri'), learner('b', 'Brian', 'Matthias')],
    bridgedLearnerIds: new Set(['a', 'b']),
    projections: [
      projection({ coreLearnerId: 'a', academic: academic(subject('Mathematics', 4)) }),
      projection({ coreLearnerId: 'b', academic: academic(subject('Mathematics', 2)) }),
    ],
  })

  const keys = Object.keys(result.distribution)
  for (const banned of ['mean', 'average', 'total', 'position', 'rank', 'score']) {
    assert.equal(keys.some(k => k.toLowerCase().includes(banned)), false, `distribution exposes a "${banned}"-shaped field`)
  }
  assert.equal('rank' in result.rows[0], false, 'a row must never carry a position')
  assert.deepEqual(result.distribution.byLowestLevel, { 1: 0, 2: 1, 3: 0, 4: 1 })
})

// ── Distribution and staleness ───────────────────────────────────────────────

test('distribution separates "no evidence yet" from "cannot be computed at all"', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: null, termId: 't1',
    roster: [learner('a', 'A', 'One'), learner('b', 'B', 'Two'), learner('c', 'C', 'Three')],
    bridgedLearnerIds: new Set(['a', 'b']),
    projections: [
      projection({ coreLearnerId: 'a', academic: academic(subject('Mathematics', 3)) }),
      projection({ coreLearnerId: 'b', evidenceCount: 0 }),
    ],
  })

  assert.equal(result.distribution.learnersWithEvidence, 1)
  assert.equal(result.distribution.learnersWithoutEvidence, 1, 'bridged but unassessed')
  assert.equal(result.distribution.learnersNotBridged, 1, 'no legacy identity at all')
  assert.equal(result.distribution.learnersNeedingAttention, 2)
})

test('the oldest projection timestamp is reported so staleness is visible, not hidden', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: null, termId: 't1',
    roster: [learner('a', 'A', 'One'), learner('b', 'B', 'Two')],
    bridgedLearnerIds: new Set(['a', 'b']),
    projections: [
      projection({ coreLearnerId: 'a', academic: academic(subject('Mathematics', 3)), lastComputed: '2026-08-05T00:00:00Z' }),
      projection({ coreLearnerId: 'b', academic: academic(subject('English', 3)), lastComputed: '2026-06-01T00:00:00Z' }),
    ],
  })
  assert.equal(result.oldestProjectionAsOf, '2026-06-01T00:00:00Z')
})

test('an unbridged learner carries no projection timestamp and no fabricated level', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: null, termId: 't1',
    roster: [learner('a', 'A', 'One')],
    bridgedLearnerIds: new Set(),
    projections: [],
  })
  const row = result.rows[0]
  assert.equal(row.bridged, false)
  assert.equal(row.lowestLevel, null)
  assert.equal(row.projectionAsOf, null)
  assert.equal(row.evidenceCount, 0)
  assert.deepEqual(row.subjects, [])
})

test('an empty class produces an empty, valid result rather than throwing', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: 'Grade 9Y', termId: 't1',
    roster: [], projections: [], bridgedLearnerIds: new Set(),
  })
  assert.deepEqual(result.rows, [])
  assert.equal(result.oldestProjectionAsOf, null)
  assert.deepEqual(result.distribution.byLowestLevel, { 1: 0, 2: 0, 3: 0, 4: 0 })
})

test('each row carries its own grade band, so a mixed-grade class is not flattened', () => {
  const result = computeClassBlueprint({
    classId: 'c1', className: null, termId: 't1',
    roster: [learner('a', 'A', 'One', 'Grade 8'), learner('b', 'B', 'Two', 'Form 3')],
    bridgedLearnerIds: new Set(['a', 'b']),
    projections: [
      projection({ coreLearnerId: 'a', academic: academic(subject('Mathematics', 3)) }),
      projection({ coreLearnerId: 'b', academic: academic(subject('Mathematics', 3)) }),
    ],
  })
  const bands = Object.fromEntries(result.rows.map(r => [r.coreLearnerId, r.gradeBand]))
  assert.equal(bands.a, 'grade_7_8')
  assert.equal(bands.b, 'grade_11_12')
})
