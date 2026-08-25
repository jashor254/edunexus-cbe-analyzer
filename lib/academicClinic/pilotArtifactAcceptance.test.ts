// lib/academicClinic/pilotArtifactAcceptance.test.ts
//
// Pilot Artifact Acceptance phase — QA/acceptance pass on the actual
// rendered Learner Intelligence Report PDF (lib/academicClinic/pdfGenerator.tsx,
// the single live renderer both /api/academic-clinic/pdf and
// /api/clinic/download delegate to via lib/academicClinic/clinicPdfHandler.ts).
// Not an architecture test — every guard here traces back to a real defect
// found by actually generating and inspecting six representative PDFs
// (page-rasterized and text-extracted) during that phase, then fixed.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/pilotArtifactAcceptance.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  calculateVitals, generateActionPlan, generateJuniorGuidance, generateReport,
  formatSubjectName, buildJuniorActionPriorities, buildSeniorReadinessIndicators,
} from './reportGenerator'
import type { SubjectProgress, StudentProfile } from './reportGenerator'
import { generateAcademicClinicPDF } from './pdfGenerator'
import type { PathwayReadinessCard } from './types'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { buildSeniorGuidanceFromCanonical } from './canonicalSeniorGuidance'
import type { CanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const RENDERER_SOURCE = readFileSync(`${REPO_ROOT}lib/academicClinic/pdfGenerator.tsx`, 'utf8')

function renderedTextOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

// ── Regression guard: the P0 crash (borderWidth: 0) ─────────────────────────
//
// @react-pdf/stylesheet's border-shorthand resolver treats a falsy width
// (0) as "no shorthand match" and falls through to `undefined`, throwing
// "Invalid border width: undefined". A literal `borderWidth: 0` used to sit
// on the Junior "Current Pathway Readiness" recommended-card style — and
// since exactly one card is always the recommended pathway, every single
// Junior School (Grade 7-9) PDF generation failed, 100% of the time. Guard
// against ever reintroducing a literal zero width in this renderer.

test('renderer source never sets a literal borderWidth: 0 (the exact @react-pdf crash trigger)', () => {
  assert.doesNotMatch(renderedTextOnly(RENDERER_SOURCE), /borderWidth:\s*0\b/,
    'a literal `borderWidth: 0` crashes @react-pdf/stylesheet\'s border-shorthand resolver — use a non-zero width with a matching border color instead')
})

test('renderer source never uses the Unicode arrow (missing glyph in base Helvetica)', () => {
  assert.doesNotMatch(renderedTextOnly(RENDERER_SOURCE), /→/,
    'U+2192 has no glyph in @react-pdf\'s base Helvetica font and renders as a stray mark with a collapsed following space — use the ASCII "->" instead')
})

test('renderer source contains no stale "LEARNER BLUEPRINT" / "CLINICAL ACTION PLAN" branding', () => {
  const rendered = renderedTextOnly(RENDERER_SOURCE)
  assert.doesNotMatch(rendered, /LEARNER BLUEPRINT/,
    'the canonical user-facing name is "Learner Intelligence Report" — LEARNER BLUEPRINT is stale product branding')
  assert.doesNotMatch(rendered, /CLINICAL ACTION PLAN/,
    'avoid medical/diagnostic-sounding section headings in the parent/school-facing artifact')
})

test('LevelBadge has a defensive guard against rendering a literal NaN level', () => {
  assert.match(RENDERER_SOURCE, /function LevelBadge[\s\S]{0,400}Number\.isFinite\(level\)/,
    'zero subject evidence makes overallCompetencyLevel NaN (0/0 in calculateVitals) — LevelBadge must not interpolate a raw NaN into the parent/teacher-facing PDF')
})

test('pathway readiness card fill width is clamped for display (no negative-score full bar)', () => {
  assert.match(RENDERER_SOURCE, /Math\.max\(0, Math\.min\(100, card\.score\)\)/,
    'an unclamped negative card.score renders as a near-full bar — the visual opposite of a near-zero/negative readiness score')
})

// ── Functional regression: Junior PDF generation must not throw ────────────

function buildSubjectProgress(scores: Record<string, number>): SubjectProgress[] {
  return Object.keys(scores).map(subject => ({
    subject, displayName: formatSubjectName(subject), level: scores[subject] as 1 | 2 | 3 | 4,
    trend: 'stable', velocity: 0, previousScores: [scores[subject]],
  }))
}

test('Junior (Grade 7) PDF generates successfully — the exact scenario that used to crash 100% of the time', async () => {
  const scores = {
    mathematics: 2, english: 3, kiswahili: 2, integrated_science: 3,
    social_studies: 2, creative_arts_sports: 3, pre_technical: 2, agriculture_nutrition: 2,
  }
  const subjectProgress = buildSubjectProgress(scores)
  const vitals = calculateVitals(subjectProgress)
  const actionPlan = generateActionPlan(subjectProgress)
  const studentProfile: StudentProfile = {
    id: 'TEST', name: 'Test Learner', grade: 7, level: 'Junior School', term: 1, year: 2026, pathway: null, school: 'Test School',
  }
  const juniorGuidance = generateJuniorGuidance(subjectProgress)
  const report = generateReport(studentProfile, subjectProgress, vitals, actionPlan, [], juniorGuidance, undefined, undefined, [], { trend: null, riskLevel: null })

  const blob = await generateAcademicClinicPDF(report)
  const buf = Buffer.from(await blob.arrayBuffer())
  assert.ok(buf.length > 1000, 'expected a substantial non-empty PDF buffer')
})

test('zero-evidence Junior PDF generates successfully (the lower evidence boundary)', async () => {
  const subjectProgress: SubjectProgress[] = []
  const vitals = calculateVitals(subjectProgress)
  const actionPlan = generateActionPlan(subjectProgress)
  const studentProfile: StudentProfile = {
    id: 'TEST', name: 'Zero Evidence Learner', grade: 7, level: 'Junior School', term: 1, year: 2026, pathway: null, school: 'Test School',
  }
  const juniorGuidance = generateJuniorGuidance(subjectProgress)
  const report = generateReport(studentProfile, subjectProgress, vitals, actionPlan, [], juniorGuidance, undefined, undefined, [], { trend: null, riskLevel: null })

  const levelAsNumber: number = report.clinicalOverview.overallCompetencyLevel
  assert.ok(!Number.isFinite(levelAsNumber) || report.subjectBreakdown.length === 0,
    'sanity check: this fixture genuinely has zero subject evidence')

  const blob = await generateAcademicClinicPDF(report)
  const buf = Buffer.from(await blob.arrayBuffer())
  assert.ok(buf.length > 500, 'expected a non-empty PDF buffer even with zero evidence')
})

// ── Pilot Gate Fix (zero-evidence pathway & career fabrication, 2026-08-25) ──
//
// The one named-unresolved P1 from the Pilot Artifact Acceptance phase: a
// zero-evidence learner's Learner Intelligence Report still showed a
// confident "RECOMMENDED" pathway and specific career families. Root cause
// was the canonical Junior pathway calculator (lib/pathwayCalculator.ts
// calculateJuniorPathwayAffinity) silently falling through a NaN-based gate
// check into the Social Sciences branch for an empty `scores` object,
// combined with several presentation fallbacks (`?? 'STEM'`, `co
// .clinicalParagraph`, `!cascade`) that assumed "no pathwayAnalysis" could
// only mean "still loading," never "genuinely no evidence."

test('calculateJuniorPathwayAffinity({}) reports insufficientEvidence, not a fabricated Social Sciences recommendation', () => {
  const pr = calculateJuniorPathwayAffinity({})
  assert.equal(pr.insufficientEvidence, true,
    'zero usable evidence must be flagged explicitly, not silently defaulted into a real pathway')
  assert.equal(pr.top_pathway, 'Insufficient Evidence',
    'top_pathway must never be one of the three real pathway names when there is no evidence behind it')
  assert.deepEqual(pr.strengths, [])
  assert.deepEqual(pr.development_areas, [])
})

test('calculateJuniorPathwayAffinity treats a real Level 1 score as usable evidence, not absence', () => {
  // CBC levels are 1-4 — there is no legitimate "0" score. Level 1 ("Below
  // Expectation") is the lowest REAL score and must never be treated the
  // same as no evidence at all, even though it is numerically close to the
  // sentinel `0` used internally for "subject not supplied."
  const pr = calculateJuniorPathwayAffinity({
    mathematics: 1, english: 1, kiswahili: 1, integrated_science: 1,
    social_studies: 1, creative_arts_sports: 1,
  })
  assert.equal(pr.insufficientEvidence, false,
    'a learner who scored the lowest real CBC level on every subject still has usable evidence')
  assert.notEqual(pr.top_pathway, 'Insufficient Evidence')
})

test('a genuinely single-subject assessment is not collapsed into zero-evidence behaviour', () => {
  // One valid teacher-confirmed assessment (even a single subject) must
  // still produce a real pathway signal — the fix must not regress "one
  // assessment" into "no assessment."
  const pr = calculateJuniorPathwayAffinity({ mathematics: 3 })
  assert.equal(pr.insufficientEvidence, false)
  assert.notEqual(pr.top_pathway, 'Insufficient Evidence')
})

test('rich evidence that already qualifies for STEM is unaffected by the zero-evidence guard', () => {
  const scores = {
    mathematics: 4, english: 3, kiswahili: 3, integrated_science: 4,
    social_studies: 3, creative_arts_sports: 2, pre_technical_studies: 3, agriculture_nutrition: 3,
  }
  const pr = calculateJuniorPathwayAffinity(scores)
  assert.equal(pr.insufficientEvidence, false)
  assert.equal(pr.top_pathway, 'STEM')
})

test('generateJuniorGuidance([]) reports insufficientEvidence instead of a fabricated "NaN/4.0" pathway', () => {
  const guidance = generateJuniorGuidance([])
  assert.equal(guidance.insufficientEvidence, true)
  assert.equal(guidance.recommendedPathway, 'Insufficient Evidence')
  assert.doesNotMatch(guidance.reasoning, /NaN/,
    'the old NaN-comparison fallback produced "With an average of NaN/4.0, the Arts & Sports Science pathway is recommended..."')
})

test('generateJuniorGuidance with real subjects is unaffected (insufficientEvidence is false, no NaN)', () => {
  const subjects = buildSubjectProgress({ mathematics: 3, english: 3, kiswahili: 3, integrated_science: 4 })
  const guidance = generateJuniorGuidance(subjects)
  assert.equal(guidance.insufficientEvidence, false)
  assert.notEqual(guidance.recommendedPathway, 'Insufficient Evidence')
  assert.doesNotMatch(guidance.reasoning, /NaN/)
})

function buildZeroEvidenceJuniorReport(grade: 7 | 8 | 9) {
  const subjectProgress: SubjectProgress[] = []
  const vitals = calculateVitals(subjectProgress)
  const actionPlan = generateActionPlan(subjectProgress)
  const studentProfile: StudentProfile = {
    id: 'TEST', name: 'Zero Evidence Learner', grade, level: 'Junior School', term: 1, year: 2026, pathway: null, school: 'Test School',
  }
  const juniorGuidance = generateJuniorGuidance(subjectProgress)
  return generateReport(studentProfile, subjectProgress, vitals, actionPlan, [], juniorGuidance, undefined, undefined, [], { trend: null, riskLevel: null })
}

test('zero-evidence Junior report never produces a confident pathwayAnalysis (Grade 7)', () => {
  const report = buildZeroEvidenceJuniorReport(7)
  assert.ok(report.pathwayAnalysis, 'pathwayAnalysis should still exist as an honest placeholder object')
  assert.equal(report.pathwayAnalysis!.insufficientEvidence, true)
  assert.equal(report.pathwayReadinessCards, undefined,
    'no pathway readiness cards (and therefore no "RECOMMENDED" badge) should be built from zero evidence')
  assert.equal(report.juniorImprovementCascade, null)
  assert.equal(report.juniorActionPriorities, undefined)
  assert.equal(report.parentAction, undefined)
})

test('zero-evidence Junior report is safe across Grade 7, 8, and 9 (cross-stage check)', () => {
  for (const grade of [7, 8, 9] as const) {
    const report = buildZeroEvidenceJuniorReport(grade)
    assert.equal(report.pathwayAnalysis!.insufficientEvidence, true, `grade ${grade}`)
    assert.equal(report.pathwayReadinessCards, undefined, `grade ${grade}`)
  }
})

test('zero-evidence Junior PDF still generates and never fabricates a RECOMMENDED pathway or career families', async () => {
  const report = buildZeroEvidenceJuniorReport(7)
  const blob = await generateAcademicClinicPDF(report)
  const buf = Buffer.from(await blob.arrayBuffer())
  assert.ok(buf.length > 500, 'expected a non-empty PDF buffer even with zero evidence')
})

test('renderer never falls back to a hardcoded STEM pathway when pathwayAnalysis is absent or insufficient', () => {
  // Regression guard for the exact fabrication line: `pa?.recommendedPathway
  // ?? 'STEM'` used to silently pick STEM (and therefore list STEM career
  // families) whenever there was no real pathwayAnalysis at all.
  assert.doesNotMatch(renderedTextOnly(RENDERER_SOURCE), /recommendedPathway\s*\?\?\s*'STEM'/,
    'a hardcoded STEM fallback fabricates a specific pathway/career-family claim from no evidence')
})

test('Senior zero-evidence career guidance (via the canonical adapter) produces no evidence-backed career families', () => {
  const canonical: CanonicalCareerMatches = { matches: [], mode: 'planning', insufficientEvidence: true, generatedAt: null }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, [], 'Learner', 10)
  assert.deepEqual(guidance.topCareers, [])
  assert.doesNotMatch(guidance.honestAssessment ?? '', /STRONG|GOOD match/i)
})

test('buildSeniorReadinessIndicators([]) reports insufficientEvidence instead of a fabricated "NaN%" pathway readiness score', () => {
  const indicators = buildSeniorReadinessIndicators([], 'STEM', 'STABLE', 'Grace')
  assert.equal(indicators.insufficientEvidence, true)
  assert.equal(indicators.pathwayReadinessScore, 0)
  assert.ok(Number.isFinite(indicators.pathwayReadinessScore), 'must never be NaN')
  assert.doesNotMatch(indicators.careerReadinessDetail, /STEM career access requires/,
    'the old fallback text asserted a specific pathway\'s career-access judgment from zero evidence')
})

test('buildSeniorReadinessIndicators with real subjects is unaffected (insufficientEvidence is false, no NaN)', () => {
  const subjects = buildSubjectProgress({ core_mathematics: 4, english: 3, biology: 4, chemistry: 4 })
  const indicators = buildSeniorReadinessIndicators(subjects, 'STEM', 'IMPROVING', 'Cynthia')
  assert.equal(indicators.insufficientEvidence, false)
  assert.ok(Number.isFinite(indicators.pathwayReadinessScore))
})

test('unconfirmed (insufficient-evidence-flagged) Senior evidence still respects the existing review policy', () => {
  // Mirrors the zero-evidence case deliberately: resolveCanonicalCareerMatches
  // sets insufficientEvidence when the underlying intelligence engine has a
  // `notice` (e.g. nothing confirmed yet) — this adapter must not try to
  // second-guess that upstream review-state decision by inventing matches.
  const canonical: CanonicalCareerMatches = { matches: [], mode: 'exploration', insufficientEvidence: true, generatedAt: null }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, [], 'Learner', 11)
  assert.equal(guidance.topCareers.length, 0)
})

// ── Functional regression: compass reason honesty (the MET-vs-gap contradiction) ──
//
// A pathway readiness card can already show a subject as MET (current level
// >= required level) while buildJuniorActionPriorities still recommends it
// as a *growth* target (e.g. Level 3 -> Level 4). Before this fix, the
// Learning Compass "Reason" text always used the same static "preventing
// eligibility" language regardless — directly contradicting a MET status
// shown two paragraphs earlier in the same report. getCompassReason's
// `isGap` flag keeps these in sync.

test('a growth-target priority (subject already meets pathway requirement) gets honest, non-contradictory reasoning', () => {
  const metCard: PathwayReadinessCard = {
    pathway: 'STEM', score: 100, statusLabel: 'Strongly Ready', statusColor: '#16a34a',
    diagnosis: 'All key STEM requirements are met.',
    gapRows: [
      { subjectKey: 'mathematics', displayName: 'Mathematics', currentLevel: 3, requiredLevel: 3, gap: 0, status: 'met' },
    ],
  }
  const subjects = buildSubjectProgress({ mathematics: 3, english: 4, kiswahili: 3 })
  const priorities = buildJuniorActionPriorities(subjects, [metCard], 'STEM')

  const mathPriority = priorities.find(p => p.subject === 'Mathematics')
  assert.ok(mathPriority, 'expected Mathematics to appear as a growth-target priority')
  assert.doesNotMatch(mathPriority!.compassReason, /preventing/i,
    'Mathematics is already MET for STEM — the reason text must not claim it is "preventing eligibility"')
})

// ── Regression guard: honest page-count claim ───────────────────────────────
//
// The authored layout targets 3 logical pages, but page 3's content can
// overflow onto an auto-generated physical page in @react-pdf — a static
// "Page X of 3" then lies to the reader. Guard that the header uses
// react-pdf's dynamic render prop (true physical pageNumber/totalPages)
// rather than a hardcoded total.

test('page header uses dynamic (true) page numbering, not a hardcoded total', () => {
  assert.match(RENDERER_SOURCE, /render=\{\(\{ pageNumber, totalPages: actualTotal \}\) => `Page \$\{pageNumber\} of \$\{actualTotal\}`\}/,
    'the header must report the true rendered pageNumber/totalPages — a hardcoded "of 3" becomes false whenever page 3 overflows to a physical 4th page')
})
