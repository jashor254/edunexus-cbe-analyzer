// components/parent/ParentReportPage.test.tsx
//
// Lives here, not beside app/(parent)/child/[learnerId]/full/page.tsx: the
// test runner treats a `[learnerId]` path argument as a glob character class
// and would silently run zero tests from that directory.
//
// E — the parent report applies the same publication rule as the learner/
// teacher report: a report the Coherence Engine fails for a critical
// contradiction is withheld from the parent too. The verdict is produced by
// the REAL rule set (validateBlueprintCoherence) over a synthetic
// contradictory report — only auth and data access are mocked, so the test
// cannot pass with a hand-written "FAIL".

import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { validateBlueprintCoherence } from '@/lib/learnerBlueprint/coherence/validateBlueprintCoherence'
import { available, subject, syntheticBlueprint } from '@/lib/testing/progressReportFixture'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'

let current: LearnerBlueprint = syntheticBlueprint()
let composeCalls = 0

mock.module('@/utils/supabase/server', {
  namedExports: { createClient: async () => ({}) },
})

mock.module('@/lib/core/permissions', {
  namedExports: {
    requireAuthentication: async () => ({ id: 'synthetic-parent' }),
    requireParent: async () => ({ id: 'synthetic-parent' }),
  },
})

mock.module('@/lib/repositories', {
  namedExports: { repos: { learners: { findSchoolId: async () => 'synthetic-school' } } },
})

mock.module('@/lib/learnerBlueprint/composeBlueprint', {
  namedExports: {
    composeBlueprintWithCoherence: async () => {
      composeCalls++
      return { blueprint: current, validation: { valid: true, errors: [] }, coherence: validateBlueprintCoherence(current, []) }
    },
    // If the page ever goes back to the un-gated composer, this makes the
    // test fail loudly rather than silently pass.
    composeBlueprint: async () => { throw new Error('parent report must compose with the coherence gate') },
  },
})

let Page: (props: { params: Promise<{ learnerId: string }> }) => Promise<ReactElement>

before(async () => {
  ;({ default: Page } = await import('@/app/(parent)/child/[learnerId]/full/page'))
})

async function renderPage(): Promise<string> {
  const element = await Page({ params: Promise.resolve({ learnerId: '00000000-0000-4000-8000-000000000001' }) })
  return renderToStaticMarkup(element)
}

test('E. a contradictory report (headline says decline, record says improving) is withheld from the parent', async () => {
  current = syntheticBlueprint({
    academicRecord: available({
      overallTrend: 'improving',
      bySubject: [subject('mathematics', 3, 3, 'improving'), subject('english', 4, 3, 'improving')],
      competencies: [], confidence: 90, lastComputed: '2026-10-10T09:00:00.000Z',
    }),
    parentSummary: available({ headline: 'Amani Synthetic\'s progress this term needs attention.', detail: null, action: null }),
  })
  assert.equal(validateBlueprintCoherence(current, []).result, 'FAIL', 'precondition: the real rules fail this report')

  const html = await renderPage()
  assert.match(html, /This report needs review before it can be shown/)
  assert.doesNotMatch(html, /needs attention/, 'the contradictory headline must not reach the parent')
  assert.doesNotMatch(html, /Where are we now\?/)
  assert.ok(composeCalls > 0)
})

test('E. a coherent report renders normally for the parent', async () => {
  current = syntheticBlueprint()
  assert.notEqual(validateBlueprintCoherence(current, []).result, 'FAIL')

  const html = await renderPage()
  assert.match(html, /Where are we now\?/)
  assert.doesNotMatch(html, /needs review before it can be shown/)
})
