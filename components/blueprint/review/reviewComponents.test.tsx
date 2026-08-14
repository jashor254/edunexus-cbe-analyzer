// components/blueprint/review/reviewComponents.test.tsx
//
// Static-render tests for the Teacher Review Workspace's presentation
// components (Phase 2E), mirroring components/blueprint/BlueprintView
// .test.tsx's own node:test + renderToStaticMarkup pattern (no jsdom, no
// interaction — this repo has no browser-testing framework and the task
// brief instructs against adding one). Covers rendering rules: delivered
// vs undelivered states, honest empty states, no private-field leakage,
// no raw Compass/model content, and append-only review-history ordering.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import AssignmentActivitySummary from './AssignmentActivitySummary'
import CompassActivitySummary from './CompassActivitySummary'
import EvidenceSummary from './EvidenceSummary'
import ProjectionSummary from './ProjectionSummary'
import ReviewHistory from './ReviewHistory'
import BlueprintActionOverview from './BlueprintActionOverview'
import BlueprintActionReviewCard from './BlueprintActionReviewCard'
import BlueprintActionReviewList from './BlueprintActionReviewList'
import BlueprintReviewForm from './BlueprintReviewForm'
import type { AssignmentReviewSnapshot, CompassReviewSnapshot, EvidenceReviewSnapshot, ProjectionReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import type { BlueprintActionReviewRow } from '@/lib/repositories/blueprintActionReview.repository'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import { asLearnerId } from '@/lib/core/identityTypes'

// ── AssignmentActivitySummary ───────────────────────────────────────────────

test('AssignmentActivitySummary: undelivered state renders correctly, not as an error', () => {
  const html = renderToStaticMarkup(<AssignmentActivitySummary assignment={{ delivered: false }} />)
  assert.match(html, /Not yet delivered/)
  assert.doesNotMatch(html, /error/i)
})

test('AssignmentActivitySummary: delivered state renders completion summary and a link to the assignment, never claims success from submission alone', () => {
  const assignment: AssignmentReviewSnapshot = {
    delivered: true, assignmentId: 'a1', status: 'active', completionLabel: 'in_progress',
    total: 5, pending: 2, submitted: 2, marked: 1, averageScore: 82,
  }
  const html = renderToStaticMarkup(<AssignmentActivitySummary assignment={assignment} />)
  assert.match(html, /In progress/)
  assert.match(html, /teacher\/assignments\/a1/)
  assert.doesNotMatch(html, /succeeded|success/i)
})

// ── CompassActivitySummary ──────────────────────────────────────────────────

test('CompassActivitySummary: no delivery renders correctly', () => {
  const html = renderToStaticMarkup(<CompassActivitySummary compass={{ delivered: false }} />)
  assert.match(html, /Not yet delivered to Learning Compass/)
})

test('CompassActivitySummary: delivered with zero sessions shows "No learner activity recorded yet", not a failure', () => {
  const compass: CompassReviewSnapshot = {
    delivered: true, deliveryId: 'd1', subject: 'english', deliveryStatus: 'available', boundSessionId: null, sessionCount: 0, activeCount: 0, completedCount: 0, abandonedCount: 0, lastActivityAt: null,
  }
  const html = renderToStaticMarkup(<CompassActivitySummary compass={compass} />)
  assert.match(html, /No learner activity recorded yet/)
})

test('CompassActivitySummary: never renders raw model/session content — only counts and dates are in its props at all', () => {
  const compass: CompassReviewSnapshot = {
    delivered: true, deliveryId: 'd1', subject: 'english', deliveryStatus: 'completed', boundSessionId: 's1', sessionCount: 3, activeCount: 1, completedCount: 2, abandonedCount: 0, lastActivityAt: '2026-07-20T00:00:00Z',
  }
  const html = renderToStaticMarkup(<CompassActivitySummary compass={compass} />)
  assert.match(html, /3 sessions/)
  assert.doesNotMatch(html, /prompt|deepseek|conversation/i)
})

// ── EvidenceSummary ──────────────────────────────────────────────────────────

test('EvidenceSummary: no evidence renders an honest empty state', () => {
  const evidence: EvidenceReviewSnapshot = { count: 0, latestAt: null, latestSummary: null }
  const html = renderToStaticMarkup(<EvidenceSummary evidence={evidence} />)
  assert.match(html, /No Evidence recorded/)
})

test('EvidenceSummary: renders the snapshot\'s own summary verbatim, not a recomputed one', () => {
  const evidence: EvidenceReviewSnapshot = { count: 2, latestAt: '2026-07-15T00:00:00Z', latestSummary: 'Mathematics — Level 3 — score 78' }
  const html = renderToStaticMarkup(<EvidenceSummary evidence={evidence} />)
  assert.match(html, /Mathematics — Level 3 — score 78/)
  assert.match(html, /2 evidence records/)
})

// ── ProjectionSummary ────────────────────────────────────────────────────────

test('ProjectionSummary: no projection renders an honest empty state, never a fabricated percentage', () => {
  const projection: ProjectionReviewSnapshot = { projections: [], trend: 'no_projection' }
  const html = renderToStaticMarkup(<ProjectionSummary projection={projection} />)
  assert.match(html, /No projection is available/)
})

test('ProjectionSummary: shows a confidence CATEGORY, not a bare invented percentage, plus the caveat sentence', () => {
  const projection: ProjectionReviewSnapshot = {
    projections: [{ projectorType: 'capability', confidence: 82, freshnessDays: 3, lastComputed: '2026-07-20T00:00:00Z' }],
    trend: 'increased',
  }
  const html = renderToStaticMarkup(<ProjectionSummary projection={projection} />)
  assert.match(html, /High/)
  assert.doesNotMatch(html, /82%/)
  assert.match(html, /not a determination of success/)
  assert.match(html, /increased since the last review/)
})

// ── ReviewHistory ────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<BlueprintActionReviewRow> = {}): BlueprintActionReviewRow {
  return {
    id: 'r1', learner_id: asLearnerId('l1'), school_id: 's1', blueprint_action_item_id: 'a1',
    decision: 'no_decision', notes: null,
    assignment_snapshot: null, compass_snapshot: null, evidence_snapshot: null, projection_snapshot: null,
    reviewed_by: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

test('ReviewHistory: empty history renders an honest empty state', () => {
  const html = renderToStaticMarkup(<ReviewHistory reviews={[]} />)
  assert.match(html, /No reviews recorded yet/)
})

test('ReviewHistory: renders reviews chronologically (oldest first) even though the snapshot passes newest-first, and never offers edit/delete', () => {
  const newer = makeReview({ id: 'r2', decision: 'complete', created_at: '2026-07-10T00:00:00Z', notes: 'Second review' })
  const older = makeReview({ id: 'r1', decision: 'defer', created_at: '2026-07-01T00:00:00Z', notes: 'First review' })
  const html = renderToStaticMarkup(<ReviewHistory reviews={[newer, older]} />)
  assert.ok(html.indexOf('First review') < html.indexOf('Second review'), 'oldest review must render before the newer one')
  assert.doesNotMatch(html, /<button/i)
  assert.doesNotMatch(html, />\s*Edit\s*</i)
  assert.doesNotMatch(html, />\s*Delete\s*</i)
})

// ── BlueprintActionOverview ──────────────────────────────────────────────────

function makeAction(overrides: Partial<BlueprintActionItemRow> = {}): BlueprintActionItemRow {
  return {
    id: 'a1', learner_id: asLearnerId('l1'), school_id: 's1', academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', status: 'approved', visibility: 'teacher_only',
    title: 'Reading Fluency', rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Reach fluent oral reading by end of term.',
    learner_action: 'Read aloud for 10 minutes daily.',
    teacher_action: null, parent_support: 'CONFIDENTIAL parent-only guidance', school_support: null,
    success_indicator: 'Next confirmed assessment shows improved reading accuracy.',
    target_capability: null,
    sub_strand_id: null, review_date: '2026-08-15',
    teacher_notes: 'CONFIDENTIAL: internal note never shown to anyone but the authoring teacher.',
    proposal_source: 'teacher', source_generator: null,
    evidence_basis: { projectorType: null, supportingEvidenceIds: [], confidence: null, lastComputed: null, projectionVersion: null },
    proposed_by: null, reviewed_by: null, reviewed_at: null, decision_reason: null,
    created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

test('BlueprintActionOverview: renders teacher-safe fields and never renders teacherNotes or parentSupport content', () => {
  const html = renderToStaticMarkup(<BlueprintActionOverview action={makeAction()} />)
  assert.match(html, /Reading Fluency/)
  assert.match(html, /Reach fluent oral reading/)
  assert.doesNotMatch(html, /CONFIDENTIAL/)
})

test('BlueprintActionOverview: approval status renders as its own separately labeled "Approved" pill, distinct from any review decision', () => {
  const html = renderToStaticMarkup(<BlueprintActionOverview action={makeAction()} />)
  assert.match(html, /Approval status/)
  assert.match(html, />Approved</)
})

// ── BlueprintActionReviewCard / List ────────────────────────────────────────

function makeListItem(overrides: Partial<ReviewableActionListItem> = {}): ReviewableActionListItem {
  return {
    actionId: 'a1', title: 'Reading Fluency', intendedOutcome: 'Reach fluent oral reading by end of term.',
    learnerAction: 'Read aloud for 10 minutes daily.', successIndicator: 'Improved reading accuracy.',
    approvalStatus: 'approved', reviewDate: '2026-08-15', assignmentDelivered: true, assignmentId: 'asg-1', compassDelivered: false,
    latestDecision: 'awaiting_review', latestReviewAt: null, latestReviewNotes: null, reviewCount: 0, lastActivityAt: '2026-07-20T00:00:00Z',
    awaitingReview: true,
    ...overrides,
  }
}

test('BlueprintActionReviewCard: keeps Approval status and Latest review as two visually and textually distinct labels — never relabels the action itself', () => {
  const html = renderToStaticMarkup(<BlueprintActionReviewCard item={makeListItem({ latestDecision: 'needs_revision' })} selected={false} onSelect={() => {}} />)
  assert.match(html, /Approval status:<\/span> Approved/)
  assert.match(html, /Latest review:/)
  assert.match(html, /Needs Revision/)
})

test('BlueprintActionReviewCard: awaiting-review items show a keyboard-operable, non-color-only "Needs attention" indicator', () => {
  const html = renderToStaticMarkup(<BlueprintActionReviewCard item={makeListItem({ awaitingReview: true })} selected={false} onSelect={() => {}} />)
  assert.match(html, /<button/)
  assert.match(html, /Needs attention/)
})

test('BlueprintActionReviewList: empty state explains no actions are available, not an error', () => {
  const html = renderToStaticMarkup(<BlueprintActionReviewList items={[]} selectedActionId={null} onSelect={() => {}} />)
  assert.match(html, /No approved Blueprint actions are available for review/)
})

test('BlueprintActionReviewList: renders one card per item, in list order', () => {
  const items = [makeListItem({ actionId: 'a1', title: 'First action' }), makeListItem({ actionId: 'a2', title: 'Second action' })]
  const html = renderToStaticMarkup(<BlueprintActionReviewList items={items} selectedActionId={null} onSelect={() => {}} />)
  assert.ok(html.indexOf('First action') < html.indexOf('Second action'))
})

// ── BlueprintReviewForm (static initial render) ─────────────────────────────

test('BlueprintReviewForm: renders exactly the five established decisions, no invented synonym, and the required disclaimer', () => {
  const html = renderToStaticMarkup(<BlueprintReviewForm actionId="a1" onSubmitted={() => {}} />)
  for (const label of ['Complete', 'Needs Revision', 'Reopen', 'Defer', 'No Decision']) {
    assert.match(html, new RegExp(label))
  }
  assert.match(html, /Assignment or Compass activity does not automatically determine whether the action succeeded/)
  assert.match(html, /Record your professional judgement/)
})

test('BlueprintReviewForm: decision inputs are real radio inputs (native keyboard operability), and the note field is present', () => {
  const html = renderToStaticMarkup(<BlueprintReviewForm actionId="a1" onSubmitted={() => {}} />)
  assert.match(html, /type="radio"/)
  const radioCount = (html.match(/type="radio"/g) ?? []).length
  assert.equal(radioCount, 5)
  assert.match(html, /<textarea/)
})
