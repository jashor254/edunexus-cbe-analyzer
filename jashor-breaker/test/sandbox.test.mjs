import { test, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import os from 'node:os'
import { mkdtempSync, writeFileSync, readdirSync, chmodSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SandboxUnavailable, staticProbe, probeSandbox, buildArgv, normaliseLimits, createSnapshot, runConfined, DEFAULT_TOOLS,
} from '../sandbox/sandbox.mjs'
import { runSandboxed, acceptWorkerOutput } from '../sandbox/run.mjs'
import { authorise, GuardRefusal } from '../core/guard.mjs'
import { run } from '../core/runner.mjs'
import { ADAPTERS } from '../adapters/registry.mjs'
import { makeCommittedRepo, writeConfig, FAKE, FAKE_TAILS, assign } from './helpers.mjs'

const PROBE = { script: 'test/probes/isolation-probe.mjs', extraMounts: ['test/probes'] }
const snapDirs = () => readdirSync(os.tmpdir()).filter((n) => n.startsWith('jb-snap-')).length
const NOW = new Date('2026-11-13T00:00:00Z')

/** Run the probe confined and parse its JSON. */
async function probe(mode, arg = '', extra = {}) {
  const r = await runConfined({ ...PROBE, args: [mode, arg], ...extra })
  let json = null
  try { json = JSON.parse(r.stdout) } catch { /* not json */ }
  return { r, json }
}

let available = false
let why = ''
before(async () => {
  try { await probeSandbox(); available = true } catch (e) { why = e.message }
  // CI/gate runs set JB_REQUIRE_SANDBOX=1 so "cannot isolate" is a failure, never a silent skip.
  if (!available && process.env.JB_REQUIRE_SANDBOX === '1') throw new Error(`JB_REQUIRE_SANDBOX=1 but isolation unavailable: ${why}`)
})
// Decided at run time (after the probe in before()). Skipped tests are reported; JB_REQUIRE_SANDBOX=1 turns "unavailable" into a failure.
const sbTest = (name, fn) => test(name, async (t) => {
  if (!available) return t.skip(`sandbox unavailable on this host: ${why}`)
  return fn(t)
})

// A committed synthetic repo: one source file, one symlink to an absolute host path, one escaping relative link.
function fixture() {
  const dir = makeCommittedRepo(
    { 'src/a.ts': 'export const a = 1\n', 'package.json': '{"name":"x","engines":{"node":"24.x"}}\n' },
    { symlinks: { 'link-abs': '/etc/passwd', 'link-rel': '../../../../etc/passwd' }, untracked: { '.env.local': 'SYNTHETIC_ONLY=1\n' } },
  )
  const cfg = writeConfig(dir)
  return { dir, cfg, authorised: authorise({ configPath: cfg, targetId: 'fixture', mode: 'passive', now: NOW }) }
}

describe('fail closed', () => {
  test('missing mechanisms are reported and refuse to run (no unconfined fallback)', async () => {
    const tools = { bwrap: '/nonexistent/bwrap', systemdRun: '/nonexistent/systemd-run', systemctl: '/nonexistent/systemctl' }
    const s = staticProbe(tools)
    assert.equal(s.ok, false)
    assert.ok(s.missing.includes('bubblewrap') && s.missing.includes('systemd-run'))
    await assert.rejects(probeSandbox({ tools }), (e) => e instanceof SandboxUnavailable && /Refusing to run unconfined/.test(e.message))
  })

  sbTest('a weakened bwrap (extra host mount) is caught by the in-sandbox canary', async () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'jb-weak-'))
    const wrapper = join(dir, 'bwrap')
    writeFileSync(wrapper, '#!/bin/sh\nexec /usr/bin/bwrap --ro-bind /var /var "$@"\n')
    chmodSync(wrapper, 0o755)
    await assert.rejects(probeSandbox({ tools: { ...DEFAULT_TOOLS, bwrap: wrapper } }), (e) => e instanceof SandboxUnavailable && /canary failed/.test(e.message) && /\/var/.test(e.message))
  })

  test('runSandboxed refuses before creating any snapshot when isolation is unavailable', async () => {
    const { cfg } = fixture()
    const before = snapDirs()
    const tools = { bwrap: '/nonexistent/bwrap', systemdRun: '/nonexistent/systemd-run', systemctl: '/nonexistent/systemctl' }
    await assert.rejects(runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW, tools }), SandboxUnavailable)
    assert.equal(snapDirs(), before)
  })

  test('no authorisation, no sandbox: active mode, unlisted targets and placeholder configs are refused first', async () => {
    const { cfg } = fixture()
    const before = snapDirs()
    await assert.rejects(runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', mode: 'active', now: NOW }), GuardRefusal)
    await assert.rejects(runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'not-listed', now: NOW }), GuardRefusal)
    assert.throws(() => createSnapshot({ rootDir: '/', target: {}, configDir: '/' }), /explicit target authorisation/)
    assert.equal(snapDirs(), before)
  })
})

describe('sandbox source tripwire (review aid, not a boundary)', () => {
  const root = new URL('..', import.meta.url).pathname
  const read = (f) => readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
  const files = readdirSync(join(root, 'sandbox')).filter((f) => f.endsWith('.mjs'))

  test('nothing in sandbox/ imports a network or code-eval module, fetches, evals or dynamic-imports', () => {
    assert.ok(files.length >= 4)
    for (const f of files) {
      const src = read(`sandbox/${f}`)
      assert.ok(!/node:(http|https|http2|net|tls|dgram|dns|vm|cluster|inspector|worker_threads)['"]/.test(src), `${f}: network/code-exec module`)
      assert.ok(!/\bfetch\s*\(|\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(|\brequire\s*\(/.test(src), `${f}: fetch/eval/dynamic import/require`)
    }
  })

  test('child_process lives only in the host launcher; the in-sandbox worker and canary never spawn', () => {
    for (const f of files) {
      const uses = /child_process/.test(read(`sandbox/${f}`))
      assert.equal(uses, f === 'sandbox.mjs', `${f}: child_process use`)
    }
  })

  test('the host launcher uses absolute tool paths only (no PATH lookup) and never inherits the caller environment', () => {
    const src = read('sandbox/sandbox.mjs')
    assert.ok(!/\.\.\.process\.env|env:\s*process\.env|Object\.assign\([^)]*process\.env/.test(src), 'must not spread process.env into a child')
    for (const call of src.match(/(?:spawn|execFileSync)\(\s*[^,]+,/g) ?? []) assert.ok(/cmd|tools\.|'\/usr\/bin\//.test(call), `non-absolute launch: ${call}`)
    assert.ok(!/(?<![.\w])exec\(|execSync|spawnSync|shell:\s*true/.test(src))
  })

  test('only the first-party worker may be scheduled by the target runner; it takes no code from the target', () => {
    const src = read('sandbox/run.mjs')
    assert.equal((src.match(/runConfined\(\{/g) ?? []).length, 1)
    assert.match(src, /script: 'sandbox\/worker\.mjs'/)
  })
})

describe('confinement flags and input validation (no process needed)', () => {
  test('argv always carries the isolation set and never a writable host bind, shared network, home or docker path', () => {
    const { argv } = buildArgv({ script: 'sandbox/canary.mjs', unit: 'jb-test' })
    const s = argv.join(' ')
    for (const flag of ['--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts', '--unshare-cgroup', '--clearenv', '--die-with-parent', '--new-session', '--disable-userns']) assert.ok(argv.includes(flag), flag)
    assert.match(s, /--cap-drop ALL/)
    for (const forbidden of ['--bind ', '--bind-try', '--dev-bind', '--share-net', '--unshare-all']) assert.ok(!s.includes(forbidden), `must not contain ${forbidden}`)
    // Mount DESTINATIONS (what the sandbox can see) — sources legitimately live under the user's home (nvm node, this package).
    const dests = []
    argv.forEach((a, i) => { if (a === '--ro-bind') dests.push(argv[i + 2]); if (a === '--tmpfs' || a === '--proc' || a === '--dev') dests.push(argv[i + 1]) })
    for (const d of dests) assert.match(d, /^\/(usr\/lib|usr\/lib64|opt\/node\/node|proc|dev|scratch|tmp|target|meta|breaker\/(core|adapters|schemas|sandbox|package\.json))$/, `unexpected mount destination ${d}`)
    for (const d of dests) assert.ok(!/home|docker|^\/run|^\/var|^\/etc|\.ssh/.test(d), d)
    for (const prop of ['MemoryMax=', 'MemorySwapMax=0', 'CPUQuota=', 'TasksMax=', 'RuntimeMaxSec=']) assert.ok(s.includes(prop), prop)
  })

  test('limits cannot be disabled: unlimited, zero, negative, non-numeric and oversize are rejected', () => {
    for (const bad of [{ memoryMax: 'infinity' }, { memoryMax: '0M' }, { memoryMax: '64G' }, { cpuQuota: '0%' }, { cpuQuota: '9999%' }, { cpuQuota: 'max' },
      { tasksMax: 0 }, { tasksMax: 100000 }, { wallClockSec: 0 }, { wallClockSec: 86400 }, { scratchMiB: 9999 }, { memoryMax: '256M; rm -rf /' }]) {
      assert.throws(() => normaliseLimits(bad), undefined, JSON.stringify(bad))
    }
    assert.equal(normaliseLimits({}).memoryMiB, 256)
  })

  test('only first-party scripts inside mounted package subtrees can run; env is JB_* only', () => {
    for (const bad of ['/bin/sh', '../package.json', 'test/sandbox.test.mjs', 'core/guard.js', 'config/targets.edunexus-dev.json', '../../etc/x.mjs', 'core/../../x.mjs']) {
      assert.throws(() => buildArgv({ script: bad, unit: 'u' }), undefined, bad)
    }
    assert.throws(() => buildArgv({ script: 'sandbox/canary.mjs', unit: 'u', env: { AWS_SECRET: 'x' } }), /JB_\*/)
    assert.throws(() => buildArgv({ script: 'sandbox/canary.mjs', unit: 'u', snapshot: { treeDir: '/home/x', metaDir: '/home/y' } }), /createSnapshot/)
    assert.throws(() => buildArgv({ script: 'sandbox/canary.mjs', unit: 'u', extraMounts: ['../'] }), /escapes/)
  })

  test('worker output is untrusted: bad shape, undeclared checks and secret-bearing findings are rejected', () => {
    const declared = ['secret-patterns']
    const good = { id: 'JB-0123456789', checkId: 'secret-patterns', title: 'okay', severity: 'info', classification: 'unverified', rationale: 'fine here', evidence: [], reproduce: 'node cli', remediationHint: 'none' }
    assert.doesNotThrow(() => acceptWorkerOutput(JSON.stringify({ findings: [good], checkErrors: [], checksRun: declared }), declared))
    assert.throws(() => acceptWorkerOutput('nope', declared), /unparseable/)
    assert.throws(() => acceptWorkerOutput(JSON.stringify({ findings: 1 }), declared), /wrong shape/)
    assert.throws(() => acceptWorkerOutput(JSON.stringify({ findings: [{ ...good, checkId: 'other' }], checkErrors: [], checksRun: [] }), declared), /undeclared/)
    assert.throws(() => acceptWorkerOutput(JSON.stringify({ findings: [{ ...good, rationale: `leak ${FAKE.aws}` }], checkErrors: [], checksRun: [] }), declared), /secret/)
    assert.throws(() => acceptWorkerOutput(JSON.stringify({ findings: [{ ...good, severity: 'catastrophic' }], checkErrors: [], checksRun: [] }), declared), /validation/)
    const e = acceptWorkerOutput(JSON.stringify({ findings: [], checksRun: [], checkErrors: [{ checkId: 'x', message: `boom ${FAKE.github}` }] }), declared)
    assert.ok(!JSON.stringify(e).includes(FAKE.github))
  })
})

describe('isolation proofs (each runs a real confined process)', () => {
  sbTest('canary passes on this host', async () => {
    const p = await probeSandbox()
    assert.equal(p.canary.ok, true)
    assert.deepEqual(p.canary.interfaces, ['lo'])
  })

  sbTest('empty inherited environment: no production credentials, even when the caller has them', async () => {
    const planted = { SUPABASE_SECRET_KEY: FAKE.supabase, DEEPSEEK_AI_API_KEY: FAKE.generic, PAYSTACK_SECRET_KEY: FAKE.paystack, AWS_ACCESS_KEY_ID: FAKE.aws, GITHUB_TOKEN: FAKE.github, NODE_OPTIONS: '--require /nonexistent' }
    const saved = {}
    for (const [k, v] of Object.entries(planted)) { saved[k] = process.env[k]; process.env[k] = v }
    try {
      const { r, json } = await probe('env')
      assert.equal(r.code, 0, r.stderr)
      const keys = [...Object.keys(json.env), ...json.environKeys]
      for (const k of keys) assert.ok(['PATH', 'HOME', 'TMPDIR', 'LANG', 'PWD'].includes(k) || k.startsWith('JB_'), `unexpected env key ${k}`)
      const blob = JSON.stringify(json)
      for (const v of Object.values(planted)) assert.ok(!blob.includes(v))
      for (const tail of FAKE_TAILS) assert.ok(!blob.includes(tail))
      assert.equal(json.env.HOME, '/scratch')
    } finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    }
  })

  sbTest('no home directory and no host filesystem: root contains only the allow-listed mounts', async () => {
    const hostDir = mkdtempSync(join(os.tmpdir(), 'jb-host-canary-'))
    const canary = join(hostDir, 'secret.txt')
    writeFileSync(canary, 'host-only canary')
    const home = os.homedir()
    const paths = [home, `${home}/.ssh`, `${home}/.claude`, `${home}/.bash_history`, '/home', '/root', '/etc/passwd', '/etc/shadow', '/proc/1/environ-host', canary, hostDir]
    const { r, json } = await probe('fs-read', JSON.stringify(paths))
    assert.equal(r.code, 0, r.stderr)
    for (const p of paths) assert.notEqual(json.results[p], 'ALLOWED', `${p} must not be readable`)
    for (const p of [home, '/home', canary, hostDir]) assert.equal(json.results[p], 'ENOENT', p)
    assert.deepEqual(json.root.filter((n) => !['breaker', 'dev', 'lib', 'lib64', 'meta', 'opt', 'proc', 'scratch', 'target', 'tmp', 'usr'].includes(n)), [])
    for (const n of ['home', 'root', 'etc', 'run', 'var', 'sys', 'mnt', 'media', 'srv', 'boot', 'bin', 'sbin']) assert.ok(!json.root.includes(n), n)
  })

  sbTest('no Docker socket and no /run: not present, not connectable', async () => {
    const paths = ['/var/run/docker.sock', '/run/docker.sock', '/var/run', '/run', '/run/user', `/run/user/${process.getuid()}`, '/var/lib/docker']
    const { json } = await probe('exists', JSON.stringify(paths))
    for (const p of paths) assert.equal(json[p], false, p)
    const net1 = await probe('net', JSON.stringify({ port: 9, abstract: 'jb-none' }))
    assert.ok(['ENOENT', 'ECONNREFUSED', 'ENETUNREACH'].includes(net1.json.results.dockerSock), net1.json.results.dockerSock)
  })

  sbTest('no network: only a private loopback; host loopback, host abstract sockets, internet and DNS all fail', async () => {
    let hits = 0
    const tcp = net.createServer((s) => { hits++; s.destroy() })
    const abstractName = `jb-test-${process.pid}-${Date.now()}`
    const abs = net.createServer((s) => { hits++; s.destroy() })
    await new Promise((res) => tcp.listen(0, '127.0.0.1', res))
    const abstractOk = await new Promise((res) => { abs.once('error', () => res(false)); abs.listen('\0' + abstractName, () => res(true)) })
    try {
      const { r, json } = await probe('net', JSON.stringify({ port: tcp.address().port, abstract: abstractName }))
      assert.equal(r.code, 0, r.stderr)
      assert.deepEqual(json.ifaces, ['lo'])
      for (const [name, outcome] of Object.entries(json.results)) assert.notEqual(outcome, 'CONNECTED', `${name} connected`)
      assert.notEqual(json.results.dns, 'RESOLVED')
      assert.equal(json.results.hostLoopback, 'ECONNREFUSED', 'host loopback listener must be unreachable')
      if (abstractOk) assert.equal(json.results.abstractHostSocket, 'ECONNREFUSED')
      assert.equal(hits, 0, 'the host-side listeners must never see a connection from the sandbox')
    } finally {
      tcp.close()
      abs.close()
    }
  })

  sbTest('processes: host PID space is invisible; /proc/1/root is the sandbox, not the host', async () => {
    const { json } = await probe('procs')
    assert.ok(json.pids.length <= 4, `saw ${json.pids.length} pids`)
    assert.equal(json.rootOfInit, 'ENOENT')
    assert.equal(json.cwdTarget, 'ENOENT')
  })

  sbTest('read-only target and package; dedicated scratch is writable, size-capped and not shared between runs', async () => {
    const { authorised } = fixture()
    const snapshot = createSnapshot(authorised)
    try {
      const { r, json } = await probe('fs-write', '', { snapshot })
      assert.equal(r.code, 0, r.stderr)
      for (const p of ['/x', '/opt/x', '/target/x', '/meta/x', '/breaker/core/x', '/usr/lib/x', '/opt/node/x', '/lib/x']) assert.equal(json[p], 'EROFS', p)
      assert.equal(json['/scratch/ok'], 'ALLOWED')
      assert.equal(json['/tmp/ok'], 'ALLOWED')
      const again = await probe('exists', JSON.stringify(['/scratch/ok', '/tmp/ok', '/scratch/big']), { snapshot })
      assert.deepEqual(again.json, { '/scratch/ok': false, '/tmp/ok': false, '/scratch/big': false }, 'scratch must not persist between runs')
    } finally {
      snapshot.cleanup()
    }
    const full = await probe('scratch-full', '', { limits: { scratchMiB: 4 } })
    assert.equal(full.json.err, 'ENOSPC')
    assert.ok(full.json.writtenMiB <= 4, `wrote ${full.json.writtenMiB} MiB into a 4 MiB scratch`)
  })

  sbTest('snapshot = committed files only: untracked secrets are absent and escaping symlinks lead nowhere', async () => {
    const { authorised } = fixture()
    const snapshot = createSnapshot(authorised)
    try {
      assert.equal(existsSync(join(snapshot.treeDir, '.env.local')), false)
      const { json } = await probe('fs-read', JSON.stringify(['/target/src/a.ts', '/target/.env.local', '/target/link-abs', '/target/link-rel']), { snapshot })
      assert.equal(json.results['/target/src/a.ts'], 'ALLOWED')
      assert.equal(json.results['/target/.env.local'], 'ENOENT')
      assert.equal(json.results['/target/link-abs'], 'ENOENT', 'absolute symlink to a host file must dangle inside the sandbox')
      assert.equal(json.results['/target/link-rel'], 'ENOENT')
      assert.match(snapshot.gitHead, /^[0-9a-f]{40}$/)
    } finally {
      snapshot.cleanup()
    }
  })

  sbTest('node --permission (defence in depth) also denies child processes in worker mode', async () => {
    const { json } = await probe('child-process', '', { permission: true })
    assert.equal(json.spawn, 'ERR_ACCESS_DENIED')
  })
})

describe('resource limits are enforced by the kernel, not by good behaviour', () => {
  sbTest('memory: allocation past MemoryMax is killed (no swap escape)', async () => {
    const { r } = await probe('mem', '', { limits: { memoryMax: '128M' } })
    assert.ok(!r.stdout.includes('SURVIVED'), 'process allocated 1 GiB under a 128M cap')
    assert.notEqual(r.code, 0)
    const last = Number((r.stdout.match(/alloc (\d+)/g) ?? ['alloc 0']).pop().split(' ')[1])
    assert.ok(last < 256, `reached ${last} MiB`)
  })

  sbTest('cpu: a busy loop gets about its quota, not a whole core', async () => {
    const { json } = await probe('cpu', '', { limits: { cpuQuota: '20%', wallClockSec: 30 } })
    assert.ok(json.cpuMs / json.wallMs < 0.5, `used ${json.cpuMs}ms CPU over ${json.wallMs}ms wall under a 20% quota`)
  })

  sbTest('tasks: process/thread creation is capped (fork-bomb containment)', async () => {
    const { json } = await probe('tasks', '', { limits: { tasksMax: 32 } })
    assert.ok(json.failed > 0, `spawned ${json.spawned}, failed ${json.failed}`)
    assert.ok(json.spawned < 80)
  })

  sbTest('wall clock: an infinite loop is killed at the limit', async () => {
    const r = await runConfined({ ...PROBE, args: ['spin'], limits: { wallClockSec: 2 } })
    assert.equal(r.timedOut, true)
    assert.notEqual(r.code, 0)
    assert.ok(r.durationMs < 12000, `took ${r.durationMs}ms`)
  })

  sbTest('output: a flood is cut off and the process killed', async () => {
    const r = await runConfined({ ...PROBE, args: ['flood'], limits: { maxOutputBytes: 64 * 1024 } })
    assert.equal(r.outputTruncated, true)
    assert.ok(r.stdout.length <= 64 * 1024)
  })
})

describe('end to end', () => {
  sbTest('sandboxed run: same findings (same digest) as the in-process run, redacted, with isolation block, snapshot cleaned up', async () => {
    const dir = makeCommittedRepo({
      'package.json': '{"name":"x","engines":{"node":">=20.9.0"}}\n',
      'src/leak.ts': 'const ' + assign('STRIPE_API_KEY', FAKE.generic) + '\nconst k = "' + FAKE.aws + '"\n',
      '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n',
    })
    const cfg = writeConfig(dir)
    const before = snapDirs()
    const sandboxed = await runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW })
    const inProcess = await run({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW })
    assert.equal(sandboxed.evidenceDigest, inProcess.evidenceDigest)
    assert.deepEqual(sandboxed.checkErrors, [])
    assert.ok(sandboxed.findings.length >= 3)
    const blob = JSON.stringify(sandboxed)
    assert.ok(!blob.includes(FAKE.aws) && !blob.includes(FAKE.generic))
    for (const tail of FAKE_TAILS) assert.ok(!blob.includes(tail))
    assert.equal(sandboxed.isolation.network, 'none')
    assert.equal(sandboxed.isolation.limits.memoryMiB, 256)
    assert.match(sandboxed.subject.gitHead, /^[0-9a-f]{40}$/)
    assert.equal(snapDirs(), before, 'snapshot directory must be removed after the run')
    // Reproducible: a second sandboxed run yields the identical digest.
    assert.equal((await runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW })).evidenceDigest, sandboxed.evidenceDigest)
  })
})
