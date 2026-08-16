#!/usr/bin/env node
// scripts/run-http-pr.mjs — runs the HTTP_PR manifest (scripts/http-pr-tests.json).
//
// Assumes the caller has already: bootstrapped the local DB, built+started
// the local Next server, and run the sentinel/target-equality/base-URL
// checks (see scripts/bootstrap-local-db/README.md and the H1E-A CI job).
// This script only runs the classification guard + the manifest itself —
// it does not manage the server lifecycle, so it can be reused for both
// CI and local manual runs against an already-running server.

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

if (!process.env.TEST_BASE_URL) {
  console.error('REFUSE: TEST_BASE_URL is not set. HTTP_PR requires the canonical target explicitly.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(__dirname, 'http-pr-tests.json'), 'utf8'))

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...manifest.files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
