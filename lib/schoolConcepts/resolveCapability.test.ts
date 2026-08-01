// Run: npx tsx --test lib/schoolConcepts/resolveCapability.test.ts
//
// Fixture school is entirely synthetic ("EduNexus Integration Test School")
// and is never registered in data/schoolConcepts/index.ts — it exists only
// in this test file and is never reachable as a real route. It proves the
// capability contract without implying any real school, including Kutus
// Municipality School, currently has an active EduNexus portal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSchoolCapability } from './resolveCapability'
import { CAPABILITY_REGISTRY } from '@/data/schoolConcepts/capabilityRegistry'
import type { CapabilityId, SchoolConceptConfig } from '@/data/schoolConcepts/types'

function makeFixtureSchool(capabilities?: SchoolConceptConfig['capabilities']): SchoolConceptConfig {
  return {
    slug: 'edunexus-integration-test-school',
    schoolName: 'EduNexus Integration Test School',
    shortDescription: 'A synthetic fixture used only by automated tests.',
    heroTagline: 'Not a real school.',
    levels: [],
    nav: [],
    contact: {
      phone: { label: 'Official telephone', value: 'To be provided', status: 'pending' },
      email: { label: 'Official email', value: 'To be provided', status: 'pending' },
      postalAddress: { label: 'Postal address', value: 'To be provided', status: 'pending' },
      physicalLocation: { label: 'Physical location', value: 'To be provided', status: 'pending' },
    },
    sampleNews: [],
    parentInfo: [],
    admissions: { documents: [], enquiryProcessSteps: [], faqs: [] },
    websiteFunctions: [],
    about: { intro: '', storyNote: '', missionNote: '' },
    theme: { primary: '#000', primaryDark: '#000', cream: '#fff', clay: '#000', charcoal: '#000' },
    conceptDisclaimer: 'Synthetic test fixture — not a real school.',
    publicationStatus: 'concept',
    capabilities,
  }
}

test('enabled entitlement: a school enabling parentPortal resolves to an available result', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const resolved = resolveSchoolCapability(school, 'parentPortal')
  assert.equal(resolved.state, 'enabled')
})

test('disabled entitlement: a school explicitly disabling parentPortal resolves to disabled', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: false } })
  const resolved = resolveSchoolCapability(school, 'parentPortal')
  assert.equal(resolved.state, 'disabled')
})

test('omitted entitlement: a school with no capabilities configured resolves to disabled', () => {
  const school = makeFixtureSchool(undefined)
  const resolved = resolveSchoolCapability(school, 'parentPortal')
  assert.equal(resolved.state, 'disabled')
})

test('central route: the resolved destination comes from the registry, never the school config', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const resolved = resolveSchoolCapability(school, 'parentPortal')
  assert.equal(resolved.state, 'enabled')
  if (resolved.state === 'enabled') {
    assert.equal(resolved.destination, CAPABILITY_REGISTRY.parentPortal.route)
  }
  // SchoolCapabilityOverride has no route field at all — this is enforced by
  // the type system, not just this assertion (see data/schoolConcepts/types.ts).
})

test('school-specific navLabel overrides the registry label; registry label is the fallback', () => {
  const withOverride = resolveSchoolCapability(
    makeFixtureSchool({ parentPortal: { enabled: true, navLabel: 'Family Portal' } }),
    'parentPortal'
  )
  assert.equal(withOverride.state, 'enabled')
  if (withOverride.state === 'enabled') assert.equal(withOverride.label, 'Family Portal')

  const withoutOverride = resolveSchoolCapability(makeFixtureSchool({ parentPortal: { enabled: true } }), 'parentPortal')
  assert.equal(withoutOverride.state, 'enabled')
  if (withoutOverride.state === 'enabled') assert.equal(withoutOverride.label, CAPABILITY_REGISTRY.parentPortal.label)
})

test('role hint: an unrelated role hides the entry even when the school has it enabled', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const resolved = resolveSchoolCapability(school, 'parentPortal', { role: 'teacher' })
  assert.equal(resolved.state, 'disabled')
})

test('role hint: the matching role keeps the entry visible', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const resolved = resolveSchoolCapability(school, 'parentPortal', { role: 'parent' })
  assert.equal(resolved.state, 'enabled')
})

test('unknown capability id fails closed rather than throwing', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const unknownId = 'somethingNotRegistered' as CapabilityId
  const resolved = resolveSchoolCapability(school, unknownId)
  assert.equal(resolved.state, 'disabled')
})

test('safe result: the resolved destination carries no learner, role, or internal identifiers', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const resolved = resolveSchoolCapability(school, 'parentPortal')
  assert.equal(resolved.state, 'enabled')
  if (resolved.state === 'enabled') {
    assert.doesNotMatch(resolved.destination, /[?&]/, 'destination must carry no query parameters')
    assert.doesNotMatch(resolved.destination, /[0-9a-f]{8}-[0-9a-f]{4}-/i, 'destination must contain no UUID-shaped identifier')
  }
})
