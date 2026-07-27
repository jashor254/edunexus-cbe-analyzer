// components/blueprint/actionPlan/actionPlanComponents.test.tsx
//
// Static-render tests for the Blueprint Action Plan's UI components (Phase
// 3A), following this repo's established node:test + renderToStaticMarkup
// convention (see components/blueprint/BlueprintView.test.tsx / components
// /blueprint/review/reviewComponents.test.tsx). useEffect (the delivery
// panels' class-list fetch, focus, and Escape-key wiring) never runs during
// static server rendering, so these tests exercise exactly the initial,
// pre-interaction render — enough to prove the required states, warning
// copy, and field/privacy boundaries without a browser-testing framework.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import BlueprintActionPlanCard from './BlueprintActionPlanCard'
import AssignmentDeliveryPanel from './AssignmentDeliveryPanel'
import CompassDeliveryPanel from './CompassDeliveryPanel'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'

function makeItem(overrides: Partial<ReviewableActionListItem> = {}): ReviewableActionListItem {
  return {
    actionId: 'a1', title: 'Reading Fluency', intendedOutcome: 'Reach fluent oral reading by end of term.',
    learnerAction: 'Read aloud for 10 minutes daily.', successIndicator: 'Improved reading accuracy.',
    approvalStatus: 'approved', reviewDate: '2026-08-15', assignmentDelivered: false, assignmentId: null, compassDelivered: false,
    latestDecision: 'awaiting_review', latestReviewAt: null, latestReviewNotes: null, reviewCount: 0,
    lastActivityAt: null, awaitingReview: true,
    ...overrides,
  }
}

const noop = () => {}

// ── BlueprintActionPlanCard ─────────────────────────────────────────────────

test('approved undelivered action renders correctly, offers both delivery buttons, no review link yet', () => {
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={makeItem()} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Not yet delivered/)
  assert.match(html, /Create class assignment/)
  assert.match(html, /Send to Learning Compass/)
  assert.doesNotMatch(html, /Review progress/)
})

test('assignment-delivered action renders correctly: assignment link, only the Compass delivery button remains', () => {
  const item = makeItem({ assignmentDelivered: true, assignmentId: 'asg-1' })
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={item} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Delivered to Assignment/)
  assert.match(html, /teacher\/assignments\/asg-1/)
  assert.doesNotMatch(html, />Create class assignment</)
  assert.match(html, /Send to Learning Compass/)
  assert.match(html, /Review progress/)
})

test('Compass-delivered action renders correctly: only the Assignment delivery button remains', () => {
  const item = makeItem({ compassDelivered: true })
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={item} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Delivered to Compass/)
  assert.match(html, /Create class assignment/)
  assert.doesNotMatch(html, />Send to Learning Compass</)
  assert.match(html, /Review progress/)
})

test('dual-delivered action renders correctly: no delivery buttons remain, only Review progress', () => {
  const item = makeItem({ assignmentDelivered: true, assignmentId: 'asg-1', compassDelivered: true })
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={item} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Delivered to Assignment and Compass/)
  assert.doesNotMatch(html, />Create class assignment</)
  assert.doesNotMatch(html, />Send to Learning Compass</)
  assert.match(html, /Review progress/)
})

test('latest review renders separately from Approval status — never relabels the approved action itself', () => {
  const item = makeItem({ assignmentDelivered: true, assignmentId: 'a', latestDecision: 'needs_revision', latestReviewAt: '2026-07-20T00:00:00Z', latestReviewNotes: 'Needs a simpler target.' })
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={item} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Approval status[\s\S]{0,20}Approved/)
  assert.match(html, /Latest teacher review[\s\S]{0,200}Needs Revision/)
  assert.match(html, /Needs a simpler target/)
})

test('the recommended-next-action label is presentation text only, never a persisted field name', () => {
  const html = renderToStaticMarkup(<BlueprintActionPlanCard item={makeItem()} learnerId="l1" onOpenAssignmentDelivery={noop} onOpenCompassDelivery={noop} />)
  assert.match(html, /Suggested next step: Choose delivery/)
})

// ── Static privacy scan (structural: these fields don't exist on the DTO type at all) ──

const CARD_SOURCE = readFileSync(join(__dirname, 'BlueprintActionPlanCard.tsx'), 'utf8')
const SECTION_SOURCE = readFileSync(join(__dirname, 'BlueprintActionPlanSection.tsx'), 'utf8')
const ASSIGNMENT_PANEL_SOURCE = readFileSync(join(__dirname, 'AssignmentDeliveryPanel.tsx'), 'utf8')
const COMPASS_PANEL_SOURCE = readFileSync(join(__dirname, 'CompassDeliveryPanel.tsx'), 'utf8')

test('static: no Phase 3A action-plan component references teacherNotes, parentSupport, or evidenceBasis — the DTO carries none of them', () => {
  for (const src of [CARD_SOURCE, SECTION_SOURCE, ASSIGNMENT_PANEL_SOURCE, COMPASS_PANEL_SOURCE]) {
    assert.doesNotMatch(src, /teacherNotes|teacher_notes|parentSupport|parent_support|evidenceBasis|evidence_basis/)
  }
})

test('static: no Phase 3A action-plan component imports or calls a Supabase table writer or the domain writers directly (only mentions them in doc comments)', () => {
  for (const src of [CARD_SOURCE, SECTION_SOURCE, ASSIGNMENT_PANEL_SOURCE, COMPASS_PANEL_SOURCE]) {
    assert.doesNotMatch(src, /\.from\(['"][a-z_]+['"]\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\(/)
    const codeLines = src.split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
    assert.doesNotMatch(codeLines, /createAssignment\(|setTeacherSuggestedTopic\(|reviewBlueprintAction\(|deliverBlueprintActionAsAssignment\(|deliverBlueprintActionToCompass\(/)
  }
})

// ── BlueprintActionPlanSection ──────────────────────────────────────────────
//
// BlueprintActionPlanSection calls useRouter() (for router.refresh() after
// a delivery), so — like Phase 2E's own BlueprintReviewWorkspace — it
// cannot be rendered with plain renderToStaticMarkup outside a real
// Next.js App Router tree (no test harness in this repo provides one; see
// components/blueprint/review/reviewComponents.test.tsx, which likewise
// never render-tests BlueprintReviewWorkspace directly). Its empty-state
// and per-item-card behavior is covered at the source level below and at
// the card level above; the source-presence check keeps the empty-state
// copy honest without needing router context.

test('BlueprintActionPlanSection: the empty-state copy explains no actions are available, not an error', () => {
  assert.match(SECTION_SOURCE, /No approved Blueprint actions are available yet/)
})

// ── AssignmentDeliveryPanel ─────────────────────────────────────────────────

test('Assignment delivery panel: the class-wide warning is a visible role="alert" block, never buried in muted helper text', () => {
  const html = renderToStaticMarkup(
    <AssignmentDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /role="alert"[^>]*>[\s\S]{0,200}This assignment will be issued to every learner in the selected class\./)
})

test('Assignment delivery panel: the confirmation checkbox is NOT preselected', () => {
  const html = renderToStaticMarkup(
    <AssignmentDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  const checkboxMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/)
  assert.ok(checkboxMatch, 'expected a checkbox input')
  assert.doesNotMatch(checkboxMatch![0], /checked/)
})

test('Assignment delivery panel: prefills title and instructions deterministically from the approved action', () => {
  const html = renderToStaticMarkup(
    <AssignmentDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /value="Reading Fluency"/)
  assert.match(html, /Read aloud daily\./)
  assert.match(html, /Success looks like: Improved accuracy\./)
})

test('Assignment delivery panel: is a real dialog (role="dialog", aria-modal) with a native class <select>', () => {
  const html = renderToStaticMarkup(
    <AssignmentDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction={null} intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /role="dialog"/)
  assert.match(html, /aria-modal="true"/)
  assert.match(html, /<select/)
})

// ── CompassDeliveryPanel ─────────────────────────────────────────────────────

test('Compass delivery panel: no class or alternate-learner selector exists anywhere in the form', () => {
  const html = renderToStaticMarkup(
    <CompassDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.doesNotMatch(html, /<select/)
  assert.doesNotMatch(html, /learnerId|learner_id|studentId/i)
})

test('Compass delivery panel: the exact required disclaimer is visible, and the confirmation checkbox is not preselected', () => {
  const html = renderToStaticMarkup(
    <CompassDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /This will make the approved objective available in Learning Compass for this learner\. It will not start a tutoring session automatically\./)
  const checkboxMatch = html.match(/<input[^>]*type="checkbox"[^>]*>/)
  assert.ok(checkboxMatch)
  assert.doesNotMatch(checkboxMatch![0], /checked/)
})

test('Compass delivery panel: objective and instructions prefill deterministically, mirroring the assignment panel\'s identical formula', () => {
  const html = renderToStaticMarkup(
    <CompassDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction="Read aloud daily." intendedOutcome="Fluent reading." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /Read aloud daily\./)
  assert.match(html, /Success looks like: Improved accuracy\./)
})

test('Compass delivery panel: falls back to intendedOutcome when learnerAction is null, never fabricates content', () => {
  const html = renderToStaticMarkup(
    <CompassDeliveryPanel actionId="a1" actionTitle="Reading Fluency" learnerAction={null} intendedOutcome="Fluent reading by end of term." successIndicator="Improved accuracy." onClose={noop} onDelivered={noop} />
  )
  assert.match(html, /Fluent reading by end of term\./)
})
