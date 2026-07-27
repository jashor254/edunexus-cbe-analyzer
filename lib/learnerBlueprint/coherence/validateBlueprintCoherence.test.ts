// lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts
//
// Pure, DB-free unit tests for the Blueprint Intelligence Coherence Engine
// (Phase 4A). No env vars, no network — every fixture is hand-built.
//
// Run: npx tsx --test lib/learnerBlueprint/coherence/validateBlueprintCoherence.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBlueprintCoherence } from './validateBlueprintCoherence'
import type {
  LearnerBlueprint,
  BlueprintSection,
  AcademicRecordData,
  RiskData,
  LearningStoryData,
  CareerData,
  RecommendedNextStepsData,
} from '@/lib/learnerBlueprint/types'
import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { ParentAction } from '@/lib/parentExperience/actions'

// ── Fixture builders ─────────────────────────────────────────────────────────

function unavailable<T>(): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'test', freshness: 'live', data: null, unavailableReason: 'not composed for this test' }
}

function available<T>(data: T): BlueprintSection<T> {
  return { status: 'available', owner: 'test', freshness: 'live', data }
}

function baseBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  return {
    metadata: {
      blueprintVersion: 'test',
      generatedAt: new Date().toISOString(),
      snapshotState: 'current',
      freshness: 'live',
      evidenceWindow: { start: null, end: new Date().toISOString() },
      ownerVersions: {},
    },
    identity: available({ learnerName: 'Test Learner', admissionNumber: 'T-1', schoolName: 'Test School', schoolLogoUrl: null, currentClassName: null, academicYearLabel: null, termLabel: null, guardians: [] }),
    academicRecord: unavailable<AcademicRecordData>(),
    attendance: unavailable(),
    learningCompass: unavailable(),
    career: unavailable<CareerData>(),
    portfolio: unavailable(),
    achievement: unavailable(),
    projects: unavailable(),
    competitions: unavailable(),
    leadership: unavailable(),
    innovations: unavailable(),
    teacherReflection: unavailable(),
    parentSummary: unavailable(),
    educationalIdentity: { status: 'not_implemented', owner: 'test', freshness: 'live', data: null },
    growthTimeline: unavailable(),
    risk: unavailable<RiskData>(),
    learningStory: unavailable<LearningStoryData>(),
    recommendedNextSteps: unavailable<RecommendedNextStepsData>(),
    ...overrides,
  }
}

function academicRecord(bySubject: AcademicRecordData['bySubject'], overallTrend: AcademicRecordData['overallTrend'] = 'stable'): BlueprintSection<AcademicRecordData> {
  return available({ overallTrend, bySubject, competencies: [], confidence: 70, lastComputed: new Date().toISOString() })
}

function subject(over: Partial<AcademicRecordData['bySubject'][number]> = {}): AcademicRecordData['bySubject'][number] {
  return { subject: 'kiswahili_lugha', latestLevel: 4, trend: 'stable', evidenceCount: 1, latestEvidenceAt: new Date().toISOString(), ...over }
}

function risk(over: Partial<RiskData> = {}): BlueprintSection<RiskData> {
  return available({ overallRiskLevel: 'normal', flags: [], supportingEvidenceIds: [], confidence: 70, coverage: { evidenceCount: 1, evidenceDiversity: 1, freshnessDays: 1, latestEvidenceAt: null, oldestEvidenceAt: null }, lastComputed: new Date().toISOString(), ...over })
}

function learningStory(over: Partial<LearningStoryData> = {}): BlueprintSection<LearningStoryData> {
  return available({
    narrative: 'n', evidence: 'e', interpretation: 'i',
    opportunity: 'The greatest current opportunity is to deepen the current strongest area with more evidence.',
    trajectory: 't', nextConcern: 'Across the available evidence, no current risk flag is active.',
    uncertainty: 'u', confidenceStatement: 'c', missingEvidence: 'm',
    ...over,
  })
}

let idSeq = 0
function makeActionItem(over: Partial<BlueprintActionItem> = {}): BlueprintActionItem {
  idSeq += 1
  return {
    id: `action-${idSeq}`,
    learnerId: 'learner-1',
    schoolId: 'school-1',
    academicYearId: null,
    termId: null,
    blueprintSnapshotId: null,
    context: 'current_term',
    priority: 'medium',
    status: 'approved',
    visibility: 'shared',
    title: 'Test action',
    rationale: 'A plain rationale with no deficiency or strength language.',
    intendedOutcome: 'The learner reaches the next goal.',
    learnerAction: null,
    teacherAction: null,
    parentSupport: null,
    schoolSupport: null,
    successIndicator: 'The learner scores at least 70% on the next confirmed assessment in this subject.',
    targetCapability: null,
    reviewDate: '2026-08-15',
    teacherNotes: null,
    proposalSource: 'teacher',
    sourceGenerator: null,
    evidenceBasis: { projectorType: null, supportingEvidenceIds: [], confidence: null, lastComputed: null, projectionVersion: null },
    proposedBy: 'user-1',
    reviewedBy: 'user-1',
    reviewedAt: new Date().toISOString(),
    decisionReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  }
}

function parentAction(over: Partial<ParentAction> = {}): ParentAction {
  return {
    title: 'Test action', description: 'A plain description.', actionType: 'canonical_action_item', priority: 'important',
    sourceDomain: 'Blueprint Action Plan', destination: '/x', available: true, reasonUnavailable: null, generatedAt: new Date().toISOString(),
    ...over,
  }
}

// ── 1. insufficient evidence ─────────────────────────────────────────────────

test('flags a trend claim backed by only one evidence point (insufficient evidence)', () => {
  const bp = baseBlueprint({ academicRecord: academicRecord([subject({ trend: 'improving', evidenceCount: 1 })]) })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.some(f => f.rule === 'evidence_sufficiency' && f.severity === 'critical'))
  assert.equal(report.result, 'FAIL')
})

// ── 2. contradictory recommendation ──────────────────────────────────────────

test('flags two approved actions that contradict each other about the same subject', () => {
  const bp = baseBlueprint({ academicRecord: academicRecord([subject({ subject: 'mathematics' })]) })
  const items = [
    makeActionItem({ title: 'Mathematics support', rationale: 'The learner is struggling and weak in mathematics.' }),
    makeActionItem({ title: 'Mathematics recognition', rationale: 'The learner is showing exceptional strength in mathematics.' }),
  ]
  const report = validateBlueprintCoherence(bp, items)
  assert.ok(report.findings.some(f => f.rule === 'friction_detection' && f.explanation.includes('contradictory')))
})

// ── 3. weakest-subject mismatch ──────────────────────────────────────────────

test('flags the weakest-subject selector naming a learner\'s only, maximum-level subject as "least secure"', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'kiswahili_lugha', latestLevel: 4 })]),
    learningStory: learningStory({ opportunity: 'The greatest current opportunity is to strengthen kiswahili_lugha, where the present capability evidence is least secure.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  const finding = report.findings.find(f => f.rule === 'narrative_alignment' && f.section === 'learningStory' && f.explanation.includes('only recorded subject'))
  assert.ok(finding)
  assert.equal(finding?.severity, 'critical')
  assert.equal(report.result, 'FAIL')
})

// ── 4. duplicated narrative ───────────────────────────────────────────────────

test('flags two approved actions with identical rationale text (duplicated recommendation)', () => {
  const bp = baseBlueprint()
  const items = [
    makeActionItem({ title: 'A', rationale: 'Identical rationale text.' }),
    makeActionItem({ title: 'B', rationale: 'Identical rationale text.' }),
  ]
  const report = validateBlueprintCoherence(bp, items)
  assert.ok(report.findings.some(f => f.rule === 'friction_detection' && f.explanation.includes('identical rationale')))
})

// ── 5. unsupported career claim ───────────────────────────────────────────────

test('flags a low-confidence career narrative with no hedging language', () => {
  const bp = baseBlueprint({
    career: available<CareerData>({ careerCluster: 'Agriculture', strengthProfile: 'You are a strong match for this career.', futureDirection: 'Pursue this path directly.', aiOutlook: null, confidence: 'Low', notes: [] }),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.some(f => f.rule === 'career_alignment' && f.severity === 'warning'))
  assert.equal(report.result, 'PASS_WITH_WARNINGS')
})

// ── 6/7/8. unsupported teacher / learner / parent action ────────────────────

test('flags an unsupported teacherAction, learnerAction, and parentSupport independently', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({
    teacherAction: 'Set weekly passages.',
    learnerAction: 'Complete two passages per week.',
    parentSupport: 'Read together at home.',
    evidenceBasis: { projectorType: null, supportingEvidenceIds: [], confidence: null, lastComputed: null, projectionVersion: null },
  })
  const report = validateBlueprintCoherence(bp, [item])
  const fields = report.findings.filter(f => f.rule === 'action_alignment' && f.section.startsWith(`actionItem:${item.id}.`)).map(f => f.section)
  assert.ok(fields.includes(`actionItem:${item.id}.teacherAction`))
  assert.ok(fields.includes(`actionItem:${item.id}.learnerAction`))
  assert.ok(fields.includes(`actionItem:${item.id}.parentSupport`))
  assert.ok(report.findings.every(f => f.rule !== 'action_alignment' || f.severity === 'warning'))
})

// ── 9. confidence mismatch ────────────────────────────────────────────────────

test('flags a career claim with no confidence label at all (confidence mismatch)', () => {
  const bp = baseBlueprint({
    career: available<CareerData>({ careerCluster: 'Agriculture', strengthProfile: 'A strong fit.', futureDirection: null, aiOutlook: null, confidence: null, notes: [] }),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.some(f => f.rule === 'career_alignment' && f.explanation.includes('no confidence label')))
})

// ── 10. review criteria missing ───────────────────────────────────────────────

test('flags an approved action with no reviewDate (missing review criteria)', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({ reviewDate: null })
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.some(f => f.rule === 'review_alignment' && f.explanation.includes('no reviewDate')))
})

test('flags a maximally generic success indicator', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({ successIndicator: 'Improves.' })
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.some(f => f.rule === 'review_alignment' && f.severity === 'critical'))
  assert.equal(report.result, 'FAIL')
})

// ── 11. action unsupported by evidence ────────────────────────────────────────

test('flags a system-proposed action with no evidence chain as critical', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({
    proposalSource: 'system',
    sourceGenerator: 'deterministic-adaptive-v1',
    evidenceBasis: { projectorType: null, supportingEvidenceIds: [], confidence: null, lastComputed: null, projectionVersion: null },
  })
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.some(f => f.rule === 'action_alignment' && f.severity === 'critical' && f.explanation.includes('System-proposed')))
  assert.equal(report.result, 'FAIL')
})

test('does NOT flag a teacher-authored action with no evidence chain as critical (allowed by design)', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({ proposalSource: 'teacher', teacherAction: null, learnerAction: null, parentSupport: null })
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.every(f => f.severity !== 'critical'))
  assert.equal(report.result, 'PASS')
})

// ── 12. projection/narrative disagreement ─────────────────────────────────────

test('flags Learning Story claiming "no risk flag active" while Risk reports active flags', () => {
  const bp = baseBlueprint({
    risk: risk({ overallRiskLevel: 'at_risk', flags: [{ subject: 'mathematics', reason: 'Below Expectation in mathematics', severity: 'at_risk', evidenceIds: ['ev-1'] }] }),
    learningStory: learningStory({ nextConcern: 'Across the available evidence, no current risk flag is active.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.some(f => f.rule === 'narrative_alignment' && f.severity === 'critical' && f.explanation.includes('disagree')))
  assert.equal(report.result, 'FAIL')
})

test('flags a declining overall trend the narrative never mentions', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject()], 'declining'),
    learningStory: learningStory({ trajectory: 'Steady as before.', nextConcern: 'Nothing notable.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.some(f => f.rule === 'narrative_alignment' && f.explanation.includes('declining')))
})

// ── 13. recommendation/narrative disagreement (the real audit bug) ──────────

test('flags an approved action asserting a deficiency in a subject the evidence shows is healthy', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'kiswahili_lugha', latestLevel: 4, trend: 'stable' })]),
    risk: risk({ overallRiskLevel: 'normal', flags: [] }),
  })
  const item = makeActionItem({
    title: 'Strengthen Kiswahili comprehension through weekly guided practice',
    rationale: 'Recent Kiswahili evidence shows comprehension below the level expected for this term.',
  })
  const report = validateBlueprintCoherence(bp, [item])
  const finding = report.findings.find(f => f.rule === 'recommendation_alignment' && f.severity === 'critical')
  assert.ok(finding)
  assert.match(finding!.explanation, /contradicts the learner's own evidence/)
  assert.equal(report.result, 'FAIL')
})

// ── 14. recommendation/action disagreement ────────────────────────────────────

test('flags an active at-risk flag with no corresponding recommended action', () => {
  const bp = baseBlueprint({
    risk: risk({ overallRiskLevel: 'at_risk', flags: [{ subject: 'mathematics', reason: 'Below Expectation in mathematics', severity: 'at_risk', evidenceIds: ['ev-1'] }] }),
  })
  const item = makeActionItem({ title: 'Unrelated Kiswahili action', rationale: 'A rationale about kiswahili_lugha only.' })
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.some(f => f.rule === 'recommendation_alignment' && f.explanation.includes('no approved action item addresses that subject')))
})

// ── 15. PASS case ─────────────────────────────────────────────────────────────

test('PASS: a fully coherent Blueprint with a well-formed action produces zero findings', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'kiswahili_lugha', latestLevel: 2, trend: 'stable', evidenceCount: 3 })]),
    risk: risk({ overallRiskLevel: 'watch', flags: [{ subject: 'kiswahili_lugha', reason: 'Approaching Expectation in kiswahili_lugha', severity: 'watch', evidenceIds: ['ev-1', 'ev-2'] }] }),
    learningStory: learningStory({ opportunity: 'The greatest current opportunity is to deepen the current strongest area with more evidence.', nextConcern: 'The main concern that deserves attention now is approaching expectation in kiswahili_lugha.' }),
    recommendedNextSteps: available<RecommendedNextStepsData>({ actions: [parentAction({ description: 'Continue weekly kiswahili_lugha practice.' })] }),
  })
  const item = makeActionItem({
    title: 'Kiswahili practice',
    rationale: 'Kiswahili is approaching expectation and would benefit from continued practice.',
    targetCapability: 'kiswahili_lugha',
    successIndicator: 'The learner\'s next confirmed Kiswahili evidence shows a full CBC level improvement.',
    reviewDate: '2026-08-15',
  })
  const report = validateBlueprintCoherence(bp, [item])
  assert.deepEqual(report.findings, [])
  assert.equal(report.result, 'PASS')
})

// ── 16. PASS_WITH_WARNINGS case ───────────────────────────────────────────────

test('PASS_WITH_WARNINGS: only warning-severity findings still allow the Blueprint to render', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({ reviewDate: null }) // warning only
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.length > 0)
  assert.ok(report.findings.every(f => f.severity === 'warning'))
  assert.equal(report.result, 'PASS_WITH_WARNINGS')
})

// ── 17. FAIL case ──────────────────────────────────────────────────────────────

test('FAIL: any critical finding fails the whole report regardless of accompanying warnings', () => {
  const bp = baseBlueprint({ academicRecord: academicRecord([subject({ trend: 'declining', evidenceCount: 1 })]) })
  const item = makeActionItem({ reviewDate: null }) // adds a warning alongside the critical evidence-sufficiency finding
  const report = validateBlueprintCoherence(bp, [item])
  assert.ok(report.findings.some(f => f.severity === 'critical'))
  assert.ok(report.findings.some(f => f.severity === 'warning'))
  assert.equal(report.result, 'FAIL')
})

// ── Warnings never mutate content ─────────────────────────────────────────────

test('warnings never mutate the input Blueprint or action items', () => {
  const bp = baseBlueprint()
  const item = makeActionItem({ reviewDate: null })
  const bpCopy = JSON.parse(JSON.stringify(bp))
  const itemCopy = JSON.parse(JSON.stringify(item))
  validateBlueprintCoherence(bp, [item])
  assert.deepEqual(JSON.parse(JSON.stringify(bp)), bpCopy)
  assert.deepEqual(JSON.parse(JSON.stringify(item)), itemCopy)
})

// ── Phase 4B.1 — comparable-context growth correction, coherence-side ───────

function parentSummary(headline: string | null): BlueprintSection<import('@/lib/learnerBlueprint/types').ParentSummaryData> {
  return available({ headline, detail: null, action: null })
}

test('flags a strong-subject-insecurity claim on a 2+-subject Blueprint without support (the Victor Gitau bug)', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([
      subject({ subject: 'kiswahili_lugha', latestLevel: 4, trend: 'insufficient_data' }),
      subject({ subject: 'mathematics', latestLevel: 4, trend: 'improving' }),
    ], 'improving'),
    risk: risk({ overallRiskLevel: 'normal', flags: [] }),
    learningStory: learningStory({ opportunity: 'The greatest current opportunity is to strengthen kiswahili_lugha, where the present capability evidence is least secure.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  const finding = report.findings.find(f => f.rule === 'narrative_alignment' && f.section === 'learningStory' && f.explanation.includes('kiswahili_lugha'))
  assert.ok(finding)
  assert.equal(finding?.severity, 'critical')
  assert.equal(report.result, 'FAIL')
})

test('does NOT flag a legitimate strong-subject enrichment opportunity (no deficiency language)', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([
      subject({ subject: 'kiswahili_lugha', latestLevel: 4, trend: 'insufficient_data' }),
      subject({ subject: 'mathematics', latestLevel: 4, trend: 'improving' }),
    ], 'improving'),
    risk: risk({ overallRiskLevel: 'normal', flags: [] }),
    learningStory: learningStory({ opportunity: 'kiswahili_lugha is relatively lower than mathematics in the current evidence, but remains strong — this reads as an enrichment opportunity, not a gap needing remediation.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.every(f => !(f.rule === 'narrative_alignment' && f.section === 'learningStory')))
})

test('flags an overall "declining" trend with no subject actually declining (cross-subject pooled false decline)', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([
      subject({ subject: 'kiswahili_lugha', latestLevel: 4, trend: 'insufficient_data' }),
      subject({ subject: 'mathematics', latestLevel: 3, trend: 'improving' }),
    ], 'declining'), // inconsistent by construction — proves the coherence-side guard, not just growthProjector's own impossibility
  })
  const report = validateBlueprintCoherence(bp, [])
  const finding = report.findings.find(f => f.rule === 'narrative_alignment' && f.section === 'academicRecord' && f.explanation.includes('no individual subject'))
  assert.ok(finding)
  assert.equal(finding?.severity, 'critical')
  assert.equal(report.result, 'FAIL')
})

test('flags a Parent Summary headline that reads as decline while Academic Record is not declining', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'mathematics', latestLevel: 4, trend: 'improving' })], 'improving'),
    parentSummary: parentSummary("Victor Gitau's progress this term needs attention."),
  })
  const report = validateBlueprintCoherence(bp, [])
  const finding = report.findings.find(f => f.rule === 'narrative_alignment' && f.section === 'parentSummary')
  assert.ok(finding)
  assert.equal(finding?.severity, 'critical')
  assert.equal(report.result, 'FAIL')
})

test('does NOT flag a Parent Summary headline that correctly agrees with a declining Academic Record', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'mathematics', latestLevel: 1, trend: 'declining' })], 'declining'),
    learningStory: learningStory({ trajectory: 'Declining.', nextConcern: 'Mathematics is declining and needs attention.' }),
    parentSummary: parentSummary("Cheruiyot Gitau's progress this term needs attention."),
  })
  const report = validateBlueprintCoherence(bp, [])
  assert.ok(report.findings.every(f => f.section !== 'parentSummary'))
})

test('flags a declining trend with a "normal, no active flags" risk read as a growth/risk disagreement (warning)', () => {
  const bp = baseBlueprint({
    academicRecord: academicRecord([subject({ subject: 'mathematics', latestLevel: 1, trend: 'declining' })], 'declining'),
    risk: risk({ overallRiskLevel: 'normal', flags: [] }),
    learningStory: learningStory({ trajectory: 'Declining.', nextConcern: 'Mathematics is declining.' }),
  })
  const report = validateBlueprintCoherence(bp, [])
  const finding = report.findings.find(f => f.rule === 'evidence_sufficiency' && f.section === 'risk')
  assert.ok(finding)
  assert.equal(finding?.severity, 'warning')
})

// ── Report shape ───────────────────────────────────────────────────────────────

test('report always carries a generatedAt timestamp and the current rule version', () => {
  const report = validateBlueprintCoherence(baseBlueprint(), [])
  assert.ok(report.generatedAt.length > 0)
  assert.equal(report.ruleVersion, '1.0.0')
})
