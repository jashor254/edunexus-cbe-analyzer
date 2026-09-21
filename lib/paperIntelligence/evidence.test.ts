// lib/paperIntelligence/evidence.test.ts
//
// Mocked unit coverage for recordPaperIntelligenceEvidence — mirrors
// lib/assignments/printRoutes.pure.test.ts's mock.module pattern (mock.module
// is registered BEFORE this module (and its transitive imports of
// @/lib/repositories and @/lib/intelligence/evidenceLifecycle) is ever
// imported, so the real, eagerly-constructing repos singleton never loads
// in this process — same reason this file is NOT subject to the
// eager-service-client-construction issue that excludes
// lib/adaptiveLearning/recommend.test.ts).
//
// No real AI calls, no real DB. Proves the one invariant this producer
// exists to guarantee: every row it writes is pending_review, and it is
// architecturally impossible for it to write reviewed_confirmed directly.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/paperIntelligence/evidence.test.ts
import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { FIXTURE_SUB_STRAND_ID, FIXTURE_VALID_ANSWERS } from './__fixtures__/grade8SocialStudiesFixture'

let capturedEvidenceRows: LearnerEvidence[] = []
let persistShouldThrow = false
let failureLogCalls: Array<{ operation: string; errorCategory: string }> = []
let ingestionRunCompleted: { recordCount: number; pendingReviewCount: number; rejectedCount: number } | null = null

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      evidence: {
        createIngestionRun: async () => ({ id: 'fixture-run-id' }),
        completeIngestionRun: async (_runId: string, stats: typeof ingestionRunCompleted) => {
          ingestionRunCompleted = stats
        },
      },
    },
  },
})

mock.module('@/lib/intelligence/evidenceLifecycle', {
  namedExports: {
    persistEvidenceBatch: async (evidence: LearnerEvidence[]) => {
      capturedEvidenceRows = evidence
      if (persistShouldThrow) throw new Error('synthetic persistEvidenceBatch failure')
      return { inserted: [], confirmedCount: 0, pendingReviewCount: evidence.length, noOpCount: 0 }
    },
  },
})

let forceAutoConfirm = false

mock.module('@/lib/intelligence/confidence', {
  namedExports: {
    // Real behavior by default (tier-1 ceiling of 60, matching the real
    // lib/intelligence/confidence.ts) — only the dedicated "misconfigured"
    // test flips forceAutoConfirm to simulate that ceiling being raised.
    computeConfidence: () => (forceAutoConfirm ? 100 : 55),
    resolveReviewStatus: (confidence: number) => (confidence >= 85 ? 'auto_confirmed' : 'pending_review'),
    AUTO_CONFIRM_THRESHOLD: 85,
  },
})

mock.module('./failureLog', {
  namedExports: {
    logPaperIntelligenceFailure: async (input: { operation: string; errorCategory: string }) => {
      failureLogCalls.push(input)
    },
  },
})

let recordPaperIntelligenceEvidence: typeof import('./evidence').recordPaperIntelligenceEvidence

before(async () => {
  ;({ recordPaperIntelligenceEvidence } = await import('./evidence'))
})

function baseInput(overrides: Partial<Parameters<typeof recordPaperIntelligenceEvidence>[0]> = {}) {
  return {
    assignmentId: 'fixture-assignment',
    teacherUserId: 'fixture-teacher-user',
    studentId: 'fixture-student',
    schoolId: 'fixture-school',
    subject: 'Social Studies',
    academicYear: 2026,
    term: 2,
    imageRef: 'assignment-submissions/fixture-page-1.jpg',
    subStrandIdByRubricId: new Map([
      ['fixture-q1', FIXTURE_SUB_STRAND_ID],
      ['fixture-q2', null], // deliberately no sub-strand known for this one — must NOT be fabricated
    ]),
    answers: FIXTURE_VALID_ANSWERS,
    ...overrides,
  }
}

test('every evidence row this producer writes is pending_review', async () => {
  capturedEvidenceRows = []
  await recordPaperIntelligenceEvidence(baseInput())
  assert.equal(capturedEvidenceRows.length, 2)
  for (const row of capturedEvidenceRows) {
    assert.equal(row.reviewStatus, 'pending_review')
    assert.equal(row.evidenceSource, 'report_card_photo')
  }
})

test('sub_strand_id is preserved when known, and never fabricated when unknown', async () => {
  capturedEvidenceRows = []
  await recordPaperIntelligenceEvidence(baseInput())
  const q1 = capturedEvidenceRows.find(r => (r.payload as { rubricId?: string } | null)?.rubricId === 'fixture-q1')
  const q2 = capturedEvidenceRows.find(r => (r.payload as { rubricId?: string } | null)?.rubricId === 'fixture-q2')
  assert.equal(q1?.subStrandId, FIXTURE_SUB_STRAND_ID)
  assert.equal(q2?.subStrandId, null)
})

test('correctionKey is left null — never invented for a source with no reviewed correction namespace', async () => {
  capturedEvidenceRows = []
  await recordPaperIntelligenceEvidence(baseInput())
  for (const row of capturedEvidenceRows) assert.equal(row.correctionKey, null)
})

test('the original AI proposal (recognized answer, marks, confidences, rationale) is preserved in payload', async () => {
  capturedEvidenceRows = []
  await recordPaperIntelligenceEvidence(baseInput())
  const row = capturedEvidenceRows[0]
  const payload = row.payload as { kind: string; recognizedAnswer: string; gradingConfidence: number; provider: string }
  assert.equal(payload.kind, 'paper_intelligence_mark')
  assert.equal(payload.recognizedAnswer, FIXTURE_VALID_ANSWERS[0].recognizedAnswer)
  assert.equal(payload.gradingConfidence, FIXTURE_VALID_ANSWERS[0].gradingConfidence)
  assert.equal(payload.provider, 'gemini')
})

test('a persistEvidenceBatch failure is logged durably (Gate 6), and the function does not throw', async () => {
  persistShouldThrow = true
  failureLogCalls = []
  try {
    const result = await recordPaperIntelligenceEvidence(baseInput())
    assert.equal(result.failedWrites, 2)
  } finally {
    persistShouldThrow = false
  }
  assert.equal(failureLogCalls.length, 1)
  assert.equal(failureLogCalls[0].operation, 'evidence_write')
})

test('Gate I: even a model-reported confidence of 1.0 (maximum) still yields pending_review — the model\'s own confidence never feeds evidenceConfidence at all', async () => {
  capturedEvidenceRows = []
  const maxConfidenceAnswer = { ...FIXTURE_VALID_ANSWERS[0], recognitionConfidence: 1.0, gradingConfidence: 1.0 }
  await recordPaperIntelligenceEvidence(baseInput({ answers: [maxConfidenceAnswer] }))
  assert.equal(capturedEvidenceRows[0].reviewStatus, 'pending_review')
  // The model's self-reported confidence is preserved for audit (payload)
  // but never influences the trust decision — proving "high confidence is
  // not teacher confirmation" structurally, not by convention.
  const payload = capturedEvidenceRows[0].payload as { gradingConfidence: number }
  assert.equal(payload.gradingConfidence, 1.0)
})

test('the producer THROWS rather than write reviewed_confirmed, even if confidence scoring were ever misconfigured to allow it', async () => {
  forceAutoConfirm = true
  try {
    await assert.rejects(
      () => recordPaperIntelligenceEvidence(baseInput()),
      /must ALWAYS be pending_review/,
    )
  } finally {
    forceAutoConfirm = false
  }
})

test('the ingestion run is completed with accurate counts even on failure', async () => {
  persistShouldThrow = true
  ingestionRunCompleted = null
  try {
    await recordPaperIntelligenceEvidence(baseInput())
  } finally {
    persistShouldThrow = false
  }
  assert.ok(ingestionRunCompleted)
  assert.equal(ingestionRunCompleted!.rejectedCount, 2)
})
