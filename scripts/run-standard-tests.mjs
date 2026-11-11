#!/usr/bin/env node
// scripts/run-standard-tests.mjs
//
// `npm test` / `npm run test:standard`. Runs ONLY the STANDARD_SAFE
// manifest (scripts/standard-tests.json) — deliberately does NOT load
// .env.local and does NOT auto-discover test files, so this command cannot
// accidentally grow to include a privileged/live test the way bare
// `node --test` auto-discovery used to. See docs/architecture — Phase
// H1S-FIX.
//
// Zero npm dependencies — pure Node, spawns tsx only to execute the tests.

import * as fs from 'node:fs'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  globSafe, resolveProblems, filesWithoutTests, reportAttributesTestsToFiles, countTestcases,
} from './standard-runner-support.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

// Manifest-rot guard runs first — a STANDARD file that has drifted into
// touching privileged infrastructure must fail loudly here, not run
// silently unmocked under the "safe" command.
const guard = spawnSync(process.execPath, [join(__dirname, 'check-standard-manifest.mjs')], {
  stdio: 'inherit',
  cwd: repoRoot,
})
if (guard.status !== 0) {
  process.exit(guard.status ?? 1)
}

const manifest = JSON.parse(readFileSync(join(__dirname, 'standard-tests.json'), 'utf8'))

// utils/supabase/test-service.test.ts and utils/supabase/service.test.ts
// are deliberately NOT in the manifest (and never should be): they are the
// safety-validation tests for createTestServiceClient() and the Phase 2C
// Step 0 production guard inside createServiceClient() itself, so they
// legitimately contain the exact strings (TEST_SUPABASE_*,
// createTestServiceClient, createServiceClient, SUPABASE_SECRET_KEY)
// the manifest rot-guard treats as privileged-infrastructure signals
// everywhere else. Both are still fully STANDARD-safe — pure env-var
// manipulation plus client construction that makes no network call — so
// they run here alongside the manifest rather than being scanned by the
// guard.
const files = [
  ...manifest.files,
  'utils/supabase/test-service.test.ts',
  'utils/supabase/service.test.ts',
]

// Node's test runner treats every file argument as a GLOB: a manifest path such
// as app/api/.../[learnerId]/... was read as a character class, matched nothing,
// and silently ran zero tests ("tests 0", exit 0). Glob-active characters are
// replaced by `?` and each pattern is proven to resolve to exactly its own file
// before anything runs; after the run, a JUnit report proves every registered
// file executed at least one test. See scripts/standard-runner-support.mjs.
if (typeof fs.globSync === 'function') {
  const problems = resolveProblems(files, fs.globSync, repoRoot)
  if (problems.length > 0) {
    console.error('STANDARD manifest entries that would not run as listed:')
    for (const p of problems) console.error(`  ${p.file}  ->  ${p.matches.length} match(es): ${p.matches.join(', ') || 'none'}`)
    process.exit(1)
  }
}

const reportDir = mkdtempSync(join(tmpdir(), 'standard-tests-'))
const junitPath = join(reportDir, 'results.xml')

// Deliberately no --env-file=.env.local — STANDARD tests must require zero
// Supabase/AI/payment/WhatsApp credentials. If a file secretly needs one,
// it should fail loudly here, not skip silently.
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')
const result = spawnSync(
  tsx,
  [
    '--experimental-test-module-mocks', '--test',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=junit', `--test-reporter-destination=${junitPath}`,
    ...files.map(globSafe),
  ],
  { stdio: 'inherit', cwd: repoRoot }
)

let silent = []
let report = null
try {
  report = readFileSync(junitPath, 'utf8')
} catch {
  report = null
} finally {
  rmSync(reportDir, { recursive: true, force: true })
}

if (report === null || countTestcases(report) === 0) {
  console.error('STANDARD run produced no readable JUnit results — cannot prove any registered file ran its tests.')
  process.exit(1)
}
if (reportAttributesTestsToFiles(report)) {
  silent = filesWithoutTests(files, report, repoRoot)
} else {
  console.warn('WARNING: this Node version\'s JUnit report does not name the file of each test; the per-file zero-test check was skipped.')
}
if (silent.length > 0) {
  console.error('STANDARD manifest files that executed ZERO tests (a passing run does not cover them):')
  for (const f of silent) console.error(`  ${f}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
