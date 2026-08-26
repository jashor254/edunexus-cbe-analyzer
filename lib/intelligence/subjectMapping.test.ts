// lib/intelligence/subjectMapping.test.ts
//
// Phase 2A — Lossless Mathematics Evidence Identity. Proves the
// identity-safe normalizer used by Evidence ingestion (mapSubject) is
// genuinely distinct from lib/pathwayCalculator.ts's analytical
// normalizeSubjectKey(), and specifically that the one lossy alias
// (core_mathematics -> mathematics, intentional there for STEM-gate
// scoring) is NOT reachable through this identity-sensitive boundary.
//
// Run: npm test -- lib/intelligence/subjectMapping.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapSubject, normalizeSubjectKeyForIdentity } from './subjectMapping'
import { normalizeSubjectKey } from '@/lib/pathwayCalculator'

test('normalizeSubjectKeyForIdentity preserves Core Mathematics identity (the Phase 2A defect)', () => {
  assert.equal(normalizeSubjectKeyForIdentity('core_mathematics'), 'core_mathematics')
  assert.equal(mapSubject('core_mathematics').canonicalSubject, 'core_mathematics')
})

test('normalizeSubjectKeyForIdentity preserves Essential Mathematics identity — no regression', () => {
  assert.equal(normalizeSubjectKeyForIdentity('essential_mathematics'), 'essential_mathematics')
  assert.equal(mapSubject('essential_mathematics').canonicalSubject, 'essential_mathematics')
})

test('normalizeSubjectKeyForIdentity still expands the essential-maths shortcodes — those are lossless (one subject, two spellings), not a merge of two subjects', () => {
  assert.equal(normalizeSubjectKeyForIdentity('emat'), 'essential_mathematics')
  assert.equal(normalizeSubjectKeyForIdentity('essential maths'), 'essential_mathematics')
})

test('generic mathematics remains generic — never promoted to a variant', () => {
  assert.equal(normalizeSubjectKeyForIdentity('mathematics'), 'mathematics')
  assert.equal(mapSubject('Mathematics').canonicalSubject, 'mathematics')
})

test('non-Mathematics shortcode aliases are unaffected by the Phase 2A fix', () => {
  assert.equal(normalizeSubjectKeyForIdentity('geo'), 'geography')
  assert.equal(normalizeSubjectKeyForIdentity('csl'), 'community_service_learning')
  assert.equal(normalizeSubjectKeyForIdentity('business studies'), 'business_studies')
})

test('the analytical normalizer (pathwayCalculator.normalizeSubjectKey) is untouched and still intentionally collapses Core Mathematics into the broader Mathematics family', () => {
  assert.equal(normalizeSubjectKey('core_mathematics'), 'mathematics')
})

test('identity-safe and analytical normalizers now genuinely disagree on Core Mathematics — proving they are two different functions, not one reused in two places', () => {
  assert.notEqual(normalizeSubjectKeyForIdentity('core_mathematics'), normalizeSubjectKey('core_mathematics'))
})

// ── Phase 2B — trivial canonical-form hardening (case/whitespace only,
// never semantic) ──────────────────────────────────────────────────────

test('leading/trailing whitespace no longer fragments identity', () => {
  assert.equal(normalizeSubjectKeyForIdentity(' Mathematics '), 'mathematics')
  assert.equal(normalizeSubjectKeyForIdentity('Mathematics'), 'mathematics')
  assert.equal(normalizeSubjectKeyForIdentity('\tMathematics\n'), 'mathematics')
})

test('repeated internal whitespace collapses to one space before alias lookup', () => {
  assert.equal(normalizeSubjectKeyForIdentity('Business   Studies'), 'business_studies')
  assert.equal(normalizeSubjectKeyForIdentity('Business Studies'), 'business_studies')
})

test('case alone no longer creates two identities — Mathematics/mathematics/MATHEMATICS converge to one canonical key', () => {
  const variants = ['Mathematics', 'mathematics', 'MATHEMATICS', ' Mathematics '].map(normalizeSubjectKeyForIdentity)
  assert.equal(new Set(variants).size, 1)
  assert.equal(variants[0], 'mathematics')
})

test('trivial-format canonicalization still does not touch Core/Essential Mathematics semantic identity', () => {
  assert.equal(normalizeSubjectKeyForIdentity(' Core_Mathematics '), 'core_mathematics')
  assert.equal(normalizeSubjectKeyForIdentity(' Essential_Mathematics '), 'essential_mathematics')
  assert.notEqual(normalizeSubjectKeyForIdentity(' Core_Mathematics '), normalizeSubjectKeyForIdentity(' Mathematics '))
})

test('Junior School subjects normalize safely and are not given Senior canonical identity', () => {
  assert.equal(normalizeSubjectKeyForIdentity('Mathematics'), 'mathematics')
  assert.equal(normalizeSubjectKeyForIdentity('English'), 'english')
  assert.equal(normalizeSubjectKeyForIdentity('Kiswahili'), 'kiswahili')
  assert.equal(normalizeSubjectKeyForIdentity('integrated_science'), 'integrated_science')
  assert.equal(normalizeSubjectKeyForIdentity('social_studies'), 'social_studies')
  // None of these ever becomes a Senior-only identity (SS-* codes, Core/Essential variants).
  assert.notEqual(normalizeSubjectKeyForIdentity('Mathematics'), 'core_mathematics')
  assert.notEqual(normalizeSubjectKeyForIdentity('Mathematics'), 'essential_mathematics')
})

test('mapSubject: pure formatting differences (case/whitespace) are not reported as an alias mapping — only a real alias substitution is', () => {
  const formatOnly = mapSubject(' Mathematics ')
  assert.equal(formatOnly.canonicalSubject, 'mathematics')
  assert.equal(formatOnly.wasMapped, false, 'trim+lowercase alone is not an alias mapping')

  const realAlias = mapSubject('geo')
  assert.equal(realAlias.canonicalSubject, 'geography')
  assert.equal(realAlias.wasMapped, true, 'geo -> geography is a real alias substitution')
})
