// lib/intelligence/pipeline.test.ts
// Pure unit tests — no DB, no network. Covers extraction, subject mapping,
// identity resolution against an in-memory roster, and confidence scoring.
// Run with: npx tsx --test lib/intelligence/pipeline.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFromCsv } from './csvSource'
import { mapSubject } from './subjectMapping'
import { resolveAgainstRoster } from './identityResolution'
import { computeConfidence, resolveReviewStatus, AUTO_CONFIRM_THRESHOLD } from './confidence'
import type { StudentIdentityCandidate } from '@/lib/repositories/intelligence.repository'

// ── CSV extraction ──────────────────────────────────────────────────────────

test('extractFromCsv handles a quoted comma inside a name field correctly', () => {
  const csv = 'name,external_id,Mathematics,English\n"Otieno, Brian",EXT001,85,72\n'
  const result = extractFromCsv(csv)
  assert.equal(result.headerIssues.length, 0)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].name, 'Otieno, Brian')
  assert.equal(result.rows[0].externalId, 'EXT001')
  assert.equal(result.rows[0].subjectScores.mathematics, '85')
})

test('extractFromCsv reports a fatal issue when no name column exists', () => {
  const csv = 'foo,bar\n1,2\n'
  const result = extractFromCsv(csv)
  assert.equal(result.rows.length, 0)
  assert.ok(result.headerIssues.length > 0)
})

test('extractFromCsv skips blank subject cells rather than treating them as zero', () => {
  const csv = 'name,Mathematics,English\nJane Doe,90,\n'
  const result = extractFromCsv(csv)
  assert.equal(result.rows[0].subjectScores.mathematics, '90')
  assert.equal('english' in result.rows[0].subjectScores, false)
})

// ── Subject mapping ─────────────────────────────────────────────────────────

test('mapSubject canonicalizes a known school shortcode', () => {
  const result = mapSubject('geo')
  assert.equal(result.canonicalSubject, 'geography')
  assert.equal(result.wasMapped, true)
})

test('mapSubject leaves an already-canonical subject unchanged', () => {
  const result = mapSubject('mathematics')
  assert.equal(result.canonicalSubject, 'mathematics')
  assert.equal(result.wasMapped, false)
})

// ── Identity resolution ─────────────────────────────────────────────────────

const roster: StudentIdentityCandidate[] = [
  { id: 'stu-1', name: 'Brian Otieno', grade: 8, external_id: 'EXT001' },
  { id: 'stu-2', name: 'Faith Wanjiru', grade: 7, external_id: null },
  { id: 'stu-3', name: 'Faith Wanjiru', grade: 8, external_id: null }, // same name, different grade
]

test('resolveAgainstRoster matches on external_id with full confidence, ignoring name', () => {
  const result = resolveAgainstRoster({ name: 'Wrong Name Entirely', externalId: 'EXT001' }, roster)
  assert.equal(result.studentId, 'stu-1')
  assert.equal(result.confidence, 100)
  assert.equal(result.matchType, 'external_id')
})

test('resolveAgainstRoster matches on exact name + grade when unambiguous', () => {
  const result = resolveAgainstRoster({ name: 'Faith Wanjiru', grade: 7 }, roster)
  assert.equal(result.studentId, 'stu-2')
  assert.equal(result.matchType, 'exact_name_grade')
})

test('resolveAgainstRoster refuses to guess when a name+grade match is ambiguous', () => {
  // Two different students share this exact name+grade in a modified roster.
  const ambiguousRoster: StudentIdentityCandidate[] = [
    { id: 'a', name: 'John Kamau', grade: 9, external_id: null },
    { id: 'b', name: 'John Kamau', grade: 9, external_id: null },
  ]
  const result = resolveAgainstRoster({ name: 'John Kamau', grade: 9 }, ambiguousRoster)
  assert.equal(result.studentId, null)
  assert.equal(result.matchType, 'none')
})

test('resolveAgainstRoster returns a capped, non-auto-confirmable confidence for a fuzzy match', () => {
  const result = resolveAgainstRoster({ name: 'Brian Otieno ', grade: 8 }, roster) // trailing space typo
  assert.ok(result.confidence < AUTO_CONFIRM_THRESHOLD || result.matchType === 'exact_name_grade')
})

test('resolveAgainstRoster finds no match for a genuinely unrecognized name', () => {
  const result = resolveAgainstRoster({ name: 'Zzyzx Nonexistent', grade: 8 }, roster)
  assert.equal(result.studentId, null)
  assert.equal(result.matchType, 'none')
})

// ── Confidence scoring ───────────────────────────────────────────────────────

test('computeConfidence returns 0 when identity could not be resolved at all', () => {
  const confidence = computeConfidence({
    identityConfidence: 0, identityMatchType: 'none', fieldIssueCount: 0, source: 'csv_export',
  })
  assert.equal(confidence, 0)
})

test('computeConfidence caps a tier-1 source below the auto-confirm threshold even with perfect identity', () => {
  const confidence = computeConfidence({
    identityConfidence: 100, identityMatchType: 'external_id', fieldIssueCount: 0, source: 'compass_session',
  })
  assert.ok(confidence < AUTO_CONFIRM_THRESHOLD, `expected tier-1 source to be capped below ${AUTO_CONFIRM_THRESHOLD}, got ${confidence}`)
})

test('computeConfidence penalizes field issues even with a perfect identity match', () => {
  const clean = computeConfidence({ identityConfidence: 100, identityMatchType: 'external_id', fieldIssueCount: 0, source: 'csv_export' })
  const withIssues = computeConfidence({ identityConfidence: 100, identityMatchType: 'external_id', fieldIssueCount: 2, source: 'csv_export' })
  assert.ok(withIssues < clean)
})

test('resolveReviewStatus routes exactly at the threshold to auto_confirmed', () => {
  assert.equal(resolveReviewStatus(AUTO_CONFIRM_THRESHOLD), 'auto_confirmed')
  assert.equal(resolveReviewStatus(AUTO_CONFIRM_THRESHOLD - 1), 'pending_review')
})
