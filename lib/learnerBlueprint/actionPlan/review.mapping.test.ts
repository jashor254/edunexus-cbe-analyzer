// lib/learnerBlueprint/actionPlan/review.mapping.test.ts
//
// Pure unit tests for the review service's deterministic summarization
// helpers (Phase 2D) — no database, no auth. Proves the "system
// summarizes, teacher concludes" boundary at the smallest possible level:
// these functions only ever render/compare data already handed to them,
// never invent a verdict.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { summarizeAssignment, summarizeLatestEvidence, deriveProjectionTrend } from './review'
import type { TimelineEntry } from '@/lib/learnerRecord/timeline'
import type { ProjectionRow } from '@/lib/repositories/projection.repository'
import type { BlueprintActionReviewRow } from '@/lib/repositories/blueprintActionReview.repository'

// ── summarizeAssignment ─────────────────────────────────────────────────────

test('summarizeAssignment: no roster produces "no_roster", not "completed"', () => {
  const result = summarizeAssignment('a1', 'active', { total: 0, pending: 0, submitted: 0, marked: 0, averageScore: null })
  assert.equal(result.delivered, true)
  if (result.delivered) assert.equal(result.completionLabel, 'no_roster')
})

test('summarizeAssignment: nobody has submitted yet -> "not_started"', () => {
  const result = summarizeAssignment('a1', 'active', { total: 5, pending: 5, submitted: 0, marked: 0, averageScore: null })
  if (result.delivered) assert.equal(result.completionLabel, 'not_started')
})

test('summarizeAssignment: some submitted, none marked -> "in_progress"', () => {
  const result = summarizeAssignment('a1', 'active', { total: 5, pending: 2, submitted: 3, marked: 0, averageScore: null })
  if (result.delivered) assert.equal(result.completionLabel, 'in_progress')
})

test('summarizeAssignment: every submission marked -> "completed"', () => {
  const result = summarizeAssignment('a1', 'active', { total: 5, pending: 0, submitted: 0, marked: 5, averageScore: 78 })
  if (result.delivered) assert.equal(result.completionLabel, 'completed')
})

test('summarizeAssignment: partially marked (some submitted, not all marked) -> "in_progress", never "completed"', () => {
  const result = summarizeAssignment('a1', 'active', { total: 5, pending: 0, submitted: 2, marked: 3, averageScore: 80 })
  if (result.delivered) assert.equal(result.completionLabel, 'in_progress')
})

// ── summarizeLatestEvidence ─────────────────────────────────────────────────

function evidenceEntry(overrides: Partial<Extract<TimelineEntry, { kind: 'evidence' }>> = {}): TimelineEntry {
  return {
    kind: 'evidence',
    date: '2026-07-01T00:00:00Z',
    evidenceId: 'e1',
    evidenceSource: 'quiz_auto_grade',
    subject: 'Mathematics',
    score: 72,
    cbcLevel: 3,
    body: null,
    lifecycleState: 'confirmed',
    ...overrides,
  }
}

test('summarizeLatestEvidence: empty timeline -> zero count, null summary', () => {
  const result = summarizeLatestEvidence([])
  assert.equal(result.count, 0)
  assert.equal(result.latestAt, null)
  assert.equal(result.latestSummary, null)
})

test('summarizeLatestEvidence: picks the LAST entry (timeline is oldest-first), not the first', () => {
  const older = evidenceEntry({ date: '2026-06-01T00:00:00Z', subject: 'Older subject', score: 10 })
  const newer = evidenceEntry({ date: '2026-07-15T00:00:00Z', subject: 'Newer subject', score: 90 })
  const result = summarizeLatestEvidence([older, newer])
  assert.equal(result.count, 2)
  assert.equal(result.latestAt, '2026-07-15T00:00:00Z')
  assert.match(result.latestSummary!, /Newer subject/)
})

test('summarizeLatestEvidence: ignores promotion entries when counting/summarizing evidence', () => {
  const promotion: TimelineEntry = { kind: 'promotion', date: '2026-07-20T00:00:00Z', promotionId: 'p1', fromGrade: 7, toGrade: 8, academicYear: '2026', notes: null }
  const evidence = evidenceEntry({ date: '2026-07-01T00:00:00Z' })
  const result = summarizeLatestEvidence([evidence, promotion])
  assert.equal(result.count, 1)
  assert.equal(result.latestAt, '2026-07-01T00:00:00Z')
})

// ── deriveProjectionTrend ───────────────────────────────────────────────────

function projectionRow(overrides: Partial<ProjectionRow> = {}): ProjectionRow {
  return {
    id: 'p1', learner_id: 'l1', projector_type: 'capability', projection_version: '1',
    value: {}, supporting_evidence_ids: [], confidence: 50, evidence_count: 3, evidence_diversity: 1,
    latest_evidence_at: null, oldest_evidence_at: null, coverage: null, freshness_days: 2, last_computed: '2026-07-20T00:00:00Z',
    ...overrides,
  }
}

function reviewRow(overrides: Partial<BlueprintActionReviewRow> = {}): BlueprintActionReviewRow {
  return {
    id: 'r1', learner_id: 'l1', school_id: 's1', blueprint_action_item_id: 'a1',
    decision: 'no_decision', notes: null,
    assignment_snapshot: null, compass_snapshot: null, evidence_snapshot: null, projection_snapshot: null,
    reviewed_by: null, created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z',
    ...overrides,
  }
}

test('deriveProjectionTrend: no current projection -> "no_projection"', () => {
  assert.equal(deriveProjectionTrend([], [], []), 'no_projection')
})

test('deriveProjectionTrend: current projection exists, no prior review -> "no_prior_review"', () => {
  const rows = [projectionRow()]
  const entries = rows.map(r => ({ projectorType: r.projector_type, confidence: r.confidence, freshnessDays: r.freshness_days, lastComputed: r.last_computed }))
  assert.equal(deriveProjectionTrend(entries, rows, []), 'no_prior_review')
})

test('deriveProjectionTrend: confidence went up since the prior review -> "increased"', () => {
  const rows = [projectionRow({ confidence: 70 })]
  const entries = rows.map(r => ({ projectorType: r.projector_type, confidence: r.confidence, freshnessDays: r.freshness_days, lastComputed: r.last_computed }))
  const prior = reviewRow({ projection_snapshot: { projections: [{ projectorType: 'capability', confidence: 50, freshnessDays: 5, lastComputed: '2026-07-01T00:00:00Z' }] } })
  assert.equal(deriveProjectionTrend(entries, rows, [prior]), 'increased')
})

test('deriveProjectionTrend: confidence went down since the prior review -> "decreased"', () => {
  const rows = [projectionRow({ confidence: 30 })]
  const entries = rows.map(r => ({ projectorType: r.projector_type, confidence: r.confidence, freshnessDays: r.freshness_days, lastComputed: r.last_computed }))
  const prior = reviewRow({ projection_snapshot: { projections: [{ projectorType: 'capability', confidence: 50, freshnessDays: 5, lastComputed: '2026-07-01T00:00:00Z' }] } })
  assert.equal(deriveProjectionTrend(entries, rows, [prior]), 'decreased')
})

test('deriveProjectionTrend: unchanged confidence -> "unchanged"', () => {
  const rows = [projectionRow({ confidence: 50 })]
  const entries = rows.map(r => ({ projectorType: r.projector_type, confidence: r.confidence, freshnessDays: r.freshness_days, lastComputed: r.last_computed }))
  const prior = reviewRow({ projection_snapshot: { projections: [{ projectorType: 'capability', confidence: 50, freshnessDays: 5, lastComputed: '2026-07-01T00:00:00Z' }] } })
  assert.equal(deriveProjectionTrend(entries, rows, [prior]), 'unchanged')
})

test('deriveProjectionTrend: prior review snapshot has no matching projector type -> "no_prior_review", never a fabricated trend', () => {
  const rows = [projectionRow({ projector_type: 'capability', confidence: 50 })]
  const entries = rows.map(r => ({ projectorType: r.projector_type, confidence: r.confidence, freshnessDays: r.freshness_days, lastComputed: r.last_computed }))
  const prior = reviewRow({ projection_snapshot: { projections: [{ projectorType: 'risk', confidence: 20, freshnessDays: 5, lastComputed: '2026-07-01T00:00:00Z' }] } })
  assert.equal(deriveProjectionTrend(entries, rows, [prior]), 'no_prior_review')
})

// ── Static guardrail scan ───────────────────────────────────────────────────
// review.ts must never write to any of the systems it reads from. A live
// integration test proves this behaviorally (review.integration.test.ts);
// this static scan proves it structurally — no forbidden write call exists
// in the source at all, mirroring Phase 2B/2C's own static source-scan
// tests.

const REVIEW_SOURCE = readFileSync(join(__dirname, 'review.ts'), 'utf8')

test('static: review.ts never calls a Supabase table writer directly (.insert/.update/.upsert/.delete on any .from(...))', () => {
  const forbidden = /\.from\(['"][a-z_]+['"]\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\(/g
  const matches = REVIEW_SOURCE.match(forbidden)
  assert.equal(matches, null, `review.ts must route every write through a repository, found: ${JSON.stringify(matches)}`)
})

test('static: review.ts never imports an Evidence writer, a Projection writer, a Compass session/objective writer, or the DeepSeek client', () => {
  const importLines = REVIEW_SOURCE.split('\n').filter(line => line.trim().startsWith('import '))
  const importSource = importLines.join('\n')
  assert.doesNotMatch(importSource, /persistEvidenceBatch|confirmReview|rejectReview|retractEvidence|eraseEvidence/)
  assert.doesNotMatch(importSource, /recomputeLearnerProjection|upsertProjection/)
  assert.doesNotMatch(importSource, /setTeacherSuggestedTopic|getOrCreateSession|createSession/)
  assert.doesNotMatch(importSource, /streamDeepSeek|@\/lib\/ai\/deepseek/)
})

test('static: review.ts reads Projection only via getPersistedProjections (never imports the recomputing entry point)', () => {
  assert.match(REVIEW_SOURCE, /import\s*\{\s*getPersistedProjections\s*\}/)
  assert.doesNotMatch(REVIEW_SOURCE, /import\s*\{[^}]*\brecomputeLearnerProjection\b[^}]*\}/)
})
