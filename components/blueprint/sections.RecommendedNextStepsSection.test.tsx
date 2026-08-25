// components/blueprint/sections.RecommendedNextStepsSection.test.tsx
//
// Phase 2 (Blueprint Actionability) — proves the specific rendering bug
// Phase 0's audit found: ParentBlueprintView.tsx's "Recommended Next Steps"
// section rendered title/description/priority/sourceDomain but silently
// dropped `action.destination`, even though every ParentAction destination
// is parent-space by construction (see lib/parentExperience/actions.ts) and
// the same objects are already trusted, unconditionally, by
// components/parent/ParentActionCard.tsx on Parent Home.
//
// Run: npx tsx --test components/blueprint/sections.RecommendedNextStepsSection.test.tsx

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecommendedNextStepsSection } from './sections'
import type { RecommendedNextStepsData } from '@/lib/learnerBlueprint/types'
import type { ParentAction } from '@/lib/parentExperience/actions'

function action(overrides: Partial<ParentAction> = {}): ParentAction {
  return {
    title: 'Continue Holiday Learning',
    description: 'A holiday learning programme is available for your child.',
    actionType: 'continue_holiday_learning',
    priority: 'important',
    sourceDomain: 'Learning Compass',
    destination: '/child/learner-1/full',
    available: true,
    reasonUnavailable: null,
    generatedAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  }
}

function data(actions: ParentAction[]): RecommendedNextStepsData {
  return { actions }
}

test('parent viewer (default): destination renders as a real, clickable CTA — the exact field Phase 0 found dropped', () => {
  const html = renderToStaticMarkup(<RecommendedNextStepsSection data={data([action()])} />)
  assert.match(html, /href="\/child\/learner-1\/full"/)
  assert.match(html, /Take this action/)
  assert.match(html, /Continue Holiday Learning/)
})

test('explicit viewer="parent" behaves identically to the default', () => {
  const html = renderToStaticMarkup(<RecommendedNextStepsSection data={data([action()])} viewer="parent" />)
  assert.match(html, /href="\/child\/learner-1\/full"/)
})

test('a hypothetical non-parent viewer never gets a link for a parent-only destination (defensive — no non-parent caller exists today, but the mechanism must hold)', () => {
  const html = renderToStaticMarkup(<RecommendedNextStepsSection data={data([action()])} viewer="teacher" />)
  assert.doesNotMatch(html, /href="\/child\/learner-1\/full"/)
  assert.doesNotMatch(html, /Take this action/)
  // The recommendation itself must remain visible even with no link.
  assert.match(html, /Continue Holiday Learning/)
})

test('an unsafe/invalid destination never becomes a link, even for a parent viewer', () => {
  const html = renderToStaticMarkup(
    <RecommendedNextStepsSection data={data([action({ destination: '//evil.example.com/phish' })])} viewer="parent" />
  )
  assert.doesNotMatch(html, /evil\.example\.com/)
  assert.match(html, /Continue Holiday Learning/)
})

test('every action renders regardless of link eligibility — the source/priority/description fields are unchanged', () => {
  const html = renderToStaticMarkup(
    <RecommendedNextStepsSection
      data={data([
        action({ title: 'Review Attendance', actionType: 'review_attendance', priority: 'critical', sourceDomain: 'Attendance' }),
      ])}
    />
  )
  assert.match(html, /Review Attendance/)
  assert.match(html, /critical/)
  assert.match(html, /Source: Attendance/)
})
