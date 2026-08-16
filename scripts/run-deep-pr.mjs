#!/usr/bin/env node
// scripts/run-deep-pr.mjs — runs the DEEP_PR manifest (scripts/deep-pr-tests.json).
//
// Same fail-closed target preflight as `npm run test:deep` (never falls
// back to .env.local), plus the H1E-A classification guard, before any
// test file executes.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')

const guard = spawnSync('node', [join(__dirname, 'check-deep-pr-classification.mjs')], {
  stdio: 'inherit', cwd: repoRoot,
})
if (guard.status !== 0) process.exit(guard.status ?? 1)

const preflight = spawnSync(tsx, [join(__dirname, 'check-test-target.ts')], {
  stdio: 'inherit', cwd: repoRoot, env: process.env,
})
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-pr-tests.json'), 'utf8'))

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...manifest.files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
