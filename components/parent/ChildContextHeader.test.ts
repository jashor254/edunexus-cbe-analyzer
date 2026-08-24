// components/parent/ChildContextHeader.test.ts
//
// Parent Portal Phase P3.5 — Step 19. ChildContextHeader (P3) had zero
// dedicated automated test coverage (P3's own §27/§30: "verified by
// build/typecheck/lint + unmodified-suite-still-passing only"). This is a
// STANDARD, DB-free unit test: `@/utils/supabase/server`, `@/lib/core/
// identity` and `@/lib/repositories` are all mocked (node:test's
// mock.module, same pattern lib/academy/aiJudge.test.ts and
// lib/career/knowledgeRequests.test.ts already use) — no real Supabase
// call, no next dev server, proves the presentation logic in isolation.
//
// ChildContextHeader is an async React Server Component with no hooks — it
// is, mechanically, just an async function returning a ReactElement, so it
// can be invoked directly (no jsdom/testing-library needed) and its output
// rendered with `react-dom/server`'s `renderToStaticMarkup`, the exact
// pattern components/blueprint/BlueprintView.test.tsx already established.
//
// Run: npx tsx --experimental-test-module-mocks --test components/parent/ChildContextHeader.test.ts

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { asLearnerId } from '@/lib/core/identityTypes'

type Learner = { first_name: string; middle_name: string | null; last_name: string }

let currentUserId: string | null = 'test-user'
let learnersById: Record<string, Learner> = {}
let schoolIdByLearner: Record<string, string> = {}
let schoolsById: Record<string, { school_name: string | null }> = {}
let siblingCoreLearnerIds: string[] = []
let resolveParentThrows = false

mock.module('@/utils/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: currentUserId ? { id: currentUserId } : null } }) },
    }),
  },
})

mock.module('@/lib/core/identity', {
  namedExports: {
    resolveParent: async (_userId: string) => {
      if (resolveParentThrows) throw new Error('boom')
      return { studentIds: [], coreLearnerIds: siblingCoreLearnerIds }
    },
  },
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      learners: {
        findSchoolId: async (learnerId: string) => {
          const id = schoolIdByLearner[learnerId]
          if (!id) throw new Error(`no school for ${learnerId}`)
          return id
        },
        findById: async (learnerId: string) => {
          const l = learnersById[learnerId]
          if (!l) throw new Error(`no learner ${learnerId}`)
          return l
        },
      },
      schools: {
        findById: async (schoolId: string) => {
          const s = schoolsById[schoolId]
          if (!s) throw new Error(`no school ${schoolId}`)
          return s
        },
      },
    },
  },
})

import { createElement, type ReactNode } from 'react'

let ChildContextHeader: typeof import('./ChildContextHeader').default
mock.module('next/link', {
  // Minimal Link stand-in — renders a plain <a>, sufficient for
  // renderToStaticMarkup and for asserting on href/text content.
  defaultExport: (props: { href: string; children: ReactNode; className?: string }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
})

async function loadHeader() {
  if (!ChildContextHeader) {
    ;({ default: ChildContextHeader } = await import('./ChildContextHeader'))
  }
  return ChildContextHeader
}

function reset() {
  currentUserId = 'test-user'
  learnersById = {}
  schoolIdByLearner = {}
  schoolsById = {}
  siblingCoreLearnerIds = []
  resolveParentThrows = false
}

test('one child (no siblings): renders name/school, "All children" link, no sibling picker', async () => {
  reset()
  const learnerId = asLearnerId('11111111-1111-1111-1111-111111111111')
  learnersById[learnerId] = { first_name: 'Aisha', middle_name: null, last_name: 'Wanjiru' }
  schoolIdByLearner[learnerId] = 'school-1'
  schoolsById['school-1'] = { school_name: 'Test Primary' }
  siblingCoreLearnerIds = [learnerId] // resolveParent includes the caller's own child, filtered out as "self" by the component

  const Header = await loadHeader()
  const html = renderToStaticMarkup(await Header({ learnerId }))

  assert.ok(html.includes('Viewing Aisha Wanjiru'), 'must render the child\'s full name')
  assert.ok(html.includes('Test Primary'), 'must render the school name')
  assert.ok(html.includes('All children'), 'a single-child parent gets the plain link')
  assert.ok(!html.includes('Switch child'), 'a single-child parent must NOT see the sibling switcher')
})

test('two children: sibling switcher renders with a link to the sibling', async () => {
  reset()
  const learnerId = asLearnerId('22222222-2222-2222-2222-222222222222')
  const siblingId = asLearnerId('33333333-3333-3333-3333-333333333333')
  learnersById[learnerId] = { first_name: 'Brian', middle_name: null, last_name: 'Otieno' }
  learnersById[siblingId] = { first_name: 'Carla', middle_name: null, last_name: 'Kimani' }
  schoolIdByLearner[learnerId] = 'school-1'
  schoolIdByLearner[siblingId] = 'school-1'
  schoolsById['school-1'] = { school_name: 'Test Primary' }
  siblingCoreLearnerIds = [learnerId, siblingId]

  const Header = await loadHeader()
  const html = renderToStaticMarkup(await Header({ learnerId }))

  assert.ok(html.includes('Switch child'), 'a 2+-child parent must see the switcher')
  assert.ok(html.includes(`/child/${siblingId}`), 'the switcher must link to the sibling\'s own page')
  assert.ok(html.includes('Carla'), 'the switcher must list the sibling by name')
})

test('an unrelated child never appears in the switcher (resolveParent scoped to the caller only)', async () => {
  reset()
  const learnerId = asLearnerId('44444444-4444-4444-4444-444444444444')
  const siblingId = asLearnerId('55555555-5555-5555-5555-555555555555')
  const unrelatedId = asLearnerId('66666666-6666-6666-6666-666666666666')
  learnersById[learnerId] = { first_name: 'Diana', middle_name: null, last_name: 'Njeri' }
  learnersById[siblingId] = { first_name: 'Evans', middle_name: null, last_name: 'Kiptoo' }
  learnersById[unrelatedId] = { first_name: 'Fatima', middle_name: null, last_name: 'Hassan' }
  schoolIdByLearner[learnerId] = 'school-1'
  schoolIdByLearner[siblingId] = 'school-1'
  schoolsById['school-1'] = { school_name: 'Test Primary' }
  // resolveParent is the ONLY source of siblings — it never returns unrelatedId,
  // simulating the real security invariant (fresh server-side resolveParent
  // call, never a client-supplied list).
  siblingCoreLearnerIds = [learnerId, siblingId]

  const Header = await loadHeader()
  const html = renderToStaticMarkup(await Header({ learnerId }))

  assert.ok(!html.includes('Fatima'), 'an unrelated child must never appear in the switcher')
  assert.ok(!html.includes(`/child/${unrelatedId}`), 'an unrelated child\'s id must never appear as a switcher link')
})

test('missing school name: graceful fallback, not a blank/broken render', async () => {
  reset()
  const learnerId = asLearnerId('77777777-7777-7777-7777-777777777777')
  learnersById[learnerId] = { first_name: 'Grace', middle_name: null, last_name: 'Muthoni' }
  schoolIdByLearner[learnerId] = 'school-x'
  schoolsById['school-x'] = { school_name: null } // school row exists but has no name on file

  const Header = await loadHeader()
  const html = renderToStaticMarkup(await Header({ learnerId }))

  assert.ok(html.includes('Viewing Grace Muthoni'), 'the child\'s name must still render')
  assert.ok(html.length > 0, 'must not render a blank page')
})

test('resolution failure (e.g. DB error): degrades to a working header, does not throw/block the page', async () => {
  reset()
  const learnerId = asLearnerId('88888888-8888-8888-8888-888888888888')
  // Deliberately no entry in learnersById/schoolIdByLearner — findSchoolId
  // throws, exercising the header's own try/catch fallback path.
  resolveParentThrows = true

  const Header = await loadHeader()
  const html = renderToStaticMarkup(await Header({ learnerId }))

  assert.ok(html.includes('Viewing Your child'), 'must fall back to the generic label, not throw')
  assert.ok(html.includes('All children'), 'must still offer a way back to the child list')
})

test('unauthenticated caller: renders nothing (null) rather than throwing', async () => {
  reset()
  currentUserId = null
  const learnerId = asLearnerId('99999999-9999-9999-9999-999999999999')

  const Header = await loadHeader()
  const el = await Header({ learnerId })
  assert.equal(el, null)
})
