#!/usr/bin/env node
// scripts/parent-http/run-parent-http-harness.mjs
//
// Phase P3.5 — the reusable HTTP regression harness Parent Portal phases
// P1/P2/P3 each independently improvised (P1 built it manually and threw it
// away; P2 and P3 both named "HTTP-layer regression not run" as a
// limitation because standing this up ad hoc was judged too large a
// side-quest each time). This script codifies the recipe P1's own closeout
// documented as having worked:
//
//   local Docker Supabase (already running via this repo's own
//   conventions, or started here) -> an isolated copy of the working tree
//   (rsync, excluding node_modules/.next/.git) with node_modules SYMLINKED
//   back to the real one (cheap — proven safe under `next dev --webpack`,
//   unlike Turbopack, which rejects a symlink pointing outside the
//   project root) -> `next dev --webpack` on a dedicated test port,
//   pointed at the local Supabase target via an isolated .env.local that
//   never touches the real one -> the requested *.http.integration.test.ts
//   manifest, run with TEST_BASE_URL/TEST_SUPABASE_* pointed at that
//   server -> teardown (kill the isolated server, remove the isolated
//   copy, leave the real working tree and any pre-existing `next dev`
//   process for this repo directory completely untouched).
//
// Command:
//   npm run test:parent-http
//   npm run test:parent-http -- --manifest scripts/parent-http/parent-http-tests.json
//   npm run test:parent-http -- --file lib/testing/parentPortalP1Convergence.http.integration.test.ts
//
// Safety model (Step 2 of the P3.5 mission): this script NEVER derives
// TEST_SUPABASE_* from .env.local (which points at production) — it always
// re-derives the target itself from `supabase status -o json` (the local
// CLI's own source of truth for the locally running stack) and then runs
// it through the SAME resolveTestTarget() production-recognition check
// every other DEEP test uses (utils/supabase/test-service.ts), so a local
// Supabase CLI pointed (misconfigured) at a remote/production URL is
// refused exactly the same way a hand-typed TEST_SUPABASE_URL would be.

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import net from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')

function log(msg) {
  console.log(`[parent-http-harness] ${msg}`)
}
function fail(msg) {
  console.error(`[parent-http-harness] REFUSE: ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------------
// Step 0 — parse args
// ---------------------------------------------------------------------
const args = process.argv.slice(2)
function argValue(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const manifestPath = argValue('--manifest')
const singleFile = argValue('--file')
const keepTree = args.includes('--keep-tree') // debugging escape hatch only

let files
if (singleFile) {
  files = [singleFile]
} else {
  const mpath = manifestPath ?? join(__dirname, 'parent-http-tests.json')
  if (!existsSync(mpath)) fail(`manifest not found: ${mpath}`)
  const manifest = JSON.parse(readFileSync(mpath, 'utf8'))
  files = manifest.files
}
if (!files || files.length === 0) fail('no test files resolved — empty manifest/--file')

// ---------------------------------------------------------------------
// Step 1-2 — derive + verify the local Supabase target. NEVER read
// .env.local here. Always re-derive from `supabase status`, the CLI's own
// live source of truth, then run it through the same production-rejection
// gate every other DEEP test uses.
// ---------------------------------------------------------------------
log('checking local Supabase status...')
let status
{
  const r = spawnSync('supabase', ['status', '-o', 'json'], { cwd: repoRoot, encoding: 'utf8' })
  if (r.status !== 0 || !r.stdout) {
    log('local Supabase not running — starting it (`supabase start`)...')
    const start = spawnSync('supabase', ['start'], { cwd: repoRoot, stdio: 'inherit' })
    if (start.status !== 0) fail('`supabase start` failed — cannot proceed without a local target')
    const r2 = spawnSync('supabase', ['status', '-o', 'json'], { cwd: repoRoot, encoding: 'utf8' })
    if (r2.status !== 0 || !r2.stdout) fail('`supabase status` failed even after `supabase start`')
    status = JSON.parse(r2.stdout)
  } else {
    status = JSON.parse(r.stdout)
  }
}

const TEST_SUPABASE_URL = status.API_URL
const TEST_SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY
const TEST_SUPABASE_ANON_KEY = status.ANON_KEY
if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY || !TEST_SUPABASE_ANON_KEY) {
  fail('`supabase status -o json` did not return API_URL/SERVICE_ROLE_KEY/ANON_KEY — cannot derive a target')
}

// Reuse the exact same production-rejection logic every other DEEP test
// uses (utils/supabase/test-service.ts's resolveTestTarget), by shelling
// out to the existing preflight script rather than re-implementing the
// check. TEST_SUPABASE_PROJECT_REF is always 'local-docker' for a URL that
// matches the 127.0.0.1/localhost shape — set explicitly here so a typo
// can never accidentally match.
const TEST_SUPABASE_PROJECT_REF = 'local-docker'

log('verifying target is not production (scripts/check-test-target.ts)...')
{
  const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')
  const check = spawnSync(tsx, [join(repoRoot, 'scripts', 'check-test-target.ts')], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_SUPABASE_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY,
      TEST_SUPABASE_PROJECT_REF,
    },
  })
  if (check.status !== 0) fail('production-safety preflight failed — see output above')
}

// Never log secret key values — only the target URL/ref, matching the
// existing check-test-target.ts convention.
log(`local Supabase target verified: ${TEST_SUPABASE_URL} (ref: ${TEST_SUPABASE_PROJECT_REF})`)

// ---------------------------------------------------------------------
// Step 4-5 — isolated Next dev strategy: rsync copy (excludes
// node_modules/.next/.git) + a SYMLINKED node_modules (proven above to
// work under `next dev --webpack`; only Turbopack rejects an
// out-of-project symlink, and this harness deliberately never uses
// Turbopack). This never touches the real working tree and never starts a
// second `next dev` inside it (Next 16.3 refuses a second instance per
// directory regardless of port).
// ---------------------------------------------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'edunexus-parent-http-'))
log(`isolated test tree: ${workDir}`)

function cleanupTree() {
  if (keepTree) {
    log(`--keep-tree set — leaving isolated tree at ${workDir} for inspection`)
    return
  }
  try {
    rmSync(workDir, { recursive: true, force: true })
    log('isolated test tree removed')
  } catch (e) {
    log(`WARNING: failed to remove isolated tree ${workDir}: ${e.message}`)
  }
}

log('copying working tree (excludes node_modules/.next/.git)...')
{
  const rsync = spawnSync(
    'rsync',
    ['-a', '--exclude', 'node_modules', '--exclude', '.next', '--exclude', '.git', `${repoRoot}/`, `${workDir}/`],
    { stdio: 'inherit' }
  )
  if (rsync.status !== 0) {
    cleanupTree()
    fail('rsync of working tree failed')
  }
}

{
  const ln = spawnSync('ln', ['-s', join(repoRoot, 'node_modules'), join(workDir, 'node_modules')], { stdio: 'inherit' })
  if (ln.status !== 0) {
    cleanupTree()
    fail('failed to symlink node_modules into the isolated tree')
  }
}

// Isolated .env.local — points ONLY at the local target, never at
// production, and lives only inside the throwaway copy. The real
// .env.local (production) is never read or modified by this script.
writeFileSync(
  join(workDir, '.env.local'),
  [
    `NEXT_PUBLIC_SUPABASE_URL=${TEST_SUPABASE_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${TEST_SUPABASE_ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${TEST_SUPABASE_SERVICE_ROLE_KEY}`,
    '',
  ].join('\n')
)

// ---------------------------------------------------------------------
// Step 6-9 — boot next dev --webpack on a free dedicated test port, wait
// for a real health endpoint (not a sleep).
// ---------------------------------------------------------------------
function findFreePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', () => resolve(findFreePort(preferred + 1)))
    srv.listen(preferred, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

let serverProc
let logFile

async function main() {
  // 3100 matches this repo's own existing HTTP-suite convention
  // (scripts/check-http-base-url-consistency.mjs's canonical default) —
  // preferred, not hardcoded-required: falls forward to the next free port
  // if 3100 is already bound (e.g. another wave running concurrently).
  const port = await findFreePort(3100)
  const baseUrl = `http://localhost:${port}`
  logFile = join(workDir, 'next-dev.log')

  log(`starting isolated next dev --webpack on ${baseUrl} (log: ${logFile})...`)
  serverProc = spawn('npx', ['next', 'dev', '--webpack', '-p', String(port)], {
    cwd: workDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group, so we can kill children (webpack workers) too
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: TEST_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: TEST_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: TEST_SUPABASE_SERVICE_ROLE_KEY,
    },
  })

  const chunks = []
  serverProc.stdout.on('data', (d) => chunks.push(d))
  serverProc.stderr.on('data', (d) => chunks.push(d))
  serverProc.on('exit', (code, signal) => {
    writeFileSync(logFile, Buffer.concat(chunks))
    if (code !== null && code !== 0 && !teardownStarted) {
      log(`isolated next dev exited early (code ${code}, signal ${signal}) — see ${logFile}`)
    }
  })

  const healthy = await waitForHealth(baseUrl, 60_000)
  writeFileSync(logFile, Buffer.concat(chunks))
  if (!healthy) {
    printServerLogTail(logFile)
    throw new Error(`isolated next dev never became healthy at ${baseUrl}/api/health within 60s`)
  }
  log(`isolated next dev healthy at ${baseUrl}`)

  // ---------------------------------------------------------------------
  // Step 10 — run the requested manifest against it.
  // ---------------------------------------------------------------------
  log(`running ${files.length} HTTP test file(s)...`)
  const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx')
  const testRun = spawnSync(
    tsx,
    ['--experimental-test-module-mocks', '--test', ...files],
    {
      cwd: repoRoot, // tests import from the REAL repo tree (unmodified source under test), only the SERVER runs from the isolated copy
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_SUPABASE_URL,
        TEST_SUPABASE_SERVICE_ROLE_KEY,
        TEST_SUPABASE_PROJECT_REF,
        NEXT_PUBLIC_SUPABASE_URL: TEST_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: TEST_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: TEST_SUPABASE_SERVICE_ROLE_KEY,
        TEST_BASE_URL: baseUrl,
      },
    }
  )

  writeFileSync(logFile, Buffer.concat(chunks))

  if (testRun.status !== 0) {
    log('one or more HTTP test files failed — dumping isolated next dev server log tail for debugging (Step 22):')
    printServerLogTail(logFile)
  }

  return testRun.status ?? 1
}

function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) })
        if (res.status < 500) return resolve(true)
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return resolve(false)
      setTimeout(attempt, 500)
    }
    attempt()
  })
}

function printServerLogTail(logFile) {
  try {
    const content = readFileSync(logFile, 'utf8')
    const lines = content.split('\n')
    const tail = lines.slice(-80).join('\n')
    console.error('----- isolated next dev server log (tail, secrets never printed by this harness) -----')
    console.error(tail)
    console.error('----- end server log tail -----')
  } catch {
    console.error(`(no server log available at ${logFile})`)
  }
}

// ---------------------------------------------------------------------
// Step 9 — teardown. Traps signals so nothing orphans; NEVER touches any
// other next dev process (this repo's own directory's dev server included
// — this harness only ever kills the process group it itself spawned).
// ---------------------------------------------------------------------
let teardownStarted = false
function teardown() {
  if (teardownStarted) return
  teardownStarted = true
  if (serverProc && serverProc.pid) {
    try {
      // Negative pid == kill the whole process group this harness spawned
      // (detached: true above) — never touches any other running process.
      process.kill(-serverProc.pid, 'SIGTERM')
    } catch {
      // already exited
    }
  }
  cleanupTree()
}

process.on('SIGINT', () => { teardown(); process.exit(130) })
process.on('SIGTERM', () => { teardown(); process.exit(143) })

main()
  .then((code) => {
    teardown()
    process.exit(code)
  })
  .catch((err) => {
    console.error(`[parent-http-harness] FATAL: ${err.message}`)
    teardown()
    process.exit(1)
  })
