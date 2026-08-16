#!/usr/bin/env node
// scripts/check-http-base-url-consistency.mjs
//
// Invariant: no two HTTP DEEP test files may resolve a different server
// target during the same run. Scans every *.http.integration.test.ts file
// in scripts/deep-tests.json and fails if any file's base-URL line doesn't
// match the canonical pattern (TEST_BASE_URL, optionally falling back to
// legacy LMS_TEST_BASE_URL, with the shared default port). A file with a
// bespoke default port or a variable name outside this set would silently
// hit a different server than the rest of the suite -- exactly the drift
// H1D-2/H1D-3 found and fixed.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-tests.json'), 'utf8'))
const httpFiles = manifest.files.filter(f => f.endsWith('.http.integration.test.ts'))

const CANONICAL = /process\.env\.TEST_BASE_URL(\s*\?\?\s*process\.env\.LMS_TEST_BASE_URL)?\s*\?\?\s*'http:\/\/localhost:3100'/

let bad = []
for (const f of httpFiles) {
  const content = readFileSync(join(repoRoot, f), 'utf8')
  const match = content.match(/const BASE(?:_URL)?\s*=\s*(.+)/)
  if (!match) {
    bad.push([f, 'no BASE/BASE_URL assignment found'])
    continue
  }
  if (!CANONICAL.test(match[0])) {
    bad.push([f, match[0].trim()])
  }
}

if (bad.length > 0) {
  console.error(`HTTP base-URL consistency check FAILED: ${bad.length} file(s) diverge from the canonical pattern`)
  for (const [f, line] of bad) console.error(`  ${f}: ${line}`)
  process.exit(1)
}

console.log(`HTTP base-URL consistency check passed: ${httpFiles.length} files, all canonical (TEST_BASE_URL, default http://localhost:3100)`)
