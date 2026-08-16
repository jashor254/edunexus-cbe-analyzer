#!/usr/bin/env node
// scripts/check-standard-manifest.mjs
//
// Manifest-rot guard for scripts/standard-tests.json (the STANDARD_SAFE
// test set from Phase H1A). Runs before `npm test` / `npm run test:standard`.
// Not a compiler-level dependency analyzer — a cheap, fast tripwire that
// fails loudly if a STANDARD-classified file is edited to add a privileged
// or external-infrastructure signal, so the regression is caught before it
// silently runs unmocked against real infrastructure under the "safe"
// command. See docs/architecture — Phase H1S-FIX.
//
// Zero npm dependencies — pure Node, matches scripts/check-architecture.mjs.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const manifestPath = join(__dirname, 'standard-tests.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const files = manifest.files

// Always-flagged: direct or near-direct evidence of privileged/live
// infrastructure. A STANDARD file should never match any of these.
const ALWAYS_SIGNALS = [
  /createServiceClient/,
  /createTestServiceClient/,
  /@supabase\//,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /TEST_SUPABASE/,
  /signInWithPassword/,
  /auth\.admin/,
  /BASE_URL/,
  /LMS_TEST_BASE_URL/,
  /httpAuthTestHelper/,
]

// AI-boundary signals: only a rot indicator if the file does NOT also show
// evidence of intercepting the call (mock.module). Several already-verified
// STANDARD files legitimately reference `callDeepSeek` as the name being
// mocked (e.g. lib/academy/aiJudge.test.ts) — flagging those would be a
// false positive, not a real regression.
const AI_SIGNALS = [/callDeepSeek/, /routedCompletion/]
const MOCK_EVIDENCE = /mock\.module/

const missing = []
const violations = []

for (const relPath of files) {
  const absPath = join(repoRoot, relPath)
  if (!existsSync(absPath)) {
    missing.push(relPath)
    continue
  }

  const content = readFileSync(absPath, 'utf8')
  const hits = []

  for (const pattern of ALWAYS_SIGNALS) {
    if (pattern.test(content)) hits.push(pattern.source)
  }

  const isMocked = MOCK_EVIDENCE.test(content)
  if (!isMocked) {
    for (const pattern of AI_SIGNALS) {
      if (pattern.test(content)) hits.push(pattern.source)
    }
  }

  if (hits.length > 0) {
    violations.push({ file: relPath, hits })
  }
}

if (missing.length > 0) {
  console.error('STANDARD manifest references files that no longer exist:')
  for (const f of missing) console.error(`  - ${f}`)
  console.error('')
}

if (violations.length > 0) {
  console.error('STANDARD manifest rot detected:')
  console.error('')
  for (const v of violations) {
    console.error(`  ${v.file}`)
    console.error(`    matched: ${v.hits.join(', ')}`)
  }
  console.error('')
  console.error('This test is classified STANDARD but now touches privileged/external infrastructure.')
  console.error('Reclassify intentionally before merging — move it out of scripts/standard-tests.json')
  console.error('into the DEEP pool, or revert the change that introduced the dependency.')
}

if (missing.length > 0 || violations.length > 0) {
  process.exit(1)
}

console.log(`STANDARD manifest OK — ${files.length} files verified, zero privileged-infrastructure signals`)
