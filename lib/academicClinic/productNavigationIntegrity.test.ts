// lib/academicClinic/productNavigationIntegrity.test.ts
//
// Phase 3.2 (Learner Report Architecture — intelligence product navigation
// & action-link integrity). Source-level guards, matching the established
// convention in careerConvergence.architecture.test.ts /
// orphanedClinicPageClosure.test.ts / documentIdentityProvenance.test.ts /
// reportContentContract.test.ts.
//
// The Phase 3.2 audit (a full cross-product link-graph trace across Learner
// Intelligence Report, Career Intelligence, Blueprint, and Learning
// Compass) found the graph already correct in every hard-link case — the
// only real findings were: (1) a learner-facing instruction telling the
// learner to add assessments themselves, in a product that doesn't own
// assessment entry, when only teachers/parents can add assessments at all;
// (2) a parent-facing CTA literally labeled "Start Learning Compass" when a
// parent's viewer role on /learn is read-only. Both are fixed below and
// guarded here so they cannot silently return.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/productNavigationIntegrity.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
function read(relPath: string): string {
  return readFileSync(`${REPO_ROOT}${relPath}`, 'utf8')
}

test('Guard A — the learner-facing Career Intelligence empty state does not send the learner to add their own assessments (learners have no assessment-entry route)', () => {
  const source = read('app/student/career/page.tsx')
  assert.doesNotMatch(source, /Add assessments in the Academic Clinic/,
    'a learner cannot add their own assessments — only a teacher or parent can; this instruction must point at a real actor, not a nonexistent learner-facing entry route')
  assert.match(source, /Ask your teacher or parent to record one/,
    'the corrected instruction must name the actual actors who can add an assessment')
})

test('Guard B — the parent-facing Career Intelligence report CTA does not overpromise a Compass session it cannot actually start', () => {
  const source = read('app/(parent)/career-intelligence-report/page.tsx')
  // A parent lands on /learn in a documented, enforced read-only mode
  // (app/learn/page.tsx's viewerRole==='parent' branch) — a button reading
  // "Start Learning Compass" on a page ONLY parents can reach overpromises
  // an action they cannot perform there.
  assert.doesNotMatch(source, /Start Learning Compass/)
  assert.match(source, /View Learning Compass Progress/)
})

test('Guard C — no live CTA/link anywhere points at the redirected legacy /academic-clinic surface', () => {
  const surfaces = [
    'app/dashboard/clinic/page.tsx',
    'app/dashboard/clinic/reports/[studentId]/page.tsx',
    'app/student/career/page.tsx',
    'app/student/career/[slug]/page.tsx',
    'app/(parent)/career-intelligence/page.tsx',
    'app/(parent)/career-intelligence-report/page.tsx',
    'app/(parent)/career-report/page.tsx',
    'components/blueprint/BlueprintView.tsx',
    'components/blueprint/sections.tsx',
    'components/parent/ParentBlueprintView.tsx',
    'app/dashboard/learning-compass/page.tsx',
  ]
  for (const surface of surfaces) {
    const source = read(surface)
    assert.doesNotMatch(source, /href=["']\/academic-clinic["']|router\.push\(["']\/academic-clinic["']\)/,
      `${surface} must not link to the redirected legacy /academic-clinic surface — the canonical destination is /dashboard/clinic`)
  }
})

test('Guard D — the Learner Intelligence Report\'s Compass CTA targets the real Compass surface, not a stale route', () => {
  const source = read('app/dashboard/clinic/reports/[studentId]/page.tsx')
  assert.match(source, /\/learn\?student=/,
    'the report\'s Compass entry point must target the real /learn surface with student context, not a stale/removed route')
})

test('Guard E — the Learner Intelligence Report\'s career links target the real Career Intelligence routes, not a stale route', () => {
  const source = read('app/dashboard/clinic/page.tsx')
  assert.match(source, /href=\{`\/career\/\$\{[^}]+\}`\}|href=["']\/career["']/,
    'the report\'s career links must target the real /career (Career Intelligence) route')
})

test('Guard F — Blueprint\'s cross-product action links stay routed through the per-viewer destination guard, not an ad hoc link', () => {
  const source = read('lib/parentExperience/actions.ts')
  assert.match(source, /isActionDestinationValidForViewer/,
    'Blueprint\'s viewer-scoped destination allow-list must remain the single gate for cross-product action links (parent/student/teacher get different allowed destinations)')
})
