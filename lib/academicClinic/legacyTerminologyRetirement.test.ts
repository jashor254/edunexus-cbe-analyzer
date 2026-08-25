// lib/academicClinic/legacyTerminologyRetirement.test.ts
//
// Phase 3.3 (Learner Report Architecture — Academic Clinic legacy naming
// retirement). Option C (targeted product-copy test): asserts canonical
// naming across the specific user-facing marketing/demo/metadata surfaces
// this phase corrected — not a repository-wide sweep (which would false-
// positive on legitimate internal identifiers like lib/academicClinic/,
// clinic_report, /api/academic-clinic/*, and the AcademicClinicDemo/
// ClinicalOverviewPage component/file names, all deliberately unrenamed
// per the phase's internal-identifier-freeze policy).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/legacyTerminologyRetirement.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
function read(relPath: string): string {
  return readFileSync(`${REPO_ROOT}${relPath}`, 'utf8')
}

// Strips single-line (//) and block (/* */) comments before matching, so a
// legitimate internal-identifier comment (e.g. "the Academic Clinic
// pipeline") never fails a rendered-text guard — the same discipline used
// by documentIdentityProvenance.test.ts's Guard B.
function renderedTextOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

const USER_FACING_SURFACES = [
  'app/layout.tsx',
  'app/(marketing)/early-access/page.tsx',
  'app/(marketing)/components/HeroSlideshow.tsx',
  'app/(marketing)/components/ProductMockups.tsx',
  'components/ui/empty-states.tsx',
  'components/demo/mockData.ts',
  'components/demo/pages/CoverPage.tsx',
  'components/demo/pages/PageHeader.tsx',
  'components/demo/pages/TeacherPage.tsx',
  'components/demo/pages/ClinicalOverviewPage.tsx',
  'components/demo/kcse/pages/KcseCoverPage.tsx',
  'components/demo/kcse/pages/KcsePageHeader.tsx',
  'components/demo/kcse/pages/KcseTeacherPage.tsx',
  'lib/career/clinicPdfRenderer.tsx',
]

for (const surface of USER_FACING_SURFACES) {
  test(`terminology guard: ${surface} contains no rendered "Academic Clinic" / "Clinic Report" text`, () => {
    const rendered = renderedTextOnly(read(surface))
    assert.doesNotMatch(rendered, /Academic Clinic/,
      `${surface} must use "Learner Intelligence Report" for the canonical artifact, not the retired "Academic Clinic" name, in any rendered user-facing text`)
    assert.doesNotMatch(rendered, /\bClinic Report\b/,
      `${surface} must not render the retired "Clinic Report" short form`)
  })
}

test('positive check: the marketing/demo surfaces this phase corrected now use the canonical name', () => {
  for (const surface of [
    'app/(marketing)/components/HeroSlideshow.tsx',
    'app/(marketing)/components/ProductMockups.tsx',
    'components/demo/pages/CoverPage.tsx',
    'lib/career/clinicPdfRenderer.tsx',
  ]) {
    assert.match(read(surface), /Learner Intelligence Report/, `${surface} must reference the canonical name`)
  }
})

test('internal identifiers were NOT renamed — the freeze policy holds', () => {
  // lib/academicClinic/ as a directory/module must still exist and be
  // importable under its original name — proves this phase did not touch
  // stable plumbing merely to match the new user-facing vocabulary.
  const handler = read('lib/academicClinic/clinicPdfHandler.ts')
  assert.match(handler, /Academic Clinic PDF/, 'internal comments referencing the module by its historical name are expected to remain — only rendered user-facing text was retired')

  const config = read('lib/payments/config.ts')
  assert.match(config, /clinic_report/, 'the clinic_report token/feature key must remain unchanged — it is a stable internal identifier, not user-facing text')
})

test('the /academic-clinic compatibility route remains a redirect, not deleted', () => {
  const source = read('app/academic-clinic/page.tsx')
  assert.match(source, /redirect\(\s*['"]\/dashboard\/clinic['"]\s*\)/,
    'the Phase 2.3 compatibility redirect must remain intact for any stale bookmark/external link')
})
