// lib/attentionFeed/sources.test.ts
//
// Phase 1 / P0-C — pure + static tests for the per-learner attention
// destination. No database, no network.
//
// The bug these lock down: every per-learner AttentionItem pointed at
// `/teacher/classes/{classId}/students/{studentId}`, a route that has
// never existed (no page file, no rewrite in next.config.ts). Teacher
// Intelligence correctly identified who needed attention and then handed
// the teacher a 404. Four separate call sites had the same broken
// interpolation, which is why the replacement is a single shared helper
// and why the static scan below asserts the old shape is gone from the
// whole file rather than from one function.
//
// The authorization half of P0-C is deliberately NOT here — it belongs
// against real rows and real sessions, in
// lib/testing/teacherAttentionDestination.integration.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/attentionFeed/sources.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { mapInterventionCheckins, mapCareerMoments, mapMondayStudentRisk } from './sources'
import type { InterventionCheckin, CareerMicroMoment, ClassIntelligencePanel, StudentIntelligenceSummary } from '@/lib/learnerModel/types'

const SOURCE = readFileSync(join(__dirname, 'sources.ts'), 'utf8')
const REPO_ROOT = join(__dirname, '..', '..')

const LEGACY_STUDENT_ID = '11111111-2222-3333-4444-555555555555'
const CLASS_ID = '99999999-8888-7777-6666-555555555555'

function checkin(overrides: Partial<InterventionCheckin> = {}): InterventionCheckin {
  return {
    intervention_id: 'int-1',
    student_id: LEGACY_STUDENT_ID,
    student_name: 'Mary Test',
    substrand: 'Fractions',
    intervention_type: 'Small-group re-teach',
    days_since: 14,
    due_date: '2026-08-20',
    ...overrides,
  }
}

function moment(overrides: Partial<CareerMicroMoment> = {}): CareerMicroMoment {
  return {
    student_id: LEGACY_STUDENT_ID,
    student_name: 'Mary Test',
    moment_type: 'capability_threshold',
    message: 'Analytical capability crossed a threshold this term.',
    parent_note: 'Ask about problem-solving at home.',
    ...overrides,
  }
}

function panelRow(overrides: {
  pending_checkins?: InterventionCheckin[]
  career_moments?: CareerMicroMoment[]
  students_needing_attention?: StudentIntelligenceSummary[]
}) {
  return {
    class_id: CLASS_ID,
    panel_data: { students_needing_attention: overrides.students_needing_attention ?? [] } as ClassIntelligencePanel,
    prerequisite_alerts: [],
    pending_checkins: overrides.pending_checkins ?? [],
    career_moments: overrides.career_moments ?? [],
    teaching_patterns: [],
    generated_at: new Date().toISOString(),
  }
}

function studentSummary(overrides: Partial<StudentIntelligenceSummary> = {}): StudentIntelligenceSummary {
  return {
    student_id: LEGACY_STUDENT_ID,
    student_name: 'Mary Test',
    risk_level: 'critical',
    top_flags: [],
    action: 'Mary: fallback action text',
    ...overrides,
  }
}

// ── 1. The per-learner link no longer points at the missing route ───────────

test('1. no per-learner action link uses the /teacher/classes/{classId}/students/{studentId} shape', () => {
  assert.ok(
    !SOURCE.includes('/students/${'),
    'sources.ts still interpolates a /students/ path — that route does not exist and 404s',
  )
  assert.ok(
    !/\/teacher\/classes\/\$\{[^}]+\}\/students/.test(SOURCE),
    'sources.ts still builds a /teacher/classes/.../students/... link',
  )
})

test('1b. the intervention check-in item links to the canonical Blueprint destination', () => {
  const [item] = mapInterventionCheckins([panelRow({ pending_checkins: [checkin()] })])

  assert.equal(item.studentId, LEGACY_STUDENT_ID)
  assert.equal(item.actionLink, `/teacher/reports/blueprint/${LEGACY_STUDENT_ID}`)
  assert.ok(!item.actionLink.includes('/students/'), 'must not use the non-existent per-class student route')
})

test('1c. the career-milestone item links to the same canonical destination', () => {
  const [item] = mapCareerMoments([panelRow({ career_moments: [moment()] })])

  assert.equal(item.actionLink, `/teacher/reports/blueprint/${LEGACY_STUDENT_ID}`)
})

test('1d. the link is addressed by the LEGACY students.id the feed actually carries, not a Core learner id', () => {
  // The destination page resolves legacy -> Core itself via
  // students.external_id. Passing a Core learners.id here would silently
  // render the "unavailable" state for every item, so the identifier the
  // item carries and the identifier the link embeds must be the same one.
  const [item] = mapInterventionCheckins([panelRow({ pending_checkins: [checkin({ intervention_id: 'int-2' })] })])
  assert.ok(item.actionLink.endsWith(`/${item.studentId}`), 'link must embed the item\'s own studentId')
})

// ── 8. No new learner-detail route was introduced ───────────────────────────

test('8. Phase 1 introduced no per-class learner-detail route (no duplicate learner-detail surface)', () => {
  const missingRoute = join(REPO_ROOT, 'app', 'teacher', 'classes', '[classId]', 'students')
  assert.ok(
    !existsSync(missingRoute),
    'app/teacher/classes/[classId]/students/ must not exist — P0-C routes to the existing ' +
    'canonical Blueprint destination instead of building a second learner-detail page',
  )
})

test('8b. the destination page P0-C depends on actually exists', () => {
  const destination = join(REPO_ROOT, 'app', 'teacher', 'reports', 'blueprint', '[studentId]', 'page.tsx')
  assert.ok(existsSync(destination), 'the canonical per-learner destination page must exist')

  const destinationSource = readFileSync(destination, 'utf8')
  assert.ok(
    destinationSource.includes('findExternalIdsByStudentIds'),
    'destination must resolve the legacy students.id to a Core learner id',
  )
  assert.ok(
    destinationSource.includes('/student/blueprint/'),
    'destination must redirect into the canonical Blueprint route',
  )
})

// ── Class-level links are unchanged ─────────────────────────────────────────

test('9. class-level (non-learner) links were not touched', () => {
  assert.ok(SOURCE.includes('/insights'), 'class-level insight links must remain')
  assert.ok(SOURCE.includes('/teacher/scheme-of-work/'), 'SOW links must remain')
  assert.ok(SOURCE.includes("'/teacher/alerts'"), 'alerts link must remain')
})

// ── Phase 3.5 (Risk Consumer Convergence): mapMondayStudentRisk's flag reading ──

test('10. current-shape top_flags: reason text is read from Projection\'s own RiskFlag ({reason}), joined across multiple flags', () => {
  const row = panelRow({
    students_needing_attention: [
      studentSummary({
        top_flags: [
          { subject: 'mathematics', evidenceIds: ['e1'], severity: 'critical', reason: 'Below Expectation in mathematics and declining from prior evidence' },
          { subject: 'english', evidenceIds: ['e2'], severity: 'watch', reason: 'Approaching Expectation in english but declining from prior evidence' },
        ],
      }),
    ],
  })
  const items = mapMondayStudentRisk([row])
  assert.equal(items.length, 1)
  assert.equal(
    items[0].detail,
    'Below Expectation in mathematics and declining from prior evidence; Approaching Expectation in english but declining from prior evidence',
  )
})

test('11. stale legacy-shape cached row (pre-Phase-3.5, {detail} not {reason}): falls back to the legacy field, never renders "undefined"', () => {
  const staleLegacyFlag = { type: 'declining_performance', subject: 'mathematics', detail: 'Performance is declining in mathematics', severity: 'high', flagged_at: '2026-01-01T00:00:00Z' }
  const row = panelRow({
    students_needing_attention: [
      studentSummary({
        // Simulates a monday_panel_cache row written before this migration —
        // deliberately cast, since the current type no longer allows this shape.
        top_flags: [staleLegacyFlag] as unknown as StudentIntelligenceSummary['top_flags'],
      }),
    ],
  })
  const items = mapMondayStudentRisk([row])
  assert.equal(items.length, 1)
  assert.equal(items[0].detail, 'Performance is declining in mathematics')
  assert.doesNotMatch(items[0].detail, /undefined/)
})

test('12. no flags at all: falls back to the student\'s own action text, never an empty detail', () => {
  const row = panelRow({
    students_needing_attention: [studentSummary({ top_flags: [], action: 'Mary: Check in this week — profile incomplete.' })],
  })
  const items = mapMondayStudentRisk([row])
  assert.equal(items.length, 1)
  assert.equal(items[0].detail, 'Mary: Check in this week — profile incomplete.')
})

test('13. a normal-risk student produces no attention item at all (unaffected by the flag-source change)', () => {
  const row = panelRow({ students_needing_attention: [studentSummary({ risk_level: 'normal' })] })
  assert.equal(mapMondayStudentRisk([row]).length, 0)
})
