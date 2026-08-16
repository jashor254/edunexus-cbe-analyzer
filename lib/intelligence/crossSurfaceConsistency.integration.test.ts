// lib/intelligence/crossSurfaceConsistency.integration.test.ts
//
// H2C — Blueprint, Compass and Career Intelligence may interpret one
// learner's evidence differently for their own purposes, but they may not
// silently contradict the same canonical fact. Every test below builds ONE
// learner history through the real evidence pipeline, computes ONE real
// Projection, then interrogates the real, unmodified composer/resolver
// functions each surface actually uses in production — no prose, only
// structured deterministic state (levels, trends, enums).
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/intelligence/crossSurfaceConsistency.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { composeAcademicRecord } from '@/lib/learnerBlueprint/composeAcademicRecord'
import { extractCapabilityProfile, computeCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'
import { resolveCompassAcademicLevel, readCompassAcademicProjection } from '@/lib/compass/learnerContext'
import { asStudentId } from '@/lib/core/identityTypes'
import {
  CANONICAL_MARKER,
  canonicalMathHistory,
  canonicalMathPastTerms,
  canonicalCurrentTermReportCard,
  canonicalEnglishHistory,
  contradictoryMathHistory,
} from '@/lib/testing/canonicalLearnerFixture'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const db = createServiceClient()
const NO_LEGACY_FALLBACK = { subjectTiers: {}, overallLevel: null, sessionLevel: null, clientHint: null }

let initiatedByUserId: string
const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []
const createdAssessmentIds: string[] = []

before(async () => {
  const email = `${CANONICAL_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id
})

after(async () => {
  if (createdAssessmentIds.length) await db.from('assessments').delete().in('id', createdAssessmentIds)
  if (createdStudentIds.length) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', createdStudentIds)
    const evidenceIds = (evidenceRows ?? []).map(r => r.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('learner_projections').delete().in('learner_id', createdStudentIds)
    await db.from('students').delete().in('id', createdStudentIds)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function makeStudent(label: string): Promise<string> {
  const { data, error } = await db.from('students').insert({ name: `${CANONICAL_MARKER} ${label}`, grade: 9 }).select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  createdStudentIds.push(data.id)
  return data.id
}

// A single bulk INSERT shares one Postgres statement-level NOW(), so
// multiple rows meant to represent DIFFERENT points in time (e.g. Term 1
// vs Term 3) can tie on `created_at` — Projection's chronological ordering
// then falls back to `id` (UUID) as its secondary sort key, which is
// unrelated to intended term order. Seeding one evidence item per call
// (sequential, awaited) guarantees strictly increasing `created_at`,
// matching how real ingestion actually happens over time.
async function seed(evidence: LearnerEvidence[]): Promise<string[]> {
  const ids: string[] = []
  for (const item of evidence) {
    const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
    createdIngestionRunIds.push(run.id)
    const result = await persistEvidenceBatch([item], run.id)
    ids.push(...result.inserted.map(r => r.id))
  }
  return ids
}

// For evidence rows deliberately meant to represent the SAME real-world
// moment (e.g. one report card covering several subjects at once) — one
// batch call, one shared timestamp. See canonicalLearnerFixture.ts's
// ordering note for why this must never be used for a single subject's
// own multi-term history.
async function seedBatch(evidence: LearnerEvidence[]): Promise<string[]> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  return result.inserted.map(r => r.id)
}

async function careerCapabilityFor(studentId: string) {
  const projection = await recomputeLearnerProjection(studentId)
  const scoreHistory = projectionToScoreHistory(projection)
  return { projection, profile: scoreHistory.length > 0 ? extractCapabilityProfile(scoreHistory) : null }
}

async function compassLevelFor(studentId: string, subject: string) {
  const { academic, confidence, freshnessDays } = await readCompassAcademicProjection(studentId)
  return resolveCompassAcademicLevel({ academic, academicConfidence: confidence, academicFreshnessDays: freshnessDays, subject, legacy: NO_LEGACY_FALLBACK })
}

// ── INTEL-001 / INTEL-002 — gap and strength consistency, one shared Projection ──

test('INTEL-001/002: Blueprint, Compass and Career agree Mathematics is not yet a strength while English is, from one shared canonical history', async () => {
  const studentId = await makeStudent('gap-vs-strength')
  await seed(canonicalMathPastTerms(studentId))          // Math Terms 1-2 (persistent gap), sequential for real trend ordering
  await seedBatch(canonicalCurrentTermReportCard(studentId)) // Term 3 report card: Math/English/Science together, one moment

  const { profile: careerProfile } = await careerCapabilityFor(studentId)
  const blueprint = await composeAcademicRecord(asStudentId(studentId))
  const compassMath = await compassLevelFor(studentId, 'mathematics')
  const compassEnglish = await compassLevelFor(studentId, 'english')

  assert.ok(careerProfile)
  assert.equal(blueprint.status, 'available')
  const bpMath = blueprint.data!.bySubject.find(s => s.subject === 'mathematics')!
  const bpEnglish = blueprint.data!.bySubject.find(s => s.subject === 'english')!

  // INTEL-002 — English: all three surfaces agree it is at ceiling strength.
  assert.equal(bpEnglish.latestLevel, 4)
  assert.equal(compassEnglish.level, 4)
  assert.equal(careerProfile!.communication.level, 'exceptional')

  // INTEL-001 — Mathematics: none of the three treats it as an established
  // strength — every surface's Math signal must read strictly weaker than
  // its own English signal, using each surface's own structured scale.
  assert.equal(bpMath.latestLevel, 3)
  assert.ok(bpMath.latestLevel < bpEnglish.latestLevel, 'Blueprint: Math must not outrank English')
  assert.equal(compassMath.level, 3)
  assert.ok(compassMath.level < compassEnglish.level, 'Compass: Math must not outrank English')
  assert.notEqual(careerProfile!.analytical_reasoning.level, 'exceptional')
  assert.notEqual(careerProfile!.analytical_reasoning.level, careerProfile!.communication.level, 'Career: Math\'s capability level must not match English\'s ceiling level')

  // Section 9 — improving must never be confused with strength. Math is
  // simultaneously "not yet a strength" (current level 3) AND genuinely
  // improving (Projection's own trend, which Blueprint surfaces directly)
  // — both true at once, no contradiction.
  assert.equal(bpMath.trend, 'improving', 'the persistent-gap-then-improvement history must read as improving, not as a fabricated strength')
})

// ── INTEL-003 — admissibility consistency across all three surfaces ─────────

test('INTEL-003: evidence excluded from canonical Projection does not re-enter through Blueprint, Compass or Career via any alternate read', async () => {
  const studentId = await makeStudent('admissibility')
  await seed(canonicalMathHistory(studentId)) // real: 1, 1, 3

  // A dramatic decoy that, if it leaked through any surface's own read path,
  // would be unmistakable — inserted then immediately retracted.
  const [decoyId] = await seed([{
    learnerId: studentId, extractedName: CANONICAL_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 100, cbcLevel: 4,
    assessmentType: 'cat', term: 3, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h2c_decoy_v1', reviewStatus: 'auto_confirmed',
    rawInputRef: 'test', importedAt: '2026-06-01T00:00:00Z', issues: [],
  }])
  await retractEvidence(decoyId, initiatedByUserId, 'test: INTEL-003 decoy must not influence any surface')

  const { profile: careerProfile } = await careerCapabilityFor(studentId)
  const blueprint = await composeAcademicRecord(asStudentId(studentId))
  const compassMath = await compassLevelFor(studentId, 'mathematics')
  const bpMath = blueprint.data!.bySubject.find(s => s.subject === 'mathematics')!

  // All three must reflect ONLY the real (level 3) evidence, never the
  // retracted decoy's level 4.
  assert.equal(bpMath.latestLevel, 3, 'Blueprint must not surface the retracted decoy')
  assert.equal(compassMath.level, 3, 'Compass must not surface the retracted decoy')
  assert.notEqual(careerProfile!.analytical_reasoning.level, 'exceptional', 'Career must not read the retracted decoy as exceptional Math capability')
})

// ── INTEL-004 — identity consistency across all three surfaces ──────────────

test('INTEL-004: Blueprint, Compass and Career all resolve the same canonical identity — no B-derived fact ever appears in A', async () => {
  const learnerA = await makeStudent('identity-a-strong')
  const learnerB = await makeStudent('identity-b-weak')

  await seed(canonicalEnglishHistory(learnerA)) // Level 4 throughout
  await seed([{
    learnerId: learnerB, extractedName: CANONICAL_MARKER, extractedExternalId: null,
    subject: 'english', rawSubject: 'English', score: 25, cbcLevel: 1,
    assessmentType: 'cat', term: 3, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h2c_identity_v1', reviewStatus: 'auto_confirmed',
    rawInputRef: 'test', importedAt: '2026-06-01T00:00:00Z', issues: [],
  }])

  const blueprintA = await composeAcademicRecord(asStudentId(learnerA))
  const blueprintB = await composeAcademicRecord(asStudentId(learnerB))
  const { profile: careerA } = await careerCapabilityFor(learnerA)
  const { profile: careerB } = await careerCapabilityFor(learnerB)
  const compassA = await compassLevelFor(learnerA, 'english')
  const compassB = await compassLevelFor(learnerB, 'english')

  assert.equal(blueprintA.data!.bySubject.find(s => s.subject === 'english')!.latestLevel, 4)
  assert.equal(blueprintB.data!.bySubject.find(s => s.subject === 'english')!.latestLevel, 1)
  assert.equal(careerA!.communication.level, 'exceptional')
  assert.equal(careerB!.communication.level, 'emerging')
  assert.equal(compassA.level, 4)
  assert.equal(compassB.level, 1)
})

// ── INTEL-LEGACY-001 — the legacy assessments-table capability path can disagree with the canonical Projection-based path ──

test('INTEL-LEGACY-001 FINDING: computeCapabilityProfile() (legacy assessments table) and the Projection-based capability path can disagree for the same learner', async () => {
  const studentId = await makeStudent('legacy-divergence')

  // Real, confirmed, admissible Evidence Domain signal: a genuine Level 1
  // (weak) Mathematics mark.
  await seed(canonicalMathHistory(studentId).slice(0, 1)) // Term 1 only: Level 1

  // Separately, a legacy `assessments` row (the table user-facing surfaces
  // like Monday Panel / Attention Feed read via learner_profiles.
  // capability_dimensions, written by lib/learnerModel/updater.ts's
  // computeCapabilityProfile() call) — no admissibility concept exists on
  // this table (H2B finding A), so this row is permanently admissible input
  // to the legacy path regardless of what the Evidence Domain says.
  const { data: assessmentRow, error } = await db.from('assessments').insert({
    student_id: studentId, term: 1, year: 2026, grade: 9,
    subject_scores: { mathematics: 4 }, // deliberately the opposite of the real evidence above
  }).select('id').single()
  if (error || !assessmentRow) throw new Error(`assessment seed failed: ${error?.message}`)
  createdAssessmentIds.push(assessmentRow.id)

  const legacyProfile = await computeCapabilityProfile(studentId)
  const { profile: canonicalProfile } = await careerCapabilityFor(studentId)

  assert.ok(legacyProfile && canonicalProfile)
  // FINDING, not a fix: the two capability paths read two different tables
  // with two different admissibility rules and can produce materially
  // different results for the identical learner at the identical moment —
  // see the H2C closeout report's Legacy Path Decision Packet.
  assert.notEqual(
    legacyProfile!.analytical_reasoning.level,
    canonicalProfile!.analytical_reasoning.level,
    'this assertion pins the actual current divergence — legacy (assessments table, level 4 input) vs canonical (Evidence Domain, level 1 input) — as a real, reproducible finding, not a hypothetical'
  )
})

// ── INTEL-TREND-001 — Career's own trend algorithm can disagree with Projection's (the algorithm Blueprint surfaces) ──

test('INTEL-TREND-001 FINDING: for a 1->4->1 contradictory history, capabilityExtractor\'s detectTrend() and Projection\'s computeTrend() disagree', async () => {
  const studentId = await makeStudent('trend-divergence')
  await seed(contradictoryMathHistory(studentId)) // 1, 4, 1 — ends exactly where it started

  const blueprint = await composeAcademicRecord(asStudentId(studentId))
  const { profile: careerProfile } = await careerCapabilityFor(studentId)
  const bpMath = blueprint.data!.bySubject.find(s => s.subject === 'mathematics')!

  // Projection's computeTrend() (lib/projection/academicProjector.ts) is a
  // simple first-vs-last comparison: 1 -> 1 is 'stable'. Blueprint surfaces
  // this value directly — no reinterpretation of its own.
  assert.equal(bpMath.trend, 'stable', 'Projection/Blueprint: a history that ends exactly where it started is stable, not a trend')

  // capabilityExtractor's detectTrend() (H2B finding) instead compares
  // first-half vs second-half AVERAGE — the interim spike drags the second
  // half above the first, so the identical evidence reads as 'accelerating'
  // through Career's own, separate trend algorithm.
  assert.equal(careerProfile!.analytical_reasoning.trend, 'accelerating', 'Career: the same evidence, through a different algorithm, currently reads as accelerating')

  // The disagreement itself, pinned explicitly: this is a real
  // ALGORITHM DIVERGENCE between two independently-implemented trend
  // functions over identical input, not a difference in purpose. See the
  // H2C closeout report's detectTrend Decision Packet — not fixed here.
  assert.notEqual(bpMath.trend, careerProfile!.analytical_reasoning.trend)
})
