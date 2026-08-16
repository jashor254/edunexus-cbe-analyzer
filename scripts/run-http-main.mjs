#!/usr/bin/env node
// scripts/run-http-main.mjs — runs the HTTP_MAIN manifest
// (scripts/http-main-tests.json). Assumes the caller has already
// bootstrapped the DB, built+started the local Next server, and run the
// sentinel/target-equality/base-URL checks — same contract as
// run-http-pr.mjs.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')

if (!process.env.TEST_BASE_URL) {
  console.error('REFUSE: TEST_BASE_URL is not set. HTTP_MAIN requires the canonical target explicitly.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(__dirname, 'http-main-tests.json'), 'utf8'))
console.log(`HTTP_MAIN: running ${manifest.files.length} files`)

const result = spawnSync(
  tsx,
  ['--experimental-test-module-mocks', '--test', ...manifest.files],
  { stdio: 'inherit', cwd: repoRoot, env: process.env }
)

process.exit(result.status ?? 1)
