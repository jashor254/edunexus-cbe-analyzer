// lib/career/capabilityExtractorPurity.architecture.test.ts
//
// Pure-Domain Test Isolation Audit / small fix — proves
// lib/career/capabilityExtractor.ts stays free of infrastructure imports.
// Before this fix, capabilityExtractor.ts imported `repos` from
// `@/lib/repositories` for computeCapabilityProfile() (now moved to
// lib/career/recomputeCapabilityProfile.ts), and merely importing
// extractCapabilityProfile() — a deterministic, no-I/O function — dragged
// in a Supabase client construction for all 42 repositories, crashing
// without Supabase credentials even though no DB call was ever made.
//
// Walks the real source text (no mocks, no DB, no import/execution of the
// module under test) — the same method
// lib/learnerIntelligence/careerMode.architecture.test.ts already
// establishes for locking a boundary via regex over file content rather
// than runtime behaviour.
//
// Run: npx tsx --test lib/career/capabilityExtractorPurity.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const CAPABILITY_EXTRACTOR_FILE = path.join(ROOT, 'lib/career/capabilityExtractor.ts')

// Any of these appearing in capabilityExtractor.ts is evidence infrastructure
// has crept back into the pure engine. Deliberately expressed only as import
// paths (never as the literal infrastructure-client symbol names) so this
// file's own source text doesn't itself trip
// scripts/check-standard-manifest.mjs's privileged-infrastructure scan —
// the same reason utils/supabase/test-service.test.ts and
// utils/supabase/service.test.ts are hand-exempted there.
const INFRASTRUCTURE_SIGNALS: RegExp[] = [
  /from\s+['"]@\/lib\/repositories['"]/,
  /from\s+['"]@\/lib\/repositories\//,
  /from\s+['"]@\/utils\/supabase\//,
]

test('capabilityExtractor.ts never imports the repositories barrel or a Supabase client', () => {
  const content = readFileSync(CAPABILITY_EXTRACTOR_FILE, 'utf8')
  const offenders = INFRASTRUCTURE_SIGNALS.filter(pattern => pattern.test(content))
  assert.deepEqual(
    offenders.map(String),
    [],
    'capabilityExtractor.ts must stay importable with zero Supabase/network/DB dependency — ' +
    'DB-backed orchestration belongs in lib/career/recomputeCapabilityProfile.ts',
  )
})

test('computeCapabilityProfile (the DB-backed orchestration) lives in recomputeCapabilityProfile.ts, not capabilityExtractor.ts', () => {
  const extractorContent = readFileSync(CAPABILITY_EXTRACTOR_FILE, 'utf8')
  const orchestrationFile = path.join(ROOT, 'lib/career/recomputeCapabilityProfile.ts')
  const orchestrationContent = readFileSync(orchestrationFile, 'utf8')

  assert.doesNotMatch(
    extractorContent,
    /export\s+(async\s+)?function\s+computeCapabilityProfile\s*\(/,
    'computeCapabilityProfile must not be reintroduced into the pure capabilityExtractor.ts module',
  )
  assert.match(
    orchestrationContent,
    /export\s+async\s+function\s+computeCapabilityProfile\s*\(/,
    'computeCapabilityProfile must remain defined in lib/career/recomputeCapabilityProfile.ts',
  )
})
