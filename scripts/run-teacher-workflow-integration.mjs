#!/usr/bin/env node
// scripts/run-teacher-workflow-integration.mjs — runs the TEACHER_WORKFLOW
// integration manifest (scripts/integration/teacher-workflow-tests.json).
//
// Assumes the caller has bootstrapped a local disposable Supabase and started
// an isolated Next server with scripts/integration/deepseek-stub.mjs preloaded
// (see the teacher-workflow-integration job in .github/workflows/ci.yml).
//
// Unlike a bare `tsx --test`, this runner treats the numbers as part of the
// contract. It fails when a file reports a different case count than the
// manifest, when any case is skipped / todo / cancelled, when a case prints a
// self-skip marker, when the provider stub never answered a request (so the
// server was not the isolated one), or when the stub blocked an outside
// destination.

import { readFileSync, existsSync } from 'node:fs'
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

if (!process.env.TEST_BASE_URL) {
  console.error('REFUSE: TEST_BASE_URL is not set. The integration server must be named explicitly.')
  process.exit(1)
}
const stubLog = process.env.STUB_LOG
if (!stubLog) {
  console.error('REFUSE: STUB_LOG is not set. Without the provider stub log the run cannot prove the server was isolated.')
  process.exit(1)
}

// recordOfWorkIntegrity and teachingWorkflowReliability read LMS_TEST_BASE_URL
// (default http://localhost:3939) and skip their route-level cases when no
// server answers there, so with only TEST_BASE_URL set they would pass while
// skipping. Point both names at the one canonical server for the children.
const childEnv = { ...process.env, LMS_TEST_BASE_URL: process.env.TEST_BASE_URL }

const manifest = JSON.parse(readFileSync(join(__dirname, 'integration', 'teacher-workflow-tests.json'), 'utf8'))
const failures = []
const rows = []
const counter = (out, label) => Number((out.match(new RegExp(`^# ${label} (\\d+)`, 'm')) ?? [])[1] ?? NaN)

for (const { file, expectedTests } of manifest.files) {
  if (!existsSync(join(repoRoot, file))) { failures.push(`${file}: file does not exist`); continue }

  const run = spawnSync(
    tsx,
    ['--experimental-test-module-mocks', '--test', '--test-reporter=tap', file],
    { cwd: repoRoot, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  process.stdout.write(run.stdout ?? '')
  process.stderr.write(run.stderr ?? '')
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`

  const row = {
    file,
    expected: expectedTests,
    tests: counter(out, 'tests'),
    pass: counter(out, 'pass'),
    fail: counter(out, 'fail'),
    skipped: counter(out, 'skipped'),
    todo: counter(out, 'todo'),
    cancelled: counter(out, 'cancelled'),
  }
  rows.push(row)

  if (run.status !== 0) failures.push(`${file}: runner exited ${run.status}`)
  if (row.tests !== expectedTests) failures.push(`${file}: ran ${row.tests} cases, manifest expects ${expectedTests}`)
  if (row.pass !== expectedTests) failures.push(`${file}: ${row.pass} passed, manifest expects ${expectedTests}`)
  for (const key of ['fail', 'skipped', 'todo', 'cancelled']) {
    if (row[key] !== 0) failures.push(`${file}: ${row[key]} ${key}`)
  }
  if (/\[skip\]/i.test(out)) failures.push(`${file}: a case printed a self-skip marker`)
}

const total = rows.reduce((n, r) => n + (Number.isFinite(r.pass) ? r.pass : 0), 0)
if (total !== manifest.expectedTests) failures.push(`total passed ${total}, manifest expects ${manifest.expectedTests}`)

const events = existsSync(stubLog)
  ? readFileSync(stubLog, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return {} } })
  : []
const stubbed = events.filter(e => e.ev === 'deepseek_stub')
const blocked = events.filter(e => e.ev === 'egress_blocked')
if (!events.some(e => e.ev === 'stub_loaded')) failures.push('provider stub never loaded in the server — the server is not the isolated one')
if (stubbed.length === 0) failures.push('the provider stub answered no request — generation did not run through the stub')
if (stubbed.some(e => e.authOk !== true)) failures.push('the stub saw a request without the fake key')
if (blocked.length > 0) failures.push(`${blocked.length} outside destination(s) were blocked: ${[...new Set(blocked.map(e => e.host))].join(', ')}`)

console.log('\nTEACHER_WORKFLOW summary')
for (const r of rows) {
  console.log(`  ${r.file}: ${r.pass}/${r.expected} passed, ${r.fail} failed, ${r.skipped} skipped, ${r.todo} todo, ${r.cancelled} cancelled`)
}
console.log(`  total passed: ${total}/${manifest.expectedTests}; stubbed provider calls: ${stubbed.length}; blocked egress: ${blocked.length}`)

if (failures.length > 0) {
  console.error('\nTEACHER_WORKFLOW FAILED:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('TEACHER_WORKFLOW passed')
