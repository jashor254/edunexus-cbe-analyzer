// lib/academicClinic/engineDivergenceCharacterization.test.ts
//
// Phase 2 (Learner Report Architecture — Clinic engine reconciliation).
//
// This file originally pinned down two confirmed divergences the Phase 2
// audit found, as reproducible characterization fixtures, without fixing
// either (both needed a founder-level product decision on which output
// survives — see the Phase 2 closeout). Phase 2.1 (canonical ownership
// cutover, founder decisions applied) resolved the pathway divergence — its
// tests below now prove CONVERGENCE, not divergence; that is the intended,
// documented semantic change, not a broken test. The trajectory divergence
// (assessmentPipeline.ts's empty-history argument) remains unresolved,
// deliberately, per Phase 2.1's own scope lock ("do NOT fix that
// automatically here... unless this phase proves it directly blocks
// canonical cutover" — it does not).
//
// 1. TRAJECTORY: assessmentPipeline.ts (the pipeline that actually emails/
//    WhatsApps the Clinic PDF to parents, on every teacher/parent
//    assessment submission) hardcodes `generateReport(..., [], ...)` — an
//    empty assessments array — which permanently dead-codes the multi-point
//    trend branch inside generateClinicalOverview(). This test proves the
//    branch genuinely produces a different trajectory when a real
//    assessment history IS supplied vs. when it is empty, for the IDENTICAL
//    current subject scores — i.e. the automatically-delivered report can
//    structurally never say IMPROVING, while an on-demand report for the
//    same learner, same day, can.
//
// 2. PATHWAY THRESHOLDS (Phase 2.1 UPDATE): this used to characterize a real
//    contradiction — lib/pathwayCalculator.ts's canonical PATHWAY_RULES.STEM
//    gated "languages" on a single COMBINED English+Kiswahili average
//    (>= 2.5), while reportGenerator.ts's own PATHWAY_REQS gated English and
//    Kiswahili SEPARATELY (English >= 3, Kiswahili >= 2) inside
//    buildPathwayReadinessCards() — so the same learner could be told
//    "languages requirement met" by the canonical calculator and "English
//    gap — one step away" by Clinic's own gap-row table, for identical
//    scores.
//
//    Phase 2.1 (canonical pathway ownership, Decision 1) fixed this: STEM's
//    language gap row is now built by buildStemLanguageGapRow() using
//    PATHWAY_RULES.STEM.language_avg directly — the same single canonical
//    threshold, not two invented per-subject ones. This test now proves
//    CONVERGENCE instead of divergence — this is the intentional semantic
//    change, not a regression. See the Phase 2.1 closeout's semantic change
//    ledger. Social Sciences/Arts & Sports Science rows are unchanged
//    (PATHWAY_RULES defines no canonical per-subject requirement for either,
//    so there was never a contradiction there to fix — see the comment
//    above PATHWAY_REQS in reportGenerator.ts).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/engineDivergenceCharacterization.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateReport,
  generateClinicalOverview,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
} from './reportGenerator'
import type { SubjectProgress, StudentProfile } from './types'

// ─── 1. Trajectory dead-branch divergence ─────────────────────────────────

test('CHARACTERIZATION: trajectory differs for the identical current scores depending on whether assessment history is supplied', () => {
  const subjects: SubjectProgress[] = [
    { subject: 'mathematics', displayName: 'Mathematics', level: 2, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'english', displayName: 'English', level: 1, trend: 'stable', velocity: 0, previousScores: [] },
  ]

  // Same caller shape as assessmentPipeline.ts:242 — an empty assessments
  // array. avg = 1.5, so the CRITICAL branch (`avg < 1.5`) does not fire and
  // the `assessments.length >= 2` branch is unreachable — falls to
  // NEEDS ATTENTION.
  const withoutHistory = generateClinicalOverview('Test Student', subjects, [])
  assert.equal(withoutHistory.trajectory, 'NEEDS ATTENTION',
    'sanity check: this is the exact behaviour assessmentPipeline.ts guarantees for every automatically-delivered report today')

  // Same current subjects, but the caller (e.g. clinicPdfHandler.ts, which
  // DOES pass real history) supplies 2+ real assessment rows showing a
  // genuine upward trend — a strictly LOWER prior average than the current
  // one, which is exactly what the (structurally unreachable, in the
  // pipeline path) `assessments.length >= 2` branch checks for.
  const withHistory = generateClinicalOverview('Test Student', subjects, [
    { subject_scores: { mathematics: 1, english: 1 } }, // avg 1.0, two terms ago
    { subject_scores: { mathematics: 2, english: 1 } }, // avg 1.5, current term — same as `subjects` above
  ])
  assert.equal(withHistory.trajectory, 'IMPROVING',
    'the multi-point branch, when actually reachable, correctly detects the upward trend the pipeline-delivered report can never see')

  // The point of this fixture: identical current-term scores, genuinely
  // different trajectory labels, purely because of which caller happened to
  // supply history. Not a hypothetical — assessmentPipeline.ts:242's literal
  // `[]` guarantees every parent/teacher-emailed report takes the first path.
  assert.notEqual(withoutHistory.trajectory, withHistory.trajectory)
})

// ─── 2. Pathway threshold divergence (canonical vs. Clinic's own gap table) ─

test('CONVERGENCE (Phase 2.1): canonical pathwayCalculator and Clinic\'s own pathway gap table now AGREE on the STEM language requirement', () => {
  // English=2, Kiswahili=4 -> combined language_avg = 3.0, which clears the
  // canonical PATHWAY_RULES.STEM.language_avg threshold (2.5). Before
  // Phase 2.1, Clinic's own PATHWAY_REQS gated English separately at
  // required=3 and would have flagged this as a gap despite the strong
  // combined average. It no longer does — both now source from the same
  // PATHWAY_RULES.STEM.language_avg threshold.
  const subjects: SubjectProgress[] = [
    { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'integrated_science', displayName: 'Integrated Science', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'english', displayName: 'English', level: 2, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'kiswahili', displayName: 'Kiswahili', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  ]

  const profile: StudentProfile = {
    id: 'test-student', name: 'Test Student', grade: 8, level: 'Junior School', term: 1, year: 2026,
  }
  const vitals = calculateVitals(subjects)
  const actionPlan = generateActionPlan(subjects)
  const juniorGuidance = generateJuniorGuidance(subjects)

  const report = generateReport(profile, subjects, vitals, actionPlan, [], juniorGuidance, undefined)

  // Canonical calculateJuniorPathwayAffinity (via pathwayAnalysis.to_unlock_stem):
  // languages should NOT appear as something still to unlock — the combined
  // average (3.0) already clears 2.5.
  const canonicalLanguagesGap = report.pathwayAnalysis?.to_unlock_stem?.some(s => s.toLowerCase().includes('language'))
  assert.equal(canonicalLanguagesGap, false,
    'canonical pathwayCalculator must consider the combined language average (3.0) as already meeting the 2.5 threshold')

  // Clinic's own buildPathwayReadinessCards now sources its "Languages" row
  // from the same PATHWAY_RULES.STEM.language_avg threshold — it must agree
  // with the canonical calculator above, not contradict it.
  const stemCard = report.pathwayReadinessCards?.find(c => c.pathway === 'STEM')
  const languageRow = stemCard?.gapRows.find(r => r.subjectKey === 'languages')
  assert.ok(languageRow, 'STEM card must have a combined Languages gap row')
  assert.equal(languageRow!.status, 'met',
    'Clinic\'s own gap table must now agree with the canonical calculator: combined language average 3.0 >= 2.5 threshold is MET')

  // There must no longer be two separate English/Kiswahili rows with their
  // own independently-invented thresholds.
  assert.equal(stemCard?.gapRows.some(r => r.displayName === 'English'), false,
    'English must no longer be a separate gap row with its own threshold')
  assert.equal(stemCard?.gapRows.some(r => r.displayName === 'Kiswahili'), false,
    'Kiswahili must no longer be a separate gap row with its own threshold')
})

test('CONVERGENCE (Phase 2.1): a learner whose combined language average genuinely fails the canonical threshold is still flagged as a gap', () => {
  // English=1, Kiswahili=2 -> combined language_avg = 1.5, well below the
  // canonical 2.5 threshold. This must still show as a real, unmet gap —
  // the fix must not have accidentally made every learner "pass".
  const subjects: SubjectProgress[] = [
    { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'integrated_science', displayName: 'Integrated Science', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'english', displayName: 'English', level: 1, trend: 'stable', velocity: 0, previousScores: [] },
    { subject: 'kiswahili', displayName: 'Kiswahili', level: 2, trend: 'stable', velocity: 0, previousScores: [] },
  ]
  const profile: StudentProfile = {
    id: 'test-student-2', name: 'Test Student Two', grade: 8, level: 'Junior School', term: 1, year: 2026,
  }
  const vitals = calculateVitals(subjects)
  const actionPlan = generateActionPlan(subjects)
  const juniorGuidance = generateJuniorGuidance(subjects)
  const report = generateReport(profile, subjects, vitals, actionPlan, [], juniorGuidance, undefined)

  const stemCard = report.pathwayReadinessCards?.find(c => c.pathway === 'STEM')
  const languageRow = stemCard?.gapRows.find(r => r.subjectKey === 'languages')
  assert.ok(languageRow)
  assert.equal(languageRow!.status, 'one_step')
})

test('CHARACTERIZATION: a learner with only Mathematics assessed (missing-subject sparse evidence) gets an honest partial average, not a fabricated pass or a crash', () => {
  // Only Mathematics present -> the Languages row is entirely absent
  // (neither English nor Kiswahili has any evidence) and must be omitted,
  // not silently treated as a fail (level 0 fabricated) or a pass.
  const subjects: SubjectProgress[] = [
    { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  ]
  const profile: StudentProfile = {
    id: 'test-student-3', name: 'Test Student Three', grade: 8, level: 'Junior School', term: 1, year: 2026,
  }
  const vitals = calculateVitals(subjects)
  const actionPlan = generateActionPlan(subjects)
  const juniorGuidance = generateJuniorGuidance(subjects)
  const report = generateReport(profile, subjects, vitals, actionPlan, [], juniorGuidance, undefined)

  const stemCard = report.pathwayReadinessCards?.find(c => c.pathway === 'STEM')
  const languageRow = stemCard?.gapRows.find(r => r.subjectKey === 'languages')
  assert.equal(languageRow, undefined, 'no evidence for either language -> the row must be omitted, not fabricated')

  // Mathematics itself, the one subject with real evidence, must still show.
  const mathRow = stemCard?.gapRows.find(r => r.displayName === 'Mathematics')
  assert.ok(mathRow)
  assert.equal(mathRow!.status, 'met')
})
