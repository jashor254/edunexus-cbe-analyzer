// scripts/testManifestConsistency.test.ts
//
// Test Registry Reconciliation — proves scripts/standard-tests.json and
// scripts/excluded-tests.json cannot simultaneously claim, about the same
// file, "this is part of our trusted STANDARD gate" and "this is excluded
// because it fails under zero credentials." Neither manifest is read by any
// script that would catch the contradiction on its own — the STANDARD
// runner (run-standard-tests.mjs) never reads excluded-tests.json, and
// nothing reads standard-tests.json from excluded-tests.json's side —
// so a file fixed and added to STANDARD without also being removed from
// the exclusion registry (exactly what happened to capabilityExtractor.test.ts
// and careerMode.pure.test.ts) goes undetected until this test.
//
// Also verifies every path either manifest references actually exists on
// disk — the same MISSING FILE check check-tier-manifests.mjs already
// applies to the DEEP/HTTP tier manifests, applied here to these two
// registries since nothing else covers them.
//
// Run: npx tsx --test scripts/testManifestConsistency.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function readManifest(name: string): string[] {
  const parsed = JSON.parse(readFileSync(join(__dirname, name), 'utf8'))
  return parsed.files
}

test('no file appears in both standard-tests.json and excluded-tests.json', () => {
  const standard = new Set(readManifest('standard-tests.json'))
  const excluded = readManifest('excluded-tests.json')

  const overlap = excluded.filter(f => standard.has(f))
  assert.deepEqual(
    overlap,
    [],
    'A file cannot be both "part of the trusted STANDARD gate" and "excluded because it fails under zero credentials." ' +
    `Remove from excluded-tests.json once genuinely fixed: ${overlap.join(', ')}`,
  )
})

test('every file referenced by standard-tests.json exists on disk', () => {
  const missing = readManifest('standard-tests.json').filter(f => !existsSync(join(ROOT, f)))
  assert.deepEqual(missing, [], `standard-tests.json references files that don't exist: ${missing.join(', ')}`)
})

test('every file referenced by excluded-tests.json exists on disk', () => {
  const missing = readManifest('excluded-tests.json').filter(f => !existsSync(join(ROOT, f)))
  assert.deepEqual(missing, [], `excluded-tests.json references files that don't exist: ${missing.join(', ')}`)
})
