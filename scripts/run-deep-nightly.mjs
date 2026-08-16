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
import { createTestServiceClient } from '../utils/supabase/test-service.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')

const preflight = spawnSync(tsx, [join(__dirname, 'check-test-target.ts')], {
  stdio: 'inherit', cwd: repoRoot, env: process.env,
})
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-nightly-tests.json'), 'utf8'))

if (manifest.requiresContentSeed) {
  const db = createTestServiceClient()
  const { data, error } = await db
    .from('sow_substrands')
    .select('id')
    .eq('id', '00000000-0000-4000-8000-000000000005')
    .maybeSingle()
  if (error || !data) {
    console.error('REFUSE: DEEP_NIGHTLY requires the deterministic content seed.')
    console.error('Run `npm run db:seed:test-content` after the schema bootstrap first.')
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
