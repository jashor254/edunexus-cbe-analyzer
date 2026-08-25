// components/core/SchoolLetterhead.test.tsx
//
// Phase 3 (Learner Report Architecture — document identity/school authority).
//
// Proves: (1) the letterhead renders exactly the school it is given, never
// fabricating missing optional fields; (2) two different schools produce
// two genuinely different, non-mixed outputs — the practical, testable form
// of the cross-school branding isolation requirement, given the real trust
// boundary (report.school_id coming from an already-ownership-verified
// server-side lookup, never a client-supplied schoolId) lives in
// app/api/reports/report-card/route.ts, which requires a live DB to
// HTTP-test (environment-blocked in this sandbox, same limitation as every
// prior phase's HTTP suites).
//
// Run: npx tsx --experimental-test-module-mocks --test components/core/SchoolLetterhead.test.tsx
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { SchoolLetterhead, type SchoolLetterheadIdentity } from './SchoolLetterhead'

const SCHOOL_A: SchoolLetterheadIdentity = {
  school_name: 'Mwatate Ridge Senior School',
  logo_url: 'https://example.com/school-a-logo.png',
  motto: 'Excellence Through Discipline',
  address: 'P.O. Box 100, Voi',
  contact_phone: '+254700000001',
  contact_email: 'info@mwataterridge.ac.ke',
  nemis_code: 'A001',
}

const SCHOOL_B: SchoolLetterheadIdentity = {
  school_name: 'Kirinyaga Girls High School',
  logo_url: null,
  motto: null,
  address: null,
  contact_phone: null,
  contact_email: null,
  nemis_code: 'B002',
}

test('renders the full identity when every optional field is present', () => {
  const html = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_A} />)
  assert.match(html, /Mwatate Ridge Senior School/)
  assert.match(html, /Excellence Through Discipline/)
  assert.match(html, /P\.O\. Box 100, Voi/)
  assert.match(html, /\+254700000001/)
  assert.match(html, /info@mwataterridge\.ac\.ke/)
  assert.match(html, /NEMIS A001/)
  assert.match(html, /school-a-logo\.png/)
})

test('gracefully omits every missing optional field — no fabricated motto, address, phone, email, or logo', () => {
  const html = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_B} />)
  assert.match(html, /Kirinyaga Girls High School/)
  assert.match(html, /NEMIS B002/)
  assert.doesNotMatch(html, /<img/, 'no logo_url must mean no <img> tag at all, not a broken/placeholder image')
  // None of School A's optional values must leak in, and School B has none
  // of its own to render — confirms the component fabricates nothing.
  assert.doesNotMatch(html, /Excellence Through Discipline/)
  assert.doesNotMatch(html, /P\.O\. Box/)
})

test('CROSS-SCHOOL ISOLATION: School A\'s letterhead never contains School B\'s identity, and vice versa', () => {
  const htmlA = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_A} />)
  const htmlB = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_B} />)

  assert.match(htmlA, /Mwatate Ridge Senior School/)
  assert.doesNotMatch(htmlA, /Kirinyaga Girls High School/)

  assert.match(htmlB, /Kirinyaga Girls High School/)
  assert.doesNotMatch(htmlB, /Mwatate Ridge Senior School/)
})

test('an optional term/year context line is shown when supplied, and absent when not', () => {
  const withContext = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_A} contextLine="Term 2, 2026" />)
  assert.match(withContext, /Term 2, 2026/)

  const withoutContext = renderToStaticMarkup(<SchoolLetterhead school={SCHOOL_A} />)
  assert.doesNotMatch(withoutContext, /Term 2, 2026/)
})
