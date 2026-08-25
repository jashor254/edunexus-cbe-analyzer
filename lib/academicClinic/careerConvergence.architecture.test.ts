// lib/academicClinic/careerConvergence.architecture.test.ts
//
// Phase 9.1.6 — narrow guards for the corpus-convergence boundary.
//
// Guard A — canonicalCareerAdapter.ts stays pure (no Supabase/repository
//           import). Repository -> adapter -> pure matcher, never
//           pure matcher -> Supabase (§10/§11).
// Guard B — CareerEngine (careerEngine.ts) still performs zero I/O of its
//           own — it must keep receiving data from its caller, not fetch it.
// Guard C — CAREER_DATABASE itself is never edited by this phase (its
//           entry count and a content spot-check must be unchanged).
// Guard D — the adapter never silently falls back to CAREER_DATABASE on
//           its own; any degrade-on-failure decision belongs to the caller
//           (assessmentPipeline.ts), and must be an explicit, logged branch,
//           not something buried inside the adapter itself.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/careerConvergence.architecture.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CAREER_DATABASE } from './careerEngine'

const REPO_ROOT = new URL('../../', import.meta.url)
function read(relPath: string): string {
  return readFileSync(new URL(relPath, REPO_ROOT), 'utf8')
}

test('Guard A — canonicalCareerAdapter.ts imports no Supabase/repository/AI client', () => {
  const source = read('lib/academicClinic/canonicalCareerAdapter.ts')
  const importTargets = Array.from(source.matchAll(/from\s+'([^']+)'/g)).map(m => m[1])
  for (const target of importTargets) {
    assert.ok(
      !target.includes('repositories') && !target.includes('supabase') && !target.includes('/ai/'),
      `canonicalCareerAdapter.ts must not import "${target}" — it must stay a pure function`,
    )
  }
})

test('Guard B — careerEngine.ts (CareerEngine class) performs zero DB/network I/O', () => {
  const source = read('lib/academicClinic/careerEngine.ts')
  for (const banned of ['supabase', 'createClient', 'repos.', '.from(', 'fetch(']) {
    assert.ok(!source.includes(banned), `lib/academicClinic/careerEngine.ts must not reference "${banned}" — CareerEngine must stay pure`)
  }
})

test('Guard C — CAREER_DATABASE is untouched by this phase (40 entries, spot-checked)', () => {
  assert.equal(CAREER_DATABASE.length, 40, 'CAREER_DATABASE entry count changed — this phase must not edit it')
  const softwareEngineer = CAREER_DATABASE.find(c => c.id === 'software_engineer')
  assert.ok(softwareEngineer)
  assert.equal(softwareEngineer!.name, 'Software Engineer / Developer')
  assert.equal(softwareEngineer!.kenyaShortageScore, 80)
  assert.deepEqual(softwareEngineer!.matchRequirements.primarySubjects, ['mathematics', 'integrated_science'])
})

test('Guard D — canonicalCareerAdapter.ts does not itself reference CAREER_DATABASE as a fallback source', () => {
  // It legitimately IMPORTS CAREER_DATABASE (to compute clinicRepresentedSlugs
  // for dedup) — that's identity lookup, not a fallback. This guard checks the
  // adapter's exported entry point never returns CAREER_DATABASE entries
  // themselves (only NEW, adapted ones), which the dedup test in
  // canonicalCareerAdapter.test.ts already proves behaviorally; this is the
  // source-text companion check.
  const source = read('lib/academicClinic/canonicalCareerAdapter.ts')
  assert.ok(source.includes('CAREER_DATABASE'), 'expected to import CAREER_DATABASE for identity/dedup purposes')
  assert.ok(!/return\s+CAREER_DATABASE\b/.test(source), 'adaptCanonicalCareersForClinic must never return CAREER_DATABASE entries directly')
})

test('assessmentPipeline.ts treats a canonical-career fetch failure as an explicit, logged, non-silent degrade', () => {
  const source = read('lib/academicClinic/assessmentPipeline.ts')
  assert.ok(source.includes('adaptCanonicalCareersForClinic'))
  assert.ok(source.includes('canonical career fetch failed'), 'the failure path must be logged, not silently swallowed')
})
