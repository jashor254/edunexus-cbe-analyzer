// lib/core/legacyStudentAccessCanonicalization.architecture.test.ts
//
// PHASE 1 — Institutional Identity Convergence (architecture guard).
//
// Before this phase, six Career routes (app/api/career/{match,
// capability-matches,capability,growth,interest,[slug]}/route.ts) each
// independently re-derived "does this studentId belong to this user" as an
// inline `.eq('user_id', userId)` (sometimes `.or(user_id,parent_user_id)`)
// query against `students` — six copies of the same authorization decision,
// per Engineering Rule 4 ("never duplicate authorization, always extend the
// shared permission service"). None of them recognized the institutional
// Phase 1C compatibility bridge (`students.external_id = learners.id`,
// `user_id` always NULL), so an institutional learner — reachable on Home
// and Assignments — got a silent 403/empty result from every one of them.
//
// The fix consolidates all six into one function, canAccessLegacyStudent()
// (lib/core/permissions.ts), built on resolveOwnedLegacyStudentIds()
// (lib/core/identity.ts) — itself built on the existing canonical
// institutional resolver, resolveInstitutionalCompatibilityStudentIds()
// (lib/core/assignmentDiscovery.ts), never a new or duplicated one.
//
// This test proves the consolidation holds, tree-wide, so a future Career
// (or Compass) route cannot silently reintroduce a seventh legacy-only
// ownership check that quietly reopens the institutional dead end.
//
// Walks the real source tree (no mocks, no DB) — the same method
// lib/learnerIntelligence/careerCanonicalization.architecture.test.ts
// already established for "prove an absence, tree-wide."
//
// Run: npx tsx --test lib/core/legacyStudentAccessCanonicalization.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

const CAREER_ROUTES = [
  'app/api/career/match/route.ts',
  'app/api/career/capability-matches/route.ts',
  'app/api/career/capability/route.ts',
  'app/api/career/growth/route.ts',
  'app/api/career/interest/route.ts',
  'app/api/career/[slug]/route.ts',
]

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

test('every Career route that gates on a studentId imports the canonical canAccessLegacyStudent authorizer', () => {
  for (const rel of CAREER_ROUTES) {
    const src = stripComments(read(rel))
    assert.match(
      src,
      /canAccessLegacyStudent/,
      `${rel} no longer imports/calls canAccessLegacyStudent — a route-local ownership check may have been reintroduced, which would silently exclude institutional learners again (Phase 1)`
    )
  }
})

test('no Career route re-derives ownership with an inline .eq(\'user_id\' / \'parent_user_id\') check against students (the exact pattern Phase 1 consolidated away)', () => {
  const inlineOwnershipPattern = /\.eq\(\s*['"]user_id['"]\s*,\s*user(?:Id)?\.id\s*\)|\.eq\(\s*['"]parent_user_id['"]\s*,\s*user(?:Id)?\.id\s*\)/
  for (const rel of CAREER_ROUTES) {
    const src = stripComments(read(rel))
    assert.doesNotMatch(
      src,
      inlineOwnershipPattern,
      `${rel} contains an inline students.user_id/parent_user_id ownership check — this duplicates canAccessLegacyStudent() and will not recognize the institutional compatibility bridge`
    )
  }
})

test('resolveLearnerOwnership (Compass) checks the institutional compatibility bridge, not the legacy self-link alone', () => {
  const src = stripComments(read('lib/compass/ownership.ts'))
  assert.match(
    src,
    /resolveInstitutionalCompatibilityStudentIds/,
    'lib/compass/ownership.ts no longer references resolveInstitutionalCompatibilityStudentIds — an institutional learner would be denied Compass access again'
  )
})

test('canAccessLegacyStudent is built on resolveOwnedLegacyStudentIds, not a second inline students query (Engineering Rule 4)', () => {
  const src = stripComments(read('lib/core/permissions.ts'))
  const fnMatch = src.match(/export async function canAccessLegacyStudent[\s\S]*?\n}/)
  assert.ok(fnMatch, 'canAccessLegacyStudent() not found in lib/core/permissions.ts')
  assert.doesNotMatch(
    fnMatch![0],
    /\.from\(\s*['"]students['"]\s*\)/,
    'canAccessLegacyStudent() queries `students` directly — permissions.ts is meant to be built entirely on lib/core/identity.ts (see this module\'s own header), never to query a table itself'
  )
  assert.match(fnMatch![0], /resolveOwnedLegacyStudentIds/)
})

test('/api/students/list and /api/learn/student (Compass/Career entry points) resolve the institutional compatibility student as a fallback', () => {
  for (const rel of ['app/api/students/list/route.ts', 'app/api/learn/student/route.ts']) {
    const src = stripComments(read(rel))
    assert.match(
      src,
      /resolveCurrentInstitutionalCompatibilityStudentId/,
      `${rel} no longer resolves the institutional compatibility student — an institutional learner auto-selecting into Compass/Career (no explicit studentId) would get "Student not found" again`
    )
  }
})
