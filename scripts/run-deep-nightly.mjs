#!/usr/bin/env node
// scripts/run-deep-nightly.mjs — runs the DEEP_NIGHTLY manifest
// (scripts/deep-nightly-tests.json). Content-seed-dependent D1 scenarios —
// refuses to run unless the deterministic content seed
// (scripts/bootstrap-local-db/seed-test-content.sql) has actually been
// applied, checked by querying for its fixed-UUID sentinel row rather than
// trusting that the caller remembered to run it first.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')

const preflight = spawnSync(tsx, [join(__dirname, 'check-test-target.ts')], {
  stdio: 'inherit', cwd: repoRoot, env: process.env,
})
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-nightly-tests.json'), 'utf8'))

if (manifest.requiresContentSeed) {
  // Probed the same way the seed is applied (package.json db:seed:test-content):
  // docker exec into the local container. Plain `node` can't import
  // utils/supabase/test-service.ts (extensionless .ts imports), and under tsx
  // its named exports don't cross the CJS/ESM boundary into this .mjs.
  const probe = spawnSync('docker', [
    'exec', 'supabase_db_edunexus', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc',
    "SELECT 1 FROM sow_substrands WHERE id = '00000000-0000-4000-8000-000000000005'",
  ], { encoding: 'utf8' })
  if (probe.status !== 0 || probe.stdout.trim() !== '1') {
    console.error('REFUSE: DEEP_NIGHTLY requires the deterministic content seed.')
    console.error('Run `npm run db:seed:test-content` after the schema bootstrap first.')
    if (probe.stderr) console.error(probe.stderr.trim())
    process.exit(1)
  }
}

console.log(`DEEP_NIGHTLY: running ${manifest.files.length} files`)

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...manifest.files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
