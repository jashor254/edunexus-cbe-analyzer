#!/usr/bin/env node
// scripts/run-deep-tests.mjs
//
// `npm run test:deep`. Refuses to run unless scripts/check-test-target.ts's
// preflight passes against an explicitly configured, verified
// non-production Supabase target (TEST_SUPABASE_URL,
// TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_SUPABASE_PROJECT_REF). Never falls
// back to .env.local or the production-named Supabase variables — if the
// TEST_* variables are absent, this command's job is to refuse, not to
// substitute a default. See docs/architecture — Phase H1S-FIX.
//
// KNOWN LIMITATION (see scripts/deep-tests.json's description and the
// H1S-FIX closeout report): for *.http.integration.test.ts files, this only
// protects the test process's own fixture-setup client. The HTTP requests
// those tests make hit a separately-running Next.js server whose own
// environment is untouched by this phase and must be independently pointed
// at a non-production target before those specific files are fully safe.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')

const preflight = spawnSync(tsx, [join(__dirname, 'check-test-target.ts')], {
  stdio: 'inherit',
  cwd: repoRoot,
  env: process.env, // deliberately NOT loading .env.local — TEST_* must already be set
})

if (preflight.status !== 0) {
  process.exit(preflight.status ?? 1)
}

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-tests.json'), 'utf8'))
const files = manifest.files

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
