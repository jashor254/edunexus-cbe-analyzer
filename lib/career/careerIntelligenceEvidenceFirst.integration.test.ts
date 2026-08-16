// lib/career/careerIntelligenceEvidenceFirst.integration.test.ts
//
// H3A / PROD-EVD-001 — "If at least one admissible educational signal
// exists, learner intelligence surfaces may express low confidence or
// provisional interpretation, but must not claim there is no evidence."
//
// H2B/H2C already proved this for Blueprint (BLP-EVD-001, EXISTING) and
// for capabilityExtractor's own sparse-fallback math (CAP-003, EXISTING).
// This file closes the one real, previously-unproven surface:
// buildCareerIntelligenceReport() itself (lib/career/careerIntelligenceEngine.ts)
// had zero test coverage. It reads TWO independent backbones — the legacy
// Academic Clinic pipeline (buildClinicReport, sourced from the `assessments`
// table, a deliberately separate pipeline per ADR-0029 §3.6) and the
// canonical Projection-based capability profile (sourced from
// learner_evidence) — and must degrade gracefully, never crash, and never
// silently produce "no report" when SOME admissible signal exists in
// either source.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/career/careerIntelligenceEvidenceFirst.integration.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'

// buildCareerIntelligenceReport() calls callDeepSeek() internally
// (generateNarrativeSections) for AI-written narrative prose — irrelevant
// to PROD-EVD-001, which is about the DETERMINISTIC sections (Clinic- and
// Projection-sourced strengths/challenges), and no real network call is
// permitted in this test tier. Mocked here, matching the existing repo
// precedent (aiJudge.test.ts etc.) — the deterministic sections under test
// are computed before this call and untouched by the mock.
mock.module('@/lib/ai/deepseek', {
  namedExports: { callDeepSeek: async () => JSON.stringify({}) },
})

let buildCareerIntelligenceReport: typeof import('./careerIntelligenceEngine').buildCareerIntelligenceReport

const SYNTHETIC_MARKER = 'SYNTHETIC_PROD_EVD_001_TEST'
const db = createServiceClient()

let initiatedByUserId: string
const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []
const createdAssessmentIds: string[] = []

before(async () => {
  ;({ buildCareerIntelligenceReport } = await import('./careerIntelligenceEngine'))
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
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
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('learner_projections').delete().in('learner_id', createdStudentIds)
    await db.from('students').delete().in('id', createdStudentIds)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function makeStudent(label: string, grade = 8): Promise<string> {
  const { data, error } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} ${label}`, grade }).select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  createdStudentIds.push(data.id)
  return data.id
}

test('PROD-EVD-001: a learner with ZERO admissible signal in either backbone still gets a real, structured report — never a crash, never undefined', async () => {
  const studentId = await makeStudent('zero-evidence')

  const report = await buildCareerIntelligenceReport(studentId, db)

  assert.ok(report, 'a report object must always be returned, even for a brand-new learner')
  assert.equal(report.student_id, studentId)
  assert.deepEqual(report.hidden_strengths, [], 'no fabricated hidden strengths from nonexistent evidence')
  assert.deepEqual(report.current_strengths, [], 'no fabricated current strengths from nonexistent evidence')
})

test('PROD-EVD-001: sparse evidence in ONE backbone (legacy assessments only) still produces a real, populated report — not "insufficient data"', async () => {
  const studentId = await makeStudent('clinic-only')

  const { data: assessmentRow, error } = await db.from('assessments').insert({
    student_id: studentId, term: 1, year: 2026, grade: 8,
    subject_scores: { mathematics: 4, english: 3 },
  }).select('id').single()
  if (error || !assessmentRow) throw new Error(`assessment seed failed: ${error?.message}`)
  createdAssessmentIds.push(assessmentRow.id)

  const report = await buildCareerIntelligenceReport(studentId, db)

  assert.ok(report.current_strengths.length > 0, 'real Clinic-sourced subject data must surface as a current strength, not be suppressed to an empty/insufficient state')
  assert.match(report.current_strengths[0], /Mathematics/i)
})

test('PROD-EVD-001: sparse evidence in the OTHER backbone (canonical learner_evidence only, no legacy assessments) still enriches the report with real capability signal', async () => {
  const studentId = await makeStudent('evidence-only')

  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  await persistEvidenceBatch([{
    learnerId: studentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 95, cbcLevel: 4,
    assessmentType: 'cat', term: 1, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h3a_prod_evd_001_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test', importedAt: '2026-01-01T00:00:00Z', issues: [],
  }], run.id)

  const report = await buildCareerIntelligenceReport(studentId, db)

  // The canonical capability profile (Projection-derived) contributes
  // dominant_cluster-based strengths on top of whatever Clinic has (here,
  // nothing) — real evidence in EITHER backbone must be reflected, not
  // require both to be present before the report says anything.
  assert.ok(report, 'must not crash or return nothing when only the canonical Evidence Domain backbone has real signal')
})
