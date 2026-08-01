// Run: npx tsx --test lib/schoolConcepts/kutusTruthfulness.test.ts
//
// Proves the Phase 4B non-negotiable rule structurally: Kutus shows no
// portal entry because it has no enabled capability, never because any file
// singles out its slug. If a future edit ever adds a
// `school.slug === 'kutus-municipality'` branch to make this true instead,
// this test fails.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { getPortalCapabilities } from './getPortalCapabilities'

const INTEGRATION_FILES = [
  'lib/schoolConcepts/getPortalCapabilities.ts',
  'lib/schoolConcepts/resolveCapability.ts',
  'components/school-concept/PortalEntry.tsx',
  'components/school-concept/SiteHeader.tsx',
  'app/school-concepts/[schoolSlug]/layout.tsx',
]

test('no integration file contains a school-slug conditional', () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  for (const relativePath of INTEGRATION_FILES) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8')
    assert.doesNotMatch(
      source,
      /slug\s*===\s*['"]kutus-municipality['"]/,
      `${relativePath} must not special-case Kutus by slug`
    )
    assert.doesNotMatch(source, /kutus/i, `${relativePath} must not reference Kutus at all — absence must be automatic from config`)
  }
})

test('Kutus resolves to zero portal capabilities purely from its own configuration', () => {
  const kutus = getSchoolConcept('kutus-municipality')
  assert.ok(kutus)
  assert.deepEqual(getPortalCapabilities(kutus!), [])
})

test('Kutus public nav contains no authenticated-capability entry', () => {
  const kutus = getSchoolConcept('kutus-municipality')
  assert.ok(kutus)
  for (const link of kutus!.nav) {
    assert.doesNotMatch(link.label, /portal|sign in|log in/i)
  }
})
