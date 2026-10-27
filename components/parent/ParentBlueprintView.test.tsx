// components/parent/ParentBlueprintView.test.tsx
//
// The parent's Learner Progress Report, tested on its actual rendered output
// (not just helper functions). Synthetic fixtures only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ParentBlueprintView from './ParentBlueprintView'
import BlueprintView from '@/components/blueprint/BlueprintView'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import {
  available,
  unavailable,
  noEvidenceBlueprint,
  planStep,
  syntheticBlueprint,
} from '@/lib/testing/progressReportFixture'

function renderParent(blueprint: LearnerBlueprint): string {
  return renderToStaticMarkup(
    <ParentBlueprintView blueprint={blueprint} validation={{ valid: true, errors: [] }} learnerId="learner-1" />
  )
}

function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
}

// Every developer note and internal reason the composers really emit today
// (composeCareer.ts, composeLearningCompass.ts, composeAttendance.ts,
// composeRisk/Career unavailable reasons) — placed in the payload so the test
// proves they never reach the page.
function blueprintWithInternals(): LearnerBlueprint {
  return syntheticBlueprint({
    attendance: available({
      presentCount: 17, absentCount: 3, lateCount: 0, excusedCount: 0, totalSessions: 20, attendancePercentage: 85,
      notes: ['Attendance Trend/Health/Risk/Support (ADR-0006 §5) are not yet computed by any Attendance-owned function — raw counts only.'],
    }),
    learningCompass: available({
      currentLearningFocus: { subject: 'mathematics', subtopic: null },
      nextRecommendedAction: 'Continue with mathematics',
      holidayProgrammeAvailable: true,
      learningReadiness: null,
      notes: ['Learning Readiness (ADR-0006 §3) has no Compass-owned source function yet — left null, not guessed.'],
    }),
    career: available({
      careerCluster: 'Health Sciences', strengthProfile: 'x', futureDirection: 'x', aiOutlook: null, confidence: 'Medium',
      doorsPreview: null, aiChangeSummary: null, humanAdvantageSummary: null, explorationSuggestions: null, knowledge: null,
      notes: [
        'AI Outlook has no canonical cluster-level source yet — left null, not guessed.',
        'No canonical algorithm-version export exists yet for Career Intelligence matching — left null, not invented.',
      ],
    }),
    teacherReflection: unavailable('No legacy student identity bridged for this learner — Teacher Reflection cannot be queried.'),
    recommendedNextSteps: available({
      actions: [
        { title: 'Review Attendance', description: 'Learning Time is at 85% this term — consistent attendance would help most right now.', actionType: 'review_attendance', priority: 'critical', sourceDomain: 'Attendance', destination: '/child/learner-1/full', available: true, reasonUnavailable: null, generatedAt: '2026-10-10T09:00:00.000Z' },
        { title: 'Explore Senior School Pathways', description: 'Look at the Senior School pathways together.', actionType: 'explore_career_journey', priority: 'suggested', sourceDomain: 'Career Intelligence', destination: '/career-intelligence', available: true, reasonUnavailable: null, generatedAt: '2026-10-10T09:00:00.000Z' },
      ],
      plan: [],
    }),
  })
}

// ── K · no internal text in parent-facing output ───────────────────────────

const INTERNAL_TEXT = [
  /ADR-\d/,
  /left null/i,
  /not guessed/i,
  /not invented/i,
  /canonical/i,
  /algorithm/i,
  /AI Outlook/i,
  /Source:/,
  /\bbridged\b/i,
  /Projection/,
  /Career Intelligence/,
  /Blueprint/,
  /\binsufficient_data\b/,
  /\bno_action_needed\b/,
  /\bcritical\b/,
  /\bat_risk\b/,
  /Confidence:/,
  /\bowner\b/i,
]

test('K. parent output never shows ADR references, developer notes, internal provenance, raw enum values or the internal product name', () => {
  for (const blueprint of [blueprintWithInternals(), noEvidenceBlueprint()]) {
    const text = visibleText(renderParent(blueprint))
    for (const pattern of INTERNAL_TEXT) {
      assert.doesNotMatch(text, pattern, `parent output leaked ${pattern}`)
    }
  }
})

test('K. learner and teacher output are held to the same standard', () => {
  for (const viewer of ['student', 'teacher'] as const) {
    const html = renderToStaticMarkup(
      <BlueprintView blueprint={blueprintWithInternals()} validation={{ valid: true, errors: [] }} learnerId="learner-1" viewer={viewer} />
    )
    const text = visibleText(html)
    for (const pattern of INTERNAL_TEXT) {
      assert.doesNotMatch(text, pattern, `${viewer} output leaked ${pattern}`)
    }
  }
})

test('the parent report leads with the same four questions, then a "More detail" area — no separate parent summary', () => {
  const html = renderParent(blueprintWithInternals())
  const order = ['Where are we now?', 'What&#x27;s going well, and what needs help?', 'What do we do next?', 'Where is this leading?', 'School &amp; Family Action Agreement', 'More detail']
  let cursor = -1
  for (const marker of order) {
    const index = html.indexOf(marker)
    assert.ok(index > cursor, `${marker} should appear after the previous section`)
    cursor = index
  }
  assert.doesNotMatch(html, /What This Means For You/)
  assert.doesNotMatch(html, /Recommended Next Steps/)
  // Server-rendered disclosure, not the old client accordion with function props.
  assert.match(html, /<details/)
})

test('"More detail" uses curriculum words, never a bare numeric level or raw subject key', () => {
  const html = renderParent(blueprintWithInternals())
  const detail = html.slice(html.indexOf('More detail'))
  assert.match(detail, /Approaching Expectations/)
  assert.match(detail, /Exceeding Expectations/)
  assert.match(detail, />Mathematics</)
  assert.doesNotMatch(detail, />mathematics</)
  assert.doesNotMatch(detail, /<td[^>]*>[1-4]<\/td>/)
  assert.match(detail, /Too early to show a direction/)
})

test('an unavailable detail section says so plainly — never the composer’s internal reason', () => {
  const text = visibleText(renderParent(blueprintWithInternals()))
  assert.match(text, /Nothing recorded here yet/)
})

test('attendance concern reaches the parent once, as a plain step', () => {
  const text = visibleText(renderParent(blueprintWithInternals()))
  assert.match(text, /currently 85%/)
})

// ── Junior rule, on the rendered parent page ───────────────────────────────

test('I. a junior learner’s parent report names no career field anywhere, including "More detail"', () => {
  const text = visibleText(renderParent(blueprintWithInternals()))
  assert.doesNotMatch(text, /Health Sciences/)
  assert.match(text, /Explore Senior School pathways/)
})

// ── L · printed agreement ──────────────────────────────────────────────────

test('L. the agreement page is a blank write-in form that never claims anything was agreed', () => {
  const text = visibleText(renderParent(syntheticBlueprint()))
  const agreement = text.slice(text.indexOf('School & Family Action Agreement'))
  for (const field of ['Meeting date', 'Learner’s next step', 'Teacher’s planned support', 'Parent/guardian’s support', 'Learner (optional)', 'Teacher', 'Parent/guardian']) {
    assert.ok(agreement.includes(field), `missing ${field}`)
  }
  assert.match(agreement, /Nothing on this page has been agreed until it is discussed/)
  assert.doesNotMatch(agreement, /has agreed|have agreed|was agreed|signed by/i)
  assert.doesNotMatch(agreement, /Proposed in the teacher’s plan/, 'nothing to propose without an approved plan step')
})

test('L. with an approved plan step, its content is offered only as a proposal for discussion', () => {
  const text = visibleText(renderParent(syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [planStep()] }) })))
  const agreement = text.slice(text.indexOf('School & Family Action Agreement'))
  assert.match(agreement, /Proposed in the teacher’s plan, for discussion: Short small-group fractions sessions twice a week/)
  assert.match(agreement, /Proposed in the teacher’s plan, for discussion: Ask to see the fractions practice set each weekend/)
  // The learner's assigned activity is a learner-visible field — not shown to the parent.
  assert.doesNotMatch(agreement, /Complete two fractions practice sets/)
})

// ── O · bilingual headings ─────────────────────────────────────────────────

test('O. each question renders its English heading and the Kiswahili line, marked lang="sw"', () => {
  const html = renderParent(syntheticBlueprint())
  for (const sw of ['Tuko wapi kwa sasa?', 'Ni mambo gani yanaendelea vizuri, na ni yapi yanahitaji msaada?', 'Hatua zinazofuata ni zipi?', 'Hii inaelekea wapi?']) {
    assert.match(html, new RegExp(`<p lang="sw"[^>]*>${sw.replace(/\?/g, '\\?')}</p>`))
  }
  assert.equal((html.match(/<h2 id="blueprint-/g) ?? []).length, 5)
})

// ── M · historical snapshots ───────────────────────────────────────────────

test('M. a stored snapshot shaped before this change renders without throwing, through the parent view', () => {
  const old = syntheticBlueprint()
  const legacyPayload = {
    ...old,
    recommendedNextSteps: available({ actions: [] }),
    pathwayReadiness: undefined,
    metadata: { ...old.metadata, gradeBand: undefined },
  } as unknown as LearnerBlueprint
  const html = renderToStaticMarkup(
    <ParentBlueprintView
      blueprint={legacyPayload}
      validation={{ valid: true, errors: [] }}
      learnerId="learner-1"
      historicalMeta={{
        snapshotId: 'snap-1', snapshotDate: '2026-04-01T09:00:00.000Z', academicYearLabel: '2026', termLabel: 'Term 1',
        snapshotType: 'end_of_term', schoolName: 'Synthetic Hills School', schemaVersion: '1', blueprintVersion: 'test', generatedFrom: 'end_of_term',
      }}
    />
  )
  assert.match(html, /Historical Record/)
  assert.match(html, /href="\/child\/learner-1\/history"/, 'back link stays inside the parent portal')
  assert.match(html, /Where are we now\?/)
})

// ── R · empty optional sections ────────────────────────────────────────────

test('R. with no evidence at all the parent page shows honest empty states — no "progressing well", no empty cards', () => {
  const text = visibleText(renderParent(noEvidenceBlueprint()))
  assert.doesNotMatch(text, /progressing well/i)
  assert.doesNotMatch(text, /No current concern pattern/)
  assert.match(text, /Whether anything needs closer watching can’t be judged yet/)
  assert.match(text, /No specific next step has been set yet/)
  assert.doesNotMatch(text, /\bundefined\b|\bnull\b/)
})
