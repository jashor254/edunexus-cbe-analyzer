// Run: npx tsx --test lib/schoolConcepts/getPortalCapabilities.test.ts
//
// Fixture school is entirely synthetic, matching the convention established
// in resolveCapability.test.ts — never registered, never a real route.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPortalCapabilities } from './getPortalCapabilities'
import { CAPABILITY_REGISTRY } from '@/data/schoolConcepts/capabilityRegistry'
import { getSchoolConcept } from '@/data/schoolConcepts'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

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

// ── 1. No-capability school (structurally represents current Kutus) ────────

test('a school with no capabilities key produces an empty portal list', () => {
  const school = makeFixtureSchool(undefined)
  assert.deepEqual(getPortalCapabilities(school), [])
})

test('Kutus Municipality School (the real, live config) produces an empty portal list', () => {
  const kutus = getSchoolConcept('kutus-municipality')
  assert.ok(kutus, 'expected the real kutus-municipality config to exist')
  assert.equal(kutus!.capabilities, undefined, 'Kutus must have no capabilities key at all')
  assert.deepEqual(getPortalCapabilities(kutus!), [])
})

// ── 2. Disabled capability ──────────────────────────────────────────────────

test('a school with parentPortal explicitly disabled produces an empty portal list', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: false } })
  assert.deepEqual(getPortalCapabilities(school), [])
})

// ── 3. Enabled capability ───────────────────────────────────────────────────

test('a school enabling parentPortal automatically produces one resolved entry', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const entries = getPortalCapabilities(school)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].state, 'enabled')
  assert.equal(entries[0].id, 'parentPortal')
})

// ── 4. Central destination, reused, not reconstructed ───────────────────────

test('the resolved entry destination is the registry-owned route', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const [entry] = getPortalCapabilities(school)
  assert.equal(entry.state, 'enabled')
  if (entry.state === 'enabled') assert.equal(entry.destination, CAPABILITY_REGISTRY.parentPortal.route)
})

// ── Role-ineligible with a deliberately supplied role hint ──────────────────

test('a role hint that does not match the capability yields an empty portal list', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  assert.deepEqual(getPortalCapabilities(school, { role: 'teacher' }), [])
})

// ── Determinism ──────────────────────────────────────────────────────────────

test('result order matches registry order, independent of how the school authored its config', () => {
  const school = makeFixtureSchool({ parentPortal: { enabled: true } })
  const registryOrder = Object.keys(CAPABILITY_REGISTRY)
  const resultOrder = getPortalCapabilities(school).map((c) => c.id)
  assert.deepEqual(
    resultOrder,
    registryOrder.filter((id) => resultOrder.includes(id as (typeof resultOrder)[number]))
  )
})

// ── Fail closed for malformed/unknown entries ────────────────────────────────

test('an unknown capability key in a school config is silently ignored, not thrown', () => {
  const school = makeFixtureSchool({
    // @ts-expect-error deliberately malformed for this test
    somethingNotRegistered: { enabled: true },
  })
  assert.doesNotThrow(() => getPortalCapabilities(school))
  assert.deepEqual(getPortalCapabilities(school), [])
})
