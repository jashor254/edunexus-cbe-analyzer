// Run: npx tsx --test lib/schoolConcepts/noAuthDuplication.test.ts
//
// Static guard, not a behavioral test: the capability integration layer
// must never itself query membership, evidence, projections, or RLS-backed
// tables — that authority stays entirely inside the real EduNexus
// destinations. This scans the integration layer's own source so that a
// future addition of, say, a `repos.evidence` or Supabase call in this
// folder fails CI immediately rather than being caught in review.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FORBIDDEN_PATTERNS = [
  /@\/lib\/repositories/,
  /@\/lib\/projection/,
  /@\/lib\/intelligence/,
  /@\/lib\/career/,
  /@\/utils\/supabase/,
  /createServiceClient/,
  /createClient/,
]

const FILES = [
  'lib/schoolConcepts/resolveCapability.ts',
  'lib/schoolConcepts/buildCapabilityLink.ts',
  'lib/schoolConcepts/getPortalCapabilities.ts',
  'components/school-concept/CapabilityEntry.tsx',
  'components/school-concept/PortalEntry.tsx',
  'components/school-concept/SiteHeader.tsx',
  'data/schoolConcepts/capabilityRegistry.ts',
  'app/school-concepts/[schoolSlug]/layout.tsx',
]

test('capability integration layer contains no data-access or authorization imports', () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  for (const relativePath of FILES) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8')
    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(
        source,
        pattern,
        `${relativePath} matches forbidden pattern ${pattern} — the capability integration layer must never query data or perform authorization itself`
      )
    }
  }
})
