import { spawn, execFileSync } from 'node:child_process'
import { accessSync, closeSync, constants, mkdirSync, mkdtempSync, openSync, realpathSync, rmSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { isAuthorised } from '../core/guard.mjs'
import { GIT_HARDENING_ARGS as GIT_HARDENING, GIT_SAFE_ENV, FILTER_CONFIG_QUERY, filterNeutralisers } from '../core/gitsafe.mjs'
import { buildSeccompProgram, seccompSupported, programDigest, SECCOMP_POLICY_VERSION } from './seccomp.mjs'
import { digestOf } from './audit.mjs'
import { planSnapshot, parseLsTree, blobIds, parseCatBatch, writePlan } from './snapshot.mjs'

/**
 * Sandbox S1 — passive-only confinement of Jashor Breaker's OWN first-party scripts.
 *
 * Layers (outermost first):
 *   systemd user scope  -> cgroup v2 limits: memory (no swap), CPU quota, task count, wall-clock
 *   bubblewrap          -> new user/pid/net/ipc/uts/cgroup namespaces, empty environment, tiny read-only
 *                          filesystem, read-only target snapshot, size-capped tmpfs scratch, no capabilities
 *   node --permission   -> (worker only) defence in depth; NOT relied on (see docs/SAFETY.md)
 *
 * This module never runs third-party or AI-generated code: the program is a fixed Node binary and the
 * script must be a first-party file under this package. It has no active-attack capability: there is no
 * network in the sandbox, the target is read-only, and callers need an authorise() result to snapshot a target.
 *
 * FAIL CLOSED: every required mechanism is probed (and a canary runs inside the sandbox) before use.
 * If anything is missing the caller gets SandboxUnavailable; there is no unconfined fallback.
 */

export class SandboxUnavailable extends Error {
  constructor(message, missing = []) {
    super(message)
    this.name = 'SandboxUnavailable'
    this.missing = missing
  }
}

export const PACKAGE_ROOT = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
/** Package subtrees mounted read-only into the sandbox. test/ and config/ are never mounted except via `extraMounts`. */
const CORE_MOUNTS = ['core', 'adapters', 'schemas', 'sandbox', 'package.json']

// Absolute paths only: no PATH lookup, so a poisoned PATH cannot substitute the isolation tools.
export const DEFAULT_TOOLS = Object.freeze({ bwrap: '/usr/bin/bwrap', systemdRun: '/usr/bin/systemd-run', systemctl: '/usr/bin/systemctl' })

export const DEFAULT_LIMITS = Object.freeze({
  memoryMax: '256M', cpuQuota: '100%', tasksMax: 64, wallClockSec: 60,
  scratchMiB: 32, tmpMiB: 8, maxOutputBytes: 4 * 1024 * 1024,
})
// Hard ceilings: a caller cannot ask for "unlimited".
const CEILING = { memoryMiB: 2048, cpuPct: 400, tasksMax: 512, wallClockSec: 600, scratchMiB: 256, tmpMiB: 64, maxOutputBytes: 32 * 1024 * 1024 }

const mem = (s) => {
  const m = /^(\d{1,5})([MG])$/.exec(String(s))
  if (!m) throw new Error(`Invalid memoryMax ${JSON.stringify(s)} (use e.g. 256M)`)
  const mib = Number(m[1]) * (m[2] === 'G' ? 1024 : 1)
  if (mib < 16 || mib > CEILING.memoryMiB) throw new Error(`memoryMax must be 16M..${CEILING.memoryMiB}M`)
  return mib
}
const int = (v, name, lo, hi) => {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`${name} must be an integer ${lo}..${hi}`)
  return v
}

/** Validate and normalise limits. Every value is range-checked because it ends up in a systemd property. */
export function normaliseLimits(input = {}) {
  const l = { ...DEFAULT_LIMITS, ...input }
  const cpu = /^(\d{1,3})%$/.exec(String(l.cpuQuota))
  if (!cpu || Number(cpu[1]) < 1 || Number(cpu[1]) > CEILING.cpuPct) throw new Error(`cpuQuota must be 1%..${CEILING.cpuPct}%`)
  return {
    memoryMiB: mem(l.memoryMax), cpuQuota: `${Number(cpu[1])}%`,
    tasksMax: int(l.tasksMax, 'tasksMax', 8, CEILING.tasksMax),
    wallClockSec: int(l.wallClockSec, 'wallClockSec', 1, CEILING.wallClockSec),
    scratchMiB: int(l.scratchMiB, 'scratchMiB', 1, CEILING.scratchMiB),
    tmpMiB: int(l.tmpMiB, 'tmpMiB', 1, CEILING.tmpMiB),
    maxOutputBytes: int(l.maxOutputBytes, 'maxOutputBytes', 1024, CEILING.maxOutputBytes),
  }
}

const isExecutable = (p) => { try { accessSync(p, constants.X_OK); return statSync(p).isFile() } catch { return false } }

/** Static capability probe (no process is started). Dynamic proof comes from probeSandbox(). */
export function staticProbe(tools = DEFAULT_TOOLS) {
  const missing = []
  if (process.platform !== 'linux') missing.push('linux')
  if (!isExecutable(tools.bwrap)) missing.push('bubblewrap')
  if (!isExecutable(tools.systemdRun)) missing.push('systemd-run')
  if (!isExecutable(tools.systemctl)) missing.push('systemctl')
  const uid = process.getuid?.()
  let controllers = ''
  try { controllers = readFileSync(`/sys/fs/cgroup/user.slice/user-${uid}.slice/user@${uid}.service/cgroup.controllers`, 'utf8') } catch { /* absent */ }
  for (const c of ['cpu', 'memory', 'pids']) if (!controllers.split(/\s+/).includes(c)) missing.push(`cgroup-controller:${c}`)
  if (!seccompSupported()) missing.push(`seccomp-policy:${process.arch}`)
  for (const d of ['/usr/lib', '/usr/lib64']) if (!existsSync(d)) missing.push(d)
  return { ok: missing.length === 0, missing }
}

/** Reject the host environment's secrets by construction: the launcher env is built, never inherited. */
function launcherEnv() {
  const uid = process.getuid()
  const env = { PATH: '/usr/bin:/bin', XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || `/run/user/${uid}` }
  if (process.env.DBUS_SESSION_BUS_ADDRESS) env.DBUS_SESSION_BUS_ADDRESS = process.env.DBUS_SESSION_BUS_ADDRESS
  return env
}

const REGISTRY = new WeakSet()
/** Snapshots created by createSnapshot() only: a caller cannot mount an arbitrary host directory as the target. */
export const isSnapshot = (x) => typeof x === 'object' && x !== null && REGISTRY.has(x)

/** true/false, or null (unknown) when repo-configured filters cannot be neutralised. Never runs a repo filter. */
function workingTreeDirty(git) {
  let configured = ''
  try { configured = git(FILTER_CONFIG_QUERY, { encoding: 'utf8' }) } catch { /* exit 1 = no filters configured */ }
  const neutral = filterNeutralisers(configured)
  if (neutral === null) return null
  return git([...neutral, 'status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0
}

/**
 * Export the COMMITTED tree of an authorised target into a private temp dir, plus a manifest of its paths.
 * Raw blobs are read with `git ls-tree` + `git cat-file --batch` (no archive, no tar, no attribute filters),
 * every entry is validated before anything is written (sandbox/snapshot.mjs), and nothing is written outside
 * the private temp dir. Uncommitted and untracked files (.env.local, scratch work) are never present.
 * Requires the result of authorise().
 * @param {ReturnType<import('./guard.mjs').authorise>} authorised
 */
export function createSnapshot(authorised, { limits } = {}) {
  if (!isAuthorised(authorised)) throw new Error('Snapshot refused: not an authorise() result (explicit target authorisation is required)')
  const root = authorised.rootDir
  const base = mkdtempSync(join(tmpdir(), 'jb-snap-'))
  const treeDir = join(base, 'tree')
  const metaDir = join(base, 'meta')
  try {
    mkdirSync(treeDir, { mode: 0o700 })
    mkdirSync(metaDir, { mode: 0o700 })
    const git = (args, o = {}) => execFileSync('/usr/bin/git', [...GIT_HARDENING, '-C', root, ...args], { env: GIT_SAFE_ENV, maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...o })
    const head = git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const plan = planSnapshot(parseLsTree(git(['ls-tree', '-r', '-z', '-l', '--full-tree', 'HEAD'], { encoding: 'utf8' })), limits)
    const expected = new Map([...plan.files, ...plan.symlinkEntries].map((e) => [e.oid, e.size]))
    const ids = blobIds(plan)
    const contents = ids.length === 0 ? new Map() : parseCatBatch(git(['cat-file', '--batch'], { input: `${ids.join('\n')}\n`, stdio: ['pipe', 'pipe', 'ignore'] }), expected)
    const written = writePlan(plan, contents, treeDir)
    const droppedPaths = new Set(written.dropped.map((d) => d.path))
    const manifest = [...plan.files, ...plan.symlinkEntries].map((e) => e.path).filter((p) => !droppedPaths.has(p)).join('\0')
    writeFileSync(join(metaDir, 'files.txt'), manifest ? `${manifest}\0` : '')
    const handle = Object.freeze({
      treeDir, metaDir, gitHead: head,
      dirty: workingTreeDirty(git),
      stats: Object.freeze({ files: written.files, symlinks: written.symlinks, dropped: written.dropped.length, bytes: plan.totalBytes }),
      cleanup: () => rmSync(base, { recursive: true, force: true }),
    })
    REGISTRY.add(handle)
    return handle
  } catch (err) {
    rmSync(base, { recursive: true, force: true })
    throw err
  }
}

/** Resolve a first-party script (relative to the package root) that exists inside a mounted subtree. */
function resolveScript(script, mounts) {
  if (typeof script !== 'string' || !script.endsWith('.mjs') || script.includes('\0') || isAbsolute(script)) throw new Error('script must be a relative first-party .mjs path')
  const abs = realpathSync(join(PACKAGE_ROOT, script))
  const rel = relative(PACKAGE_ROOT, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('script escapes the Breaker package')
  const ok = mounts.some((m) => rel === m || rel.startsWith(m + sep))
  if (!ok) throw new Error(`script ${rel} is not inside a sandbox-mounted subtree (${mounts.join(', ')})`)
  return rel.split(sep).join('/')
}

/**
 * Build the full argv. Exported so tests can assert on the exact confinement flags.
 * @param {{script:string, args?:string[], snapshot?:object, limits?:object, extraMounts?:string[], permission?:boolean, unit:string, tools?:object, env?:Record<string,string>}} spec
 */
export function buildArgv(spec) {
  const tools = spec.tools ?? DEFAULT_TOOLS
  const limits = normaliseLimits(spec.limits)
  const extra = (spec.extraMounts ?? []).map((m) => {
    const abs = realpathSync(join(PACKAGE_ROOT, m))
    const rel = relative(PACKAGE_ROOT, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`extra mount escapes package: ${m}`)
    return rel.split(sep).join('/')
  })
  const mounts = [...CORE_MOUNTS, ...extra]
  const scriptRel = resolveScript(spec.script, mounts)
  if (spec.snapshot !== undefined && !isSnapshot(spec.snapshot)) throw new Error('snapshot must come from createSnapshot()')
  const node = realpathSync(process.execPath)
  const jbEnv = Object.entries(spec.env ?? {})
  for (const [k, v] of jbEnv) if (!/^JB_[A-Z0-9_]{1,40}$/.test(k) || typeof v !== 'string' || v.length > 4096 || v.includes('\0')) throw new Error(`env key ${k} not allowed (JB_* only, short strings)`)

  const bw = [
    '--unshare-user', '--unshare-ipc', '--unshare-pid', '--unshare-net', '--unshare-uts', '--unshare-cgroup', '--die-with-parent', '--new-session', '--cap-drop', 'ALL', '--disable-userns',
    '--seccomp', '3', // BPF program passed on fd 3 by runConfined (sandbox/seccomp.mjs)
    '--hostname', 'jb-sandbox',
    '--ro-bind', '/usr/lib', '/usr/lib', '--ro-bind', '/usr/lib64', '/usr/lib64',
    '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
    '--ro-bind', node, '/opt/node/node',
    '--proc', '/proc', '--dev', '/dev',
  ]
  for (const m of mounts) bw.push('--ro-bind', join(PACKAGE_ROOT, m), `/breaker/${m}`)
  if (spec.snapshot) bw.push('--ro-bind', spec.snapshot.treeDir, '/target', '--ro-bind', spec.snapshot.metaDir, '/meta')
  bw.push(
    '--size', String(limits.scratchMiB * 1024 * 1024), '--tmpfs', '/scratch',
    '--size', String(limits.tmpMiB * 1024 * 1024), '--tmpfs', '/tmp',
    // bwrap's root is an in-memory tmpfs and stays writable unless remounted: only /scratch and /tmp may be writable.
    '--remount-ro', '/',
    '--chdir', '/scratch',
    '--clearenv', '--setenv', 'PATH', '/opt/node', '--setenv', 'HOME', '/scratch', '--setenv', 'TMPDIR', '/tmp', '--setenv', 'LANG', 'C.UTF-8',
  )
  for (const [k, v] of jbEnv) bw.push('--setenv', k, v)
  const nodeFlags = spec.permission
    ? ['--permission', '--allow-fs-read=/breaker', '--allow-fs-read=/target', '--allow-fs-read=/meta', '--disallow-code-generation-from-strings']
    : []
  bw.push('--', '/opt/node/node', ...nodeFlags, `/breaker/${scriptRel}`, ...(spec.args ?? []))

  const sd = [
    '--user', '--scope', '--quiet', '--collect', '--unit', spec.unit,
    '-p', `MemoryMax=${limits.memoryMiB}M`, '-p', 'MemorySwapMax=0', '-p', 'MemoryHigh=infinity',
    '-p', `CPUQuota=${limits.cpuQuota}`, '-p', `TasksMax=${limits.tasksMax}`, '-p', `RuntimeMaxSec=${limits.wallClockSec}`,
    '--',
  ]
  return { cmd: tools.systemdRun, argv: [...sd, tools.bwrap, ...bw], limits }
}

/** Bump when ANY isolation property changes (flags, mounts, snapshot rules, seccomp policy). Recorded in every audit record. */
export const SANDBOX_POLICY_VERSION = 's2.1'
export const SECURITY_POLICY_VERSION = `jb-sandbox-${SANDBOX_POLICY_VERSION}/seccomp-${SECCOMP_POLICY_VERSION}/snapshot-1`

/**
 * Digest of the exact confinement configuration a run would use: bwrap/systemd flags (per-run names and snapshot
 * paths replaced by tokens), the seccomp program, the node and bwrap versions, and the limits. Two runs with the
 * same digest were isolated the same way.
 */
export function confinementDigest(spec) {
  const tools = spec.tools ?? DEFAULT_TOOLS
  const { argv, limits } = buildArgv({ ...spec, unit: 'jb-sandbox-digest' })
  const norm = argv.map((a) => (a === 'jb-sandbox-digest' ? '<unit>' : spec.snapshot && a === spec.snapshot.treeDir ? '<target>' : spec.snapshot && a === spec.snapshot.metaDir ? '<meta>' : a))
  let bwrapVersion = 'unknown'
  try { bwrapVersion = execFileSync(tools.bwrap, ['--version'], { env: launcherEnv(), encoding: 'utf8', timeout: 5000 }).trim() } catch { /* recorded as unknown */ }
  return digestOf({ policy: SECURITY_POLICY_VERSION, argv: norm, limits, seccompDigest: programDigest(buildSeccompProgram()), node: process.version, bwrap: bwrapVersion })
}

/**
 * Run a first-party script confined. Resolves (never throws) with the outcome so callers can assert on it.
 * @returns {Promise<{code:number|null, signal:string|null, stdout:string, stderr:string, timedOut:boolean, outputTruncated:boolean, durationMs:number}>}
 */
export function runConfined(spec) {
  const unit = `jb-sandbox-${randomBytes(6).toString('hex')}`
  const tools = spec.tools ?? DEFAULT_TOOLS
  const { cmd, argv, limits } = buildArgv({ ...spec, unit })
  // The seccomp program goes to bwrap on fd 3 via a private, immediately-unlinked file (0600 in a 0700 dir).
  const secDir = mkdtempSync(join(tmpdir(), 'jb-seccomp-'))
  const secFile = join(secDir, 'policy.bpf')
  writeFileSync(secFile, buildSeccompProgram(), { mode: 0o600 })
  const secFd = openSync(secFile, 'r')
  rmSync(secDir, { recursive: true, force: true })
  return new Promise((resolve) => {
    const started = Date.now()
    // cwd = filesystem root-ish neutral dir; env built from scratch (nothing inherited).
    const child = spawn(cmd, argv, { cwd: '/', env: launcherEnv(), stdio: ['ignore', 'pipe', 'pipe', secFd] })
    closeSync(secFd)
    let stdout = ''
    let stderr = ''
    let truncated = false
    let timedOut = false
    const kill = () => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      try { execFileSync(tools.systemctl, ['--user', 'kill', '--signal=SIGKILL', `${unit}.scope`], { env: launcherEnv(), stdio: 'ignore', timeout: 5000 }) } catch { /* scope already gone */ }
    }
    const timer = setTimeout(() => { timedOut = true; kill() }, limits.wallClockSec * 1000 + 3000)
    const take = (which) => (chunk) => {
      const room = limits.maxOutputBytes - (stdout.length + stderr.length)
      if (room <= 0) { if (!truncated) { truncated = true; kill() } return }
      const text = chunk.toString('utf8').slice(0, room)
      if (which === 'out') stdout += text; else stderr += text
      if (text.length < chunk.length) { truncated = true; kill() }
    }
    child.stdout.on('data', take('out'))
    child.stderr.on('data', take('err'))
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: null, signal: null, stdout, stderr: `spawn failed: ${err.code ?? err.message}`, timedOut, outputTruncated: truncated, durationMs: Date.now() - started }) })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      // systemd's RuntimeMaxSec kill surfaces as SIGKILL/SIGTERM after the limit, so classify by elapsed time too.
      const overran = Date.now() - started >= limits.wallClockSec * 1000
      resolve({ code, signal, stdout, stderr, timedOut: timedOut || (overran && signal !== null), outputTruncated: truncated, durationMs: Date.now() - started })
    })
  })
}

/**
 * Dynamic proof the isolation actually works on THIS host. Runs the first-party canary inside the sandbox;
 * the canary reports any violation it can observe. Throws SandboxUnavailable (fail closed) on any problem.
 */
export async function probeSandbox({ tools = DEFAULT_TOOLS } = {}) {
  const s = staticProbe(tools)
  if (!s.ok) throw new SandboxUnavailable(`Isolation unavailable: missing ${s.missing.join(', ')}. Refusing to run unconfined.`, s.missing)
  const r = await runConfined({ script: 'sandbox/canary.mjs', tools, limits: { wallClockSec: 20, memoryMax: '128M' } })
  let report
  try { report = JSON.parse(r.stdout) } catch { report = null }
  if (r.code !== 0 || !report || report.ok !== true) {
    const why = report?.violations?.join('; ') || r.stderr.slice(0, 200) || `exit ${r.code}/${r.signal}`
    throw new SandboxUnavailable(`Isolation canary failed: ${why}. Refusing to run unconfined.`, ['canary'])
  }
  return { ok: true, canary: report }
}
