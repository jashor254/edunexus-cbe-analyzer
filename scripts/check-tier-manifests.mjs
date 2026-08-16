#!/usr/bin/env node
// scripts/check-tier-manifests.mjs — cross-tier manifest safety (H1E-B).
//
// Validates:
//   - every manifest path actually exists on disk
//   - no file appears in more than one tier (PR is an intentional superset
//     concept only where documented — currently none overlap)
//   - no *.http.integration.test.ts file sits in a D1 (non-HTTP) manifest
//   - no HTTP_PR/HTTP_MAIN file resolves a non-canonical base URL
//   - no file already known ARCHITECTURE_EXCLUDED / REHEARSAL_ONLY /
//     APPLICATION_BLOCKED / CONTENT_SEED_REQUIRED (unresolved) sits in an
//     enforced tier

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const TIER_MANIFESTS = {
  DEEP_PR: 'deep-pr-tests.json',
  DEEP_MAIN: 'deep-main-tests.json',
  DEEP_SERIAL: 'deep-serial-tests.json',
  DEEP_NIGHTLY: 'deep-nightly-tests.json',
  HTTP_PR: 'http-pr-tests.json',
  HTTP_MAIN: 'http-main-tests.json',
}

// Known excluded/blocked files that must never appear in any enforced tier
// (H1D-3C findings). Kept here, not just in prose docs, so a future manifest
// edit can't silently reintroduce one of these without this check catching it.
const NEVER_ENFORCED = new Set([
  'lib/core/coreAssessmentTypeIntegrity.test.ts',        // FIXTURE_DEFECT
  'lib/projection/equivalenceHarness.integration.test.ts', // APPLICATION_BLOCKED
  'lib/learnerBlueprint/composeBlueprint.integration.test.ts', // CONTENT_SEED_REQUIRED (careers) unresolved
])

const CANONICAL_BASE_URL = /process\.env\.TEST_BASE_URL(\s*\?\?\s*process\.env\.LMS_TEST_BASE_URL)?\s*\?\?\s*'http:\/\/localhost:3100'/

let failed = false
const seenIn = new Map() // file -> tier name

for (const [tier, manifestFile] of Object.entries(TIER_MANIFESTS)) {
  const path = join(__dirname, manifestFile)
  if (!existsSync(path)) {
    console.log(`(skip) ${tier}: ${manifestFile} does not exist`)
    continue
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  const isHttp = tier.startsWith('HTTP')

  for (const file of manifest.files) {
    if (!existsSync(join(repoRoot, file))) {
      failed = true
      console.error(`MISSING FILE: ${tier} references ${file}, which does not exist on disk`)
      continue
    }

    if (NEVER_ENFORCED.has(file)) {
      failed = true
      console.error(`BLOCKED FILE IN TIER: ${file} is a known excluded/blocked file but appears in ${tier}`)
    }

    const isHttpFile = file.endsWith('.http.integration.test.ts')
    if (isHttp && !isHttpFile) {
      failed = true
      console.error(`WRONG TIER: ${file} is a D1 file but appears in HTTP tier ${tier}`)
    }
    if (!isHttp && isHttpFile) {
      failed = true
      console.error(`WRONG TIER: ${file} is an HTTP file but appears in D1 tier ${tier}`)
    }

    if (isHttp) {
      const content = readFileSync(join(repoRoot, file), 'utf8')
      const match = content.match(/const BASE(?:_URL)?\s*=\s*(.+)/)
      if (!match || !CANONICAL_BASE_URL.test(match[0])) {
        failed = true
        console.error(`NON-CANONICAL BASE URL: ${file} in ${tier}: ${match ? match[0].trim() : '(none found)'}`)
      }
    }

    if (seenIn.has(file)) {
      failed = true
      console.error(`CROSS-TIER DUPLICATE: ${file} appears in both ${seenIn.get(file)} and ${tier}`)
    } else {
      seenIn.set(file, tier)
    }
  }
}

if (failed) {
  console.error('')
  console.error('Tier manifest validation FAILED. Fix the manifests before trusting any tier built from them.')
  process.exit(1)
}

console.log(`Tier manifest validation passed: ${seenIn.size} files across ${Object.keys(TIER_MANIFESTS).length} tiers, no violations`)
