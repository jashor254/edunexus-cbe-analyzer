#!/usr/bin/env node
// scripts/run-deep-main.mjs — runs the DEEP_MAIN manifest (scripts/deep-main-tests.json).
// Broader deterministic D1 assurance, main-branch cadence. Same fail-closed
// target preflight as DEEP_PR — never falls back to .env.local. No content
// seed required (schema-only files); see run-deep-nightly.mjs for the
// content-seeded tier.

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

const manifest = JSON.parse(readFileSync(join(__dirname, 'deep-main-tests.json'), 'utf8'))
console.log(`DEEP_MAIN: running ${manifest.files.length} files`)

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...manifest.files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
