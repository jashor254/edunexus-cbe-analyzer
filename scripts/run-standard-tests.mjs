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

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

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
// createTestServiceClient, createServiceClient, SUPABASE_SERVICE_ROLE_KEY)
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

// Deliberately no --env-file=.env.local — STANDARD tests must require zero
// Supabase/AI/payment/WhatsApp credentials. If a file secretly needs one,
// it should fail loudly here, not skip silently.
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')
const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...files],
  { stdio: 'inherit', cwd: repoRoot }
)

process.exit(result.status ?? 1)
