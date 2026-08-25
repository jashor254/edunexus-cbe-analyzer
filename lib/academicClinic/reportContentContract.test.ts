// lib/academicClinic/reportContentContract.test.ts
//
// Phase 3.1 (Learner Report Architecture — content-accuracy audit).
//
// Source-level guard (Option B from the phase brief: the smallest
// maintainable strategy — no new shared metadata list, no snapshot
// brittleness), matching the established convention in
// careerConvergence.architecture.test.ts / orphanedClinicPageClosure.test.ts
// / documentIdentityProvenance.test.ts.
//
// Proves report-specific delivery/promotional copy cannot silently drift
// back to promising content the Learner Intelligence Report does not
// render. Each prohibited phrase below was a REAL, found overclaim this
// phase corrected — see the Phase 3.1 closeout for the full audit:
//
//   "Behaviour Profile"       — a real Projection dimension (behaviour),
//                               but never read/rendered by this report.
//   "Future Readiness Score"  — no literal score exists; the real section
//                               (Senior-only) is three qualitative labels
//                               (University/Career Readiness, Pathway
//                               Progress), not a score.
//   "Top 5 Careers"           — the report shows at most 3 (topCareers is
//                               sliced to 3 in canonicalSeniorGuidance.ts).
//   "7-page"                  — the PDF is 3 pages per track (Junior 3,
//                               Senior 3), per pdfGenerator.tsx's own header
//                               comment and every rendered PageHeader's
//                               totalPages={3}.
//   "with costs"               — no cost/pricing figures appear anywhere in
//                               the generated report.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/reportContentContract.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
function read(relPath: string): string {
  return readFileSync(`${REPO_ROOT}${relPath}`, 'utf8')
}

const REPORT_DELIVERY_SURFACES = [
  'lib/email/reportEmail.ts',
  'lib/whatsapp/reportNotify.ts',
  'components/ui/empty-states.tsx',
  'app/teacher/classes/[classId]/page.tsx',
  'app/dashboard/page.tsx',
  'components/onboarding-tutorial.tsx',
]

const PROHIBITED_OVERCLAIMS: Array<{ phrase: RegExp; reason: string }> = [
  { phrase: /Behaviour Profile|Behavior Profile/, reason: 'not a section this report renders (behaviour is a real Projection dimension, but this report never reads it)' },
  { phrase: /Future Readiness Score/, reason: 'no literal score exists — the real Senior-only section is three qualitative readiness labels, not a score' },
  { phrase: /Top 5 Careers/, reason: 'the report shows at most 3 careers (canonicalSeniorGuidance.ts slices to 3)' },
  { phrase: /7-page/, reason: 'the PDF is 3 pages per track (Junior 3, Senior 3), not 7' },
  { phrase: /with costs/, reason: 'no cost/pricing figures appear anywhere in the generated report' },
]

for (const surface of REPORT_DELIVERY_SURFACES) {
  test(`content-contract guard: ${surface} contains no prohibited report overclaims`, () => {
    const source = read(surface)
    for (const { phrase, reason } of PROHIBITED_OVERCLAIMS) {
      assert.doesNotMatch(source, phrase, `${surface} must not claim "${phrase.source}" — ${reason}`)
    }
  })
}

test('the delivery email describes only sections the report actually renders', () => {
  const source = read('lib/email/reportEmail.ts')
  // Positive assertions: the replacement bullets must be present, proving
  // the fix landed, not just that the old phrases are gone.
  assert.match(source, /Academic Summary/)
  assert.match(source, /Trajectory/)
  assert.match(source, /Pathway.*Career Signals|Career Signals/)
  assert.match(source, /Recommended Focus/)
})

test('the delivery email states EduNexus provenance and distinguishes itself from the official Report Card', () => {
  const source = read('lib/email/reportEmail.ts').replace(/\s+/g, ' ')
  assert.match(source, /EduNexus's interpretation/)
  assert.match(source, /not the official school report card/i)
})

test('the "Your Report Includes" empty-state accurately reflects Junior/Senior-specific content, not a one-size-fits-all promise', () => {
  const source = read('components/ui/empty-states.tsx')
  assert.match(source, /Top 3 Careers/)
  assert.match(source, /Senior School/)
  assert.match(source, /Junior School/)
})

test('the PDF page count claimed in teacher-facing bulk-generation copy matches the real 3-page-per-track PDF', () => {
  const teacherCopy = read('app/teacher/classes/[classId]/page.tsx')
  const pdfSource = read('lib/academicClinic/pdfGenerator.tsx')
  // The PDF's own rendered page headers are the ground truth.
  assert.match(pdfSource, /totalPages=\{3\}/)
  assert.doesNotMatch(teacherCopy, /\d+-page/, 'teacher-facing copy should not assert a specific page count that could drift from the real PDF again')
})

test('stale "Learner Blueprint" naming does not return in the surfaces this phase corrected', () => {
  // app/teacher/classes/[classId]/page.tsx is deliberately excluded here — it
  // legitimately references the REAL Blueprint product elsewhere on the page
  // (holiday plans "shared... via the Learner Blueprint"), which must not be
  // flagged as a stale collision; this phase's own fixes to that file
  // (7-page/Academic Clinic branding) are covered by the other guards above.
  for (const surface of [
    'lib/email/reportEmail.ts',
    'lib/whatsapp/reportNotify.ts',
    'components/ui/empty-states.tsx',
    'app/shared/[token]/page.tsx',
  ]) {
    const source = read(surface)
    assert.doesNotMatch(source, /Learner Blueprint/, `${surface} must not reintroduce the Blueprint naming collision`)
  }
})

test('report-specific clinical/diagnosis authority language does not return in delivery copy', () => {
  for (const surface of REPORT_DELIVERY_SURFACES) {
    const source = read(surface)
    assert.doesNotMatch(source, /\bClinical\b|\bdiagnosis\b|\bdiagnostic report\b/i,
      `${surface} must not reintroduce misleading clinical/diagnostic authority language`)
  }
})

test('the share-link view branding matches the canonical name, not stale Clinic/Blueprint branding', () => {
  const source = read('app/shared/[token]/page.tsx')
  assert.match(source, /Learner Intelligence Report/)
  assert.doesNotMatch(source, /Academic Clinic/)
})
