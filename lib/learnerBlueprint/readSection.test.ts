// lib/learnerBlueprint/readSection.test.ts
//
// Run: npm test -- lib/learnerBlueprint/readSection.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSection, sectionNotInSnapshot } from './readSection'
import type { BlueprintSection } from './types'

type Dummy = { value: string }

const present: BlueprintSection<Dummy> = {
  status: 'available',
  owner: 'test',
  freshness: 'live',
  data: { value: 'real' },
}

test('a present section is returned untouched', () => {
  assert.equal(readSection(present, 'dummy'), present)
})

// The actual production failure this guards: a snapshot stored before a section
// existed has NO key for it, so the property is `undefined` while the type says
// otherwise. Reading `.status` off that is a TypeError, not a false.
test('a section missing from an older snapshot degrades instead of throwing', () => {
  for (const absent of [undefined, null]) {
    const section = readSection<Dummy>(absent, 'pathway readiness')
    assert.equal(section.status, 'unavailable')
    assert.equal(section.data, null)
    assert.equal(section.freshness, 'historical')
    assert.match(section.unavailableReason ?? '', /before pathway readiness existed/)
  }
})

test('a malformed payload value is treated as missing, not trusted', () => {
  for (const malformed of ['a string', 42, true, {}] as unknown[]) {
    const section = readSection<Dummy>(malformed as BlueprintSection<Dummy>, 'dummy')
    assert.equal(section.status, 'unavailable', `expected unavailable for ${JSON.stringify(malformed)}`)
  }
})

test('the reason names the section, so a parent is told why it is blank', () => {
  const section = sectionNotInSnapshot('senior school pathway')
  assert.match(section.unavailableReason ?? '', /senior school pathway/)
  assert.match(section.unavailableReason ?? '', /shown as it was written/)
})

test('the degraded section satisfies the BlueprintSection contract every renderer relies on', () => {
  const section = readSection<Dummy>(undefined, 'dummy')
  assert.deepEqual(
    Object.keys(section).sort(),
    ['data', 'freshness', 'owner', 'status', 'unavailableReason'],
  )
})
