// lib/adaptiveLearning/recommend.test.ts
// Pure unit tests — no DB. Covers classification, Insight shape, neutral
// labeling, and class-grouping using synthetic LearnerIntelligenceProjection
// fixtures directly (not persisted, not read from Evidence).
// Run with: npx tsx --env-file=.env.local --test lib/adaptiveLearning/recommend.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyGroup, decideAdaptive, buildAdaptiveTask, buildClassRecommendations, neutralGroupLabel } from './recommend'
import type { LearnerIntelligenceProjection, AcademicValue, RiskValue } from '@/lib/projection/types'

const SUBJECT = 'mathematics'

/** A chronological (oldest-first) level history, in the shape academicProjector produces. */
function historyOf(levels: Array<1 | 2 | 3 | 4>) {
  return levels.map((level, i) => ({ level, score: null, at: `2026-0${i + 1}-01T00:00:00.000Z`, evidenceId: `ev-h${i}` }))
}

function projection(overrides: {
  level?: 1 | 2 | 3 | 4 | null
  trend?: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  riskSeverity?: 'watch' | 'at_risk' | 'critical' | null
  confidence?: number
  evidenceIds?: string[]
  /** Oldest-first level history for the subject. `level` above stays the latestLevel, exactly as Projection reports it. */
  history?: Array<1 | 2 | 3 | 4>
}): LearnerIntelligenceProjection {
  const level = overrides.level === undefined ? 3 : overrides.level
  const academic = level === null ? null : {
    value: {
      bySubject: {
        [SUBJECT]: {
          subject: SUBJECT,
          latestLevel: level,
          trend: overrides.trend ?? 'stable',
          history: historyOf(overrides.history ?? []),
        },
      },
      bySubStrand: {},
    } as AcademicValue,
    supportingEvidenceIds: overrides.evidenceIds ?? ['ev-1', 'ev-2'],
    confidence: overrides.confidence ?? 80,
    coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'academic-v1',
  }

  const risk = overrides.riskSeverity === undefined ? null : {
    value: {
      flags: overrides.riskSeverity === null ? [] : [{
        subject: SUBJECT, reason: 'test', severity: overrides.riskSeverity, evidenceIds: ['ev-1'],
      }],
      overallRiskLevel: 'normal',
    } as RiskValue,
    supportingEvidenceIds: ['ev-1'],
    confidence: 80,
    coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'risk-v1',
  }

  return {
    learnerId: 'learner-1', academic, capability: null, knowledge: null,
    behaviour: null, growth: null, risk, completeness: null,
  }
}

// ── classifyGroup ─────────────────────────────────────────────────────────────

test('classifyGroup: no academic projection → insufficient_data', () => {
  const p = projection({ level: null })
  assert.equal(classifyGroup(p, SUBJECT), 'insufficient_data')
})

test('classifyGroup: level 1 + critical risk severity → critical_gap', () => {
  const p = projection({ level: 1, riskSeverity: 'critical' })
  assert.equal(classifyGroup(p, SUBJECT), 'critical_gap')
})

test('classifyGroup: level 1 without critical severity → prerequisite_gap, not critical_gap', () => {
  const p = projection({ level: 1, riskSeverity: 'at_risk' })
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

test('classifyGroup: level 2 → prerequisite_gap regardless of risk', () => {
  const p = projection({ level: 2, riskSeverity: null })
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

test('classifyGroup: level 3 → concept_confusion', () => {
  const p = projection({ level: 3 })
  assert.equal(classifyGroup(p, SUBJECT), 'concept_confusion')
})

test('classifyGroup: level 4 → on_track (Group C)', () => {
  const p = projection({ level: 4 })
  assert.equal(classifyGroup(p, SUBJECT), 'on_track')
})

test('classifyGroup: a risk flag for a different subject is ignored', () => {
  const p = projection({ level: 1, riskSeverity: 'critical' })
  p.risk!.value.flags[0] = { subject: 'english', reason: 'x', severity: 'critical', evidenceIds: [] }
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

// ── classifyGroup — curriculum-aware (ADR-0024 Phase 3) ───────────────────────

test('classifyGroup: a resolved sub-strand level overrides the subject-level level', () => {
  const p = projection({ level: 4 }) // subject-level says on_track
  p.academic!.value.bySubStrand['ss-1'] = {
    subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS',
    subject: SUBJECT, latestLevel: 1, trend: 'declining', history: [],
  }
  assert.equal(classifyGroup(p, SUBJECT, 'ss-1'), 'prerequisite_gap')
})

test('classifyGroup: an unresolved subStrandId falls back to subject-level, never guesses', () => {
  const p = projection({ level: 2 })
  assert.equal(classifyGroup(p, SUBJECT, 'ss-not-present'), 'prerequisite_gap')
})

test('classifyGroup: a sub-strand entry for a different subject is not used', () => {
  const p = projection({ level: 4 })
  p.academic!.value.bySubStrand['ss-1'] = {
    subStrandId: 'ss-1', subStrandTitle: 'Grammar', strandTitle: 'LANGUAGE',
    subject: 'english', latestLevel: 1, trend: 'declining', history: [],
  }
  assert.equal(classifyGroup(p, SUBJECT, 'ss-1'), 'on_track')
})

// ── buildAdaptiveTask (Insight shape) ─────────────────────────────────────────

test('buildAdaptiveTask: insufficient data produces the shared insufficientEvidenceInsight, never a guess', () => {
  const p = projection({ level: null })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.groupType, 'insufficient_data')
  assert.equal(task.level, null)
  assert.equal(task.confidence, 'Low')
  assert.deepEqual(task.evidence, [])
  assert.match(task.observation, /insufficient evidence/)
})

test('buildAdaptiveTask: every task carries observation, evidence, confidence, action (LI-2)', () => {
  const p = projection({ level: 2, evidenceIds: ['ev-a', 'ev-b'] })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.groupType, 'prerequisite_gap')
  assert.ok(task.observation.length > 0)
  assert.deepEqual(task.evidence, ['ev-a', 'ev-b'])
  assert.ok(['Low', 'Medium', 'High'].includes(task.confidence))
  assert.ok(task.action.length > 0)
})

test('buildAdaptiveTask: career note is appended to the action when provided', () => {
  const p = projection({ level: 4 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { careerNote: 'Future Engineer: try a design challenge.' })
  assert.match(task.action, /Future Engineer/)
})

test('buildAdaptiveTask: on_track maps to enrichment task style', () => {
  const p = projection({ level: 4 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.taskStyle, 'enrichment')
})

// ── Curriculum Grounding Layer (Wave 7) ───────────────────────────────────────

test('buildAdaptiveTask: without a curriculum context, the task is honest — null curriculum, explicit notice, generic action', () => {
  const p = projection({ level: 2 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.curriculum, null)
  assert.match(task.curriculumNotice ?? '', /No specific curriculum sub-strand/)
})

test('buildAdaptiveTask: with a curriculum context but zero seeded outcomes, states the gap explicitly rather than fabricating one', () => {
  const p = projection({ level: 2 })
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: [], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  assert.deepEqual(task.curriculum, curriculum)
  assert.match(task.curriculumNotice ?? '', /No Specific Learning Outcomes are seeded/)
  assert.match(task.action, /Re-teach the prerequisite/) // falls back to the generic template, honestly
})

test('buildAdaptiveTask: with real learning outcomes, the action is built from the actual outcome text, and there is no notice', () => {
  const p = projection({ level: 2 })
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: ['Add fractions with different denominators'], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  assert.equal(task.curriculumNotice, null)
  assert.match(task.action, /Add fractions with different denominators/)
  assert.match(task.action, /Fractions/)
  assert.match(task.observation, /NUMBERS — Fractions/)
  assert.equal(task.academicGrain, 'subject') // no bySubStrand evidence in this fixture — honest fallback
})

// ── buildAdaptiveTask — curriculum-aware academic grain (ADR-0024 Phase 3) ────

test('buildAdaptiveTask: insufficient data carries a null academicGrain', () => {
  const p = projection({ level: null })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.academicGrain, null)
})

test('buildAdaptiveTask: without a curriculum context, academicGrain is subject-level', () => {
  const p = projection({ level: 2 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.academicGrain, 'subject')
})

test('buildAdaptiveTask: when Projection has resolved sub-strand evidence, the task consumes it — level, trend, and grain all come from bySubStrand', () => {
  const p = projection({ level: 4, trend: 'stable' }) // subject-level says on_track, improving would mislead
  p.academic!.value.bySubStrand['ss1'] = {
    subStrandId: 'ss1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS',
    subject: SUBJECT, latestLevel: 1, trend: 'declining', history: [],
  }
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: ['Add fractions with different denominators'], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })

  assert.equal(task.academicGrain, 'subStrand')
  assert.equal(task.level, 1)
  assert.equal(task.groupType, 'prerequisite_gap') // driven by the sub-strand level, not the subject's on_track
  assert.match(task.observation, /Level 1 in NUMBERS — Fractions \(declining\)/)
  assert.match(task.observation, /specific to this sub-strand/)
})

test('buildAdaptiveTask: a sub-strand entry for a different subject never leaks into this task\'s grain', () => {
  const p = projection({ level: 4 })
  p.academic!.value.bySubStrand['ss-other'] = {
    subStrandId: 'ss-other', subStrandTitle: 'Grammar', strandTitle: 'LANGUAGE',
    subject: 'english', latestLevel: 1, trend: 'declining', history: [],
  }
  const curriculum = {
    strandId: 'lang', strandTitle: 'LANGUAGE', subStrandId: 'ss-other', subStrandTitle: 'Grammar',
    learningOutcomes: [], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  assert.equal(task.academicGrain, 'subject')
  assert.equal(task.level, 4)
})

// ── neutralGroupLabel — must never leak internal taxonomy to a learner ────────

test('neutralGroupLabel: no internal group name appears in any neutral label', () => {
  const internalNames = ['critical_gap', 'prerequisite_gap', 'concept_confusion', 'on_track', 'insufficient_data']
  for (const g of internalNames) {
    const label = neutralGroupLabel(g as never)
    for (const name of internalNames) {
      assert.ok(!label.includes(name), `neutral label "${label}" leaked internal name "${name}"`)
    }
  }
})

// ── buildClassRecommendations ──────────────────────────────────────────────────

test('buildClassRecommendations: sorts learners into the correct groups', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'Critical Learner', projection: projection({ level: 1, riskSeverity: 'critical' }) },
    { learnerId: 'l2', learnerName: 'Gap Learner', projection: projection({ level: 2 }) },
    { learnerId: 'l3', learnerName: 'Confused Learner', projection: projection({ level: 3 }) },
    { learnerId: 'l4', learnerName: 'On Track Learner', projection: projection({ level: 4 }) },
    { learnerId: 'l5', learnerName: 'No Data Learner', projection: projection({ level: null }) },
  ]

  const groups = buildClassRecommendations(learners, SUBJECT)

  assert.equal(groups.critical_gap.length, 1)
  assert.equal(groups.critical_gap[0].learnerId, 'l1')
  assert.equal(groups.prerequisite_gap.length, 1)
  assert.equal(groups.prerequisite_gap[0].learnerId, 'l2')
  assert.equal(groups.concept_confusion.length, 1)
  assert.equal(groups.on_track.length, 1)
  assert.equal(groups.insufficient_data.length, 1)
})

test('buildClassRecommendations: is deterministic for identical input', () => {
  const learners = [{ learnerId: 'l1', learnerName: 'A', projection: projection({ level: 3 }) }]
  const first = buildClassRecommendations(learners, SUBJECT)
  const second = buildClassRecommendations(learners, SUBJECT)
  assert.deepEqual(first, second)
})

// ── Evidence-aware adaptation (Adaptive Remediation Phase 1, Stages 2-3) ─────
//
// The governing rule these tests exist to protect: evidence QUANTITY changes
// how confidently the system adapts, never WHETHER it adapts. There is
// exactly one path to `insufficient_data` — no academic signal at all.

test('ONE valid assessment is enough to adapt — never insufficient_data', () => {
  for (const level of [1, 2, 3, 4] as const) {
    const p = projection({ level, history: [level] })
    const decision = decideAdaptive(p, SUBJECT)
    assert.notEqual(decision.groupType, 'insufficient_data',
      `Level ${level} on a single observation must still produce a real adaptive band`)
    assert.equal(decision.evidenceState, 'initial')
    assert.equal(decision.observationCount, 1)
  }
})

test('a single weak assessment adapts immediately — the learner gets support, not a refusal', () => {
  const decision = decideAdaptive(projection({ level: 2, history: [2] }), SUBJECT)
  assert.equal(decision.groupType, 'prerequisite_gap', 'support is offered on the first observation')
  assert.equal(decision.provisional, true, 'but it is explicitly revisable, not asserted as a settled pattern')
})

test('insufficient_data means NO signal at all, never "only one assessment"', () => {
  const decision = decideAdaptive(projection({ level: null }), SUBJECT)
  assert.equal(decision.groupType, 'insufficient_data')
  assert.equal(decision.evidenceState, 'no_evidence')
  assert.equal(decision.observationCount, 0)

  // And the one-observation case is emphatically NOT this case.
  assert.notEqual(decideAdaptive(projection({ level: 1, history: [1] }), SUBJECT).evidenceState, 'no_evidence')
})

test('evidence state escalates with corroboration: initial -> developing -> established', () => {
  assert.equal(decideAdaptive(projection({ level: 3, history: [3] }), SUBJECT).evidenceState, 'initial')
  assert.equal(decideAdaptive(projection({ level: 3, history: [3, 3] }), SUBJECT).evidenceState, 'developing')
  assert.equal(decideAdaptive(projection({ level: 3, history: [3, 3, 3] }), SUBJECT).evidenceState, 'established')
})

test('provisional clears once a second observation corroborates', () => {
  assert.equal(decideAdaptive(projection({ level: 2, history: [2] }), SUBJECT).provisional, true)
  assert.equal(decideAdaptive(projection({ level: 2, history: [2, 2] }), SUBJECT).provisional, false)
})

// ── Stage 3: one score must not overturn an established pattern ─────────────

test('one weak score does NOT drop an established strong learner into foundation work', () => {
  // 4, 4, then a single 2. Undamped this is prerequisite_gap -> foundation tier.
  const decision = decideAdaptive(projection({ level: 2, history: [4, 4, 2] }), SUBJECT)
  assert.equal(decision.groupType, 'concept_confusion',
    'damped to supported practice — the learner still gets more support, just not foundation work')
  assert.equal(decision.provisional, true)
  assert.match(decision.rationale, /reverses an established pattern/)
})

test('a SECOND consecutive weak score confirms the change and the state moves fully', () => {
  const decision = decideAdaptive(projection({ level: 2, history: [4, 4, 2, 2] }), SUBJECT)
  assert.equal(decision.groupType, 'prerequisite_gap', 'corroborated — the adaptive state moves')
  assert.equal(decision.provisional, false)
})

test('damping is symmetric — one strong score does not jump an established weak learner to enrichment', () => {
  const decision = decideAdaptive(projection({ level: 4, history: [1, 1, 4] }), SUBJECT)
  assert.equal(decision.groupType, 'concept_confusion',
    'a single strong result must not withdraw support a learner may still need')
  assert.equal(decision.provisional, true)
})

test('damping never fires on a wobble within the same instructional tier', () => {
  // 1 and 2 both mean foundation work — a 1->2 move is not a reversal worth damping.
  const decision = decideAdaptive(projection({ level: 1, history: [2, 2, 1] }), SUBJECT)
  assert.equal(decision.groupType, 'prerequisite_gap')
  assert.equal(decision.provisional, false)
})

test('a consistent established pattern is never damped', () => {
  const decision = decideAdaptive(projection({ level: 1, history: [1, 1, 1] }), SUBJECT)
  assert.equal(decision.groupType, 'prerequisite_gap')
  assert.equal(decision.provisional, false)
  assert.equal(decision.evidenceState, 'established')
})

test('damping cannot fire on two observations — there is no established pattern to protect', () => {
  const decision = decideAdaptive(projection({ level: 1, history: [4, 1] }), SUBJECT)
  assert.equal(decision.groupType, 'prerequisite_gap', 'developing evidence follows the latest observation')
  assert.equal(decision.evidenceState, 'developing')
})

test('critical_gap still requires a critical risk flag, which itself requires corroboration', () => {
  // Undamped path: level 1 + critical severity, on a consistent pattern.
  const withFlag = decideAdaptive(projection({ level: 1, riskSeverity: 'critical', history: [2, 1, 1] }), SUBJECT)
  assert.equal(withFlag.groupType, 'critical_gap')

  // Same level, no critical flag -> never critical_gap.
  const noFlag = decideAdaptive(projection({ level: 1, riskSeverity: null, history: [2, 1, 1] }), SUBJECT)
  assert.equal(noFlag.groupType, 'prerequisite_gap')
})

test('classifyGroup and decideAdaptive can never disagree — one computation, two surfaces', () => {
  const cases = [
    projection({ level: 2, history: [4, 4, 2] }),
    projection({ level: 1, riskSeverity: 'critical', history: [3, 1, 1] }),
    projection({ level: 4, history: [4] }),
    projection({ level: null }),
  ]
  for (const p of cases) {
    assert.equal(classifyGroup(p, SUBJECT), decideAdaptive(p, SUBJECT).groupType)
  }
})

test('a provisional decision says so in the observation a teacher actually reads', () => {
  const task = buildAdaptiveTask('l1', 'Amina', SUBJECT, projection({ level: 2, history: [2] }))
  assert.equal(task.decision.provisional, true)
  assert.match(task.observation, /first confirmed observation/,
    'the uncertainty is in the sentence, not hidden in an unrendered field')
})

test('a well-corroborated decision does not clutter the observation with caveats', () => {
  const task = buildAdaptiveTask('l1', 'Amina', SUBJECT, projection({ level: 2, history: [2, 2, 2] }))
  assert.equal(task.decision.provisional, false)
  assert.doesNotMatch(task.observation, /first confirmed observation|reverses an established/)
})

test('every decision carries a non-empty rationale, including insufficient_data', () => {
  for (const p of [projection({ level: 3, history: [3] }), projection({ level: null })]) {
    assert.ok(decideAdaptive(p, SUBJECT).rationale.length > 0)
  }
})

test('sub-strand decisions are corroborated by SUB-STRAND history, never by subject-wide history', () => {
  const SUB = 'substrand-uuid-1'
  const p = projection({ level: 4, history: [4, 4, 4] })
  // A sub-strand with its own, single, weak observation inside a strong subject.
  p.academic!.value.bySubStrand[SUB] = {
    subStrandId: SUB, subStrandTitle: 'Proportional Reasoning', strandTitle: 'Numbers',
    subject: SUBJECT, latestLevel: 2, trend: 'insufficient_data',
    history: [{ level: 2, score: null, at: '2026-05-01T00:00:00.000Z', evidenceId: 'ev-s1' }],
  }

  const decision = decideAdaptive(p, SUBJECT, SUB)
  assert.equal(decision.grain, 'subStrand')
  assert.equal(decision.observationCount, 1, 'counts sub-strand observations only, not the subject\'s three')
  assert.equal(decision.evidenceState, 'initial')
  assert.equal(decision.groupType, 'prerequisite_gap',
    'the sub-strand weakness is acted on despite a strong subject picture')
  assert.equal(decision.provisional, true)
})
