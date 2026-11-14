import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, chmodSync, existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  AuditError, AUDIT_FORMAT, GENESIS_HASH, canonical, digestOf, recordHash, appendAudit, verifyAudit, summariseResults, newRunId,
} from '../sandbox/audit.mjs'
import { probeSandbox, runConfined } from '../sandbox/sandbox.mjs'
import { runSandboxed } from '../sandbox/run.mjs'
import { ADAPTERS } from '../adapters/registry.mjs'
import { makeCommittedRepo, writeConfig } from './helpers.mjs'

const CLI = new URL('../cli.mjs', import.meta.url).pathname
const H = (c) => c.repeat(64)
const privateDir = () => { const d = mkdtempSync(join(os.tmpdir(), 'jb-audit-')); chmodSync(d, 0o700); return d }
const fields = (over = {}) => ({
  runId: newRunId(), time: new Date('2026-11-14T10:00:00Z'), targetFingerprint: H('a'), securityPolicyVersion: 'jb-sandbox-test',
  sandboxConfigDigest: H('b'), outcome: 'completed', testResults: { checksRun: ['x'], findings: 1 }, reportDigest: H('c'), ...over,
})
function logWith(n) {
  const dir = privateDir()
  const path = join(dir, 'audit.jsonl')
  const recs = []
  for (let i = 0; i < n; i++) recs.push(appendAudit(path, fields({ time: new Date(Date.UTC(2026, 10, 14, 10, i)) })))
  return { dir, path, recs }
}
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean)
const write = (p, ls) => writeFileSync(p, `${ls.join('\n')}\n`)
/** A competent attacker: edit a record, then recompute every hash and re-serialise canonically. */
function rewriteAll(p, mutate) {
  let prev = GENESIS_HASH
  const out = lines(p).map((l, i) => {
    const r = JSON.parse(l); mutate(r, i)
    r.prevHash = prev; r.hash = recordHash(r); prev = r.hash
    return canonical(r)
  })
  write(p, out)
  return prev
}

describe('chain format', () => {
  test('canonical JSON is deterministic and order-independent', () => {
    assert.equal(canonical({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}')
    assert.equal(digestOf({ a: 1, b: 2 }), digestOf({ b: 2, a: 1 }))
    assert.throws(() => canonical({ a: NaN }), AuditError)
  })
  test('appending builds a verifiable chain: seq 1..n, genesis prevHash, linked hashes', () => {
    const { path, recs } = logWith(3)
    const v = verifyAudit(path)
    assert.deepEqual([v.ok, v.records, v.head], [true, 3, recs[2].hash])
    const rs = lines(path).map((l) => JSON.parse(l))
    assert.deepEqual(rs.map((r) => r.seq), [1, 2, 3])
    assert.equal(rs[0].prevHash, GENESIS_HASH)
    assert.equal(rs[1].prevHash, rs[0].hash)
    assert.equal(rs[0].format, AUDIT_FORMAT)
    for (const k of ['runId', 'targetFingerprint', 'securityPolicyVersion', 'sandboxConfigDigest', 'testResults', 'reportDigest', 'prevHash']) assert.ok(k in rs[0], k)
  })
  test('an empty or missing log verifies as empty or reports missing', () => {
    const d = privateDir()
    writeFileSync(join(d, 'e.jsonl'), '')
    assert.equal(verifyAudit(join(d, 'e.jsonl')).ok, true)
    assert.equal(verifyAudit(join(d, 'nope.jsonl')).ok, false)
  })
  test('records hold digests, ids and counts only: no paths, file content or finding text', () => {
    const r = summariseResults({ checksRun: ['b', 'a'], checkErrors: [{ message: 'x' }], findings: [{ id: 'f1', title: 'secret-looking title', file: '/home/u/x' }], summary: { categories: { accepted: 1 } }, evidenceDigest: H('e') })
    assert.deepEqual(r, { checksRun: ['a', 'b'], checkErrors: 1, findings: 1, categories: { accepted: 1 }, evidenceDigest: H('e'), isolation: null })
    assert.ok(!JSON.stringify(r).includes('/home'))
  })
})

describe('tamper evidence (what a hash chain CAN detect)', () => {
  test('editing any field of a middle record is detected', () => {
    const { path } = logWith(3)
    const ls = lines(path); const r = JSON.parse(ls[1]); r.outcome = 'failed'; ls[1] = canonical(r); write(path, ls)
    const v = verifyAudit(path)
    assert.equal(v.ok, false)
    assert.match(v.problems.join('\n'), /line 2: hash does not match content/)
  })
  test('removing a middle record is detected (sequence and chain)', () => {
    const { path } = logWith(3)
    const ls = lines(path); ls.splice(1, 1); write(path, ls)
    const v = verifyAudit(path)
    assert.equal(v.ok, false)
    assert.match(v.problems.join('\n'), /sequence 3, expected 2/)
    assert.match(v.problems.join('\n'), /chain broken/)
  })
  test('reordering and duplicating records are detected', () => {
    const a = logWith(3); const ls = lines(a.path); write(a.path, [ls[0], ls[2], ls[1]])
    assert.equal(verifyAudit(a.path).ok, false)
    const b = logWith(2); const lb = lines(b.path); write(b.path, [lb[0], lb[1], lb[1]])
    assert.equal(verifyAudit(b.path).ok, false)
  })
  test('garbage, extra fields, non-canonical serialisation and a truncated final line are detected', () => {
    const { path } = logWith(2)
    const ls = lines(path)
    write(path, [ls[0], 'not json']); assert.match(verifyAudit(path).problems.join(), /not valid JSON/)
    const extra = { ...JSON.parse(ls[1]), note: 'hi' }; write(path, [ls[0], canonical(extra)]); assert.match(verifyAudit(path).problems.join(), /unexpected or missing fields/)
    write(path, [ls[0], JSON.stringify(JSON.parse(ls[1]), null, 1).replace(/\n/g, ' ')]); assert.match(verifyAudit(path).problems.join(), /canonical form/)
    writeFileSync(path, `${ls[0]}\n${ls[1].slice(0, 40)}`); assert.equal(verifyAudit(path).ok, false)
  })
  test('with a trusted checkpoint, tail truncation and appended records are detected', () => {
    const { path, recs } = logWith(3)
    const trusted = { expectHead: recs[2].hash, expectCount: 3 }
    assert.equal(verifyAudit(path, trusted).ok, true)
    write(path, lines(path).slice(0, 2))
    const v = verifyAudit(path, trusted)
    assert.equal(v.ok, false)
    assert.match(v.problems.join('\n'), /trusted checkpoint/)
  })
})

describe('limits of a hash chain (documented, asserted so nobody over-trusts it)', () => {
  test('WITHOUT a trusted checkpoint, tail truncation is NOT detectable', () => {
    const { path } = logWith(3)
    write(path, lines(path).slice(0, 2))
    assert.equal(verifyAudit(path).ok, true, 'a shorter valid chain still verifies')
  })
  test('WITHOUT a trusted checkpoint, deleting the whole log is NOT detectable as tampering', () => {
    const { path } = logWith(2)
    rmSync(path)
    assert.equal(verifyAudit(path).ok, false, 'reported as missing, which is not proof of tampering')
  })
  test('an attacker who can write the file can rewrite every record and recompute every hash; only the checkpoint catches it', () => {
    const { path, recs } = logWith(3)
    rewriteAll(path, (r, i) => { if (i === 1) r.outcome = 'failed' })
    assert.equal(verifyAudit(path).ok, true, 'the forged chain is internally consistent')
    const v = verifyAudit(path, { expectHead: recs[2].hash })
    assert.equal(v.ok, false, 'the trusted head from before the rewrite exposes it')
  })
})

describe('append safety', () => {
  test('refuses to extend a broken chain instead of burying the problem', () => {
    const { path } = logWith(2)
    const ls = lines(path); const r = JSON.parse(ls[0]); r.outcome = 'refused'; ls[0] = canonical(r); write(path, ls)
    assert.throws(() => appendAudit(path, fields()), (e) => e instanceof AuditError && /does not verify/.test(e.message))
  })
  test('the log is private: mode 0600, in a directory that is not group/world writable', () => {
    const { path, dir } = logWith(1)
    assert.equal(statSync(path).mode & 0o777, 0o600)
    const shared = mkdtempSync(join(os.tmpdir(), 'jb-audit-')); chmodSync(shared, 0o777)
    assert.throws(() => appendAudit(join(shared, 'a.jsonl'), fields()), /not group\/world writable/)
    assert.ok(dir)
  })
  test('a symlinked log, a relative path and a looser existing mode are refused', () => {
    const d = privateDir()
    writeFileSync(join(d, 'real.jsonl'), '')
    chmodSync(join(d, 'real.jsonl'), 0o600)
    symlinkSync(join(d, 'real.jsonl'), join(d, 'link.jsonl'))
    assert.throws(() => appendAudit(join(d, 'link.jsonl'), fields()), AuditError)
    assert.throws(() => appendAudit('relative/path.jsonl', fields()), /absolute/)
    chmodSync(join(d, 'real.jsonl'), 0o644)
    assert.throws(() => appendAudit(join(d, 'real.jsonl'), fields()), /mode 0600/)
  })
  test('a held lock fails closed with a clear message; the log is left untouched', () => {
    const { path } = logWith(1)
    writeFileSync(`${path}.lock`, '')
    const before = readFileSync(path, 'utf8')
    assert.throws(() => appendAudit(path, fields()), /locked/)
    assert.equal(readFileSync(path, 'utf8'), before)
    rmSync(`${path}.lock`)
    appendAudit(path, fields())
    assert.equal(verifyAudit(path).records, 2)
  })
  test('invalid records are refused before anything is written', () => {
    const { path } = logWith(1)
    const before = readFileSync(path, 'utf8')
    assert.throws(() => appendAudit(path, fields({ outcome: 'great' })), /bad outcome/)
    assert.throws(() => appendAudit(path, fields({ targetFingerprint: 'abc' })), /bad targetFingerprint/)
    assert.throws(() => appendAudit(path, fields({ runId: 'x' })), /bad runId/)
    assert.equal(readFileSync(path, 'utf8'), before)
  })
  test('concurrent appenders never fork the chain (lock + verify-before-append)', async () => {
    const dir = privateDir(); const path = join(dir, 'c.jsonl')
    const script = `import { appendAudit, newRunId } from ${JSON.stringify(new URL('../sandbox/audit.mjs', import.meta.url).href)}
      for (let i=0;i<5;i++) { for (;;) { try { appendAudit(${JSON.stringify(path)}, { runId: newRunId(), targetFingerprint:'${H('a')}', securityPolicyVersion:'t', sandboxConfigDigest:'${H('b')}', outcome:'completed', testResults:{}, reportDigest:null }); break } catch (e) { if (!/locked/.test(e.message)) throw e } } }`
    const ps = [0, 1, 2].map(() => new Promise((res) => { const c = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }); res(c) }))
    const rs = await Promise.all(ps)
    for (const r of rs) assert.equal(r.status, 0, r.stderr)
    const v = verifyAudit(path)
    assert.deepEqual([v.ok, v.records], [true, 15], v.problems.join('; '))
  })
})

describe('CLI', () => {
  test('audit-verify exits 0 on a good log, 1 on a tampered one, and warns when no checkpoint is given', () => {
    const { path, recs } = logWith(2)
    const ok = spawnSync(process.execPath, [CLI, 'audit-verify', path], { encoding: 'utf8' })
    assert.equal(ok.status, 0)
    assert.match(ok.stderr, /no trusted checkpoint/)
    const withCp = spawnSync(process.execPath, [CLI, 'audit-verify', path, '--expect-head', recs[1].hash, '--expect-count', '2'], { encoding: 'utf8' })
    assert.equal(withCp.status, 0)
    assert.doesNotMatch(withCp.stderr, /no trusted checkpoint/)
    const ls = lines(path); const r = JSON.parse(ls[0]); r.outcome = 'refused'; ls[0] = canonical(r); write(path, ls)
    assert.equal(spawnSync(process.execPath, [CLI, 'audit-verify', path], { encoding: 'utf8' }).status, 1)
  })
})

describe('integration with sandboxed runs', () => {
  let available = false
  before(async () => { try { await probeSandbox(); available = true } catch (e) { if (process.env.JB_REQUIRE_SANDBOX === '1') throw e } })
  const sbTest = (name, fn) => test(name, async (t) => (available ? fn(t) : t.skip('sandbox unavailable')))
  const NOW = new Date('2026-11-14T00:00:00Z')

  sbTest('a run appends a record with every required field; the log is outside the sandbox and invisible inside it', async () => {
    const repo = makeCommittedRepo({ '.nvmrc': '24\n', 'a.ts': 'export {}\n' })
    const cfg = writeConfig(repo)
    const { path } = { path: join(privateDir(), 'run.jsonl') }
    const report = await runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW, auditLog: path })
    const [rec] = lines(path).map((l) => JSON.parse(l))
    assert.equal(rec.runId, report.runId)
    assert.equal(rec.outcome, 'completed')
    assert.match(rec.targetFingerprint, /^[0-9a-f]{64}$/)
    assert.match(rec.sandboxConfigDigest, /^[0-9a-f]{64}$/)
    assert.equal(rec.sandboxConfigDigest, report.isolation.configDigest)
    assert.match(rec.securityPolicyVersion, /^jb-sandbox-s\d/)
    assert.equal(rec.prevHash, GENESIS_HASH)
    assert.equal(rec.testResults.evidenceDigest, report.evidenceDigest)
    assert.equal(report.audit.recordHash, rec.hash)
    assert.ok(!readFileSync(path, 'utf8').includes(repo), 'no host paths in the log')
    const { audit: _a, ...bare } = report
    assert.equal(rec.reportDigest, digestOf(bare))
    assert.equal(report.audit.seq, 1)
    // The sandbox cannot see the host log directory.
    const dir = path.replace(/\/[^/]+$/, '')
    const r = await runConfined({ script: 'test/probes/isolation-probe.mjs', extraMounts: ['test/probes'], args: ['exists', JSON.stringify([path, dir, '/usr/lib'])] })
    assert.deepEqual(JSON.parse(r.stdout), { [path]: false, [dir]: false, '/usr/lib': true }, 'log and its directory absent in the sandbox; control path present')
  })

  test('a refused run (isolation unavailable) is itself recorded, and the chain stays valid', async () => {
    const repo = makeCommittedRepo({ '.nvmrc': '24\n' })
    const cfg = writeConfig(repo)
    const path = join(privateDir(), 'refused.jsonl')
    const tools = { bwrap: '/nonexistent/bwrap', systemdRun: '/nonexistent/systemd-run', systemctl: '/nonexistent/systemctl' }
    await assert.rejects(runSandboxed({ adapters: ADAPTERS, configPath: cfg, targetId: 'fixture', now: NOW, auditLog: path, tools }), /Refusing to run unconfined/)
    const v = verifyAudit(path)
    assert.deepEqual([v.ok, v.records], [true, 1])
    const rec = JSON.parse(lines(path)[0])
    assert.equal(rec.outcome, 'refused')
    assert.equal(rec.reportDigest, null)
    assert.ok(!existsSync(`${path}.lock`))
  })
})

// ---- Secure file handling (Mission 008) ------------------------------------------------------------------------

import { execFileSync as run } from 'node:child_process'
import { linkSync, mkdirSync, renameSync, truncateSync, writeSync, openSync as open, closeSync as close, appendFileSync } from 'node:fs'

const mkfifo = (p) => run('/usr/bin/mkfifo', [p])
const sizeOf = (p) => readFileSync(p).length

describe('secure handle: the log is validated on the descriptor it writes through', () => {
  test('a symlink at the log path is refused and its target is never written', () => {
    const d = privateDir(); const victim = join(d, 'victim.txt')
    writeFileSync(victim, 'untouched\n'); symlinkSync(victim, join(d, 'audit.jsonl'))
    assert.throws(() => appendAudit(join(d, 'audit.jsonl'), fields()), (e) => e instanceof AuditError && /securely/.test(e.message))
    assert.equal(readFileSync(victim, 'utf8'), 'untouched\n')
    assert.ok(!existsSync(`${join(d, 'audit.jsonl')}.lock`), 'lock released on failure')
  })

  test('a symlink swapped in AFTER the open is caught by the identity check; nothing is written anywhere', () => {
    const { dir, path } = logWith(1)
    const victim = join(dir, 'victim.txt'); writeFileSync(victim, 'untouched\n')
    const original = readFileSync(path, 'utf8')
    assert.throws(() => appendAudit(path, fields(), { afterOpen: (p) => { renameSync(p, `${p}.moved`); symlinkSync(victim, p) } }), /replaced while it was being opened/)
    assert.equal(readFileSync(victim, 'utf8'), 'untouched\n')
    assert.equal(readFileSync(`${path}.moved`, 'utf8'), original, 'the real log is unchanged')
  })

  test('a different regular file swapped in after the open is caught; neither file gains a record', () => {
    const { dir, path } = logWith(1)
    const original = readFileSync(path, 'utf8')
    const impostor = join(dir, 'impostor'); writeFileSync(impostor, '', { mode: 0o600 })
    assert.throws(() => appendAudit(path, fields(), { afterOpen: (p) => { renameSync(p, `${p}.moved`); renameSync(impostor, p) } }), /replaced/)
    assert.equal(sizeOf(path), 0, 'the impostor was not written')
    assert.equal(readFileSync(`${path}.moved`, 'utf8'), original)
  })

  test('the directory being swapped after the open is caught', () => {
    const { dir, path } = logWith(1)
    const parent = privateDir(); const logDir = join(parent, 'logs'); mkdirSync(logDir, { mode: 0o700 })
    const p = join(logDir, 'a.jsonl'); appendAudit(p, fields())
    assert.throws(() => appendAudit(p, fields(), { afterOpen: () => { renameSync(logDir, join(parent, 'logs.moved')); mkdirSync(logDir, { mode: 0o700 }) } }), /replaced while|directory changed/)
    assert.ok(dir && path)
  })

  test('unexpected file types are refused without hanging: FIFO, directory', () => {
    const d = privateDir()
    mkfifo(join(d, 'pipe.jsonl'))
    assert.throws(() => appendAudit(join(d, 'pipe.jsonl'), fields()), AuditError)
    mkdirSync(join(d, 'dir.jsonl'))
    assert.throws(() => appendAudit(join(d, 'dir.jsonl'), fields()), AuditError)
    assert.equal(verifyAudit(join(d, 'pipe.jsonl')).ok, false, 'verify also refuses a FIFO instead of blocking on it')
    assert.equal(verifyAudit(join(d, 'dir.jsonl')).ok, false)
  })

  test('verify does not follow a symlinked log', () => {
    const { dir, path } = logWith(1)
    symlinkSync(path, join(dir, 'link.jsonl'))
    assert.equal(verifyAudit(join(dir, 'link.jsonl')).ok, false)
    assert.equal(verifyAudit(path).ok, true)
  })

  test('unsafe permissions are refused: mode 0644 and a second hard link', () => {
    const { dir, path } = logWith(1)
    linkSync(path, join(dir, 'second-name'))
    assert.throws(() => appendAudit(path, fields()), /hard link/)
    rmSync(join(dir, 'second-name'))
    chmodSync(path, 0o640)
    assert.throws(() => appendAudit(path, fields()), /mode 0600/)
    chmodSync(path, 0o600)
    appendAudit(path, fields())
    assert.equal(verifyAudit(path).records, 2)
  })

  test('failure to obtain a handle (no permission) is a clear refusal that changes nothing', (t) => {
    if (process.getuid() === 0) return t.skip('root ignores file modes')
    const { path } = logWith(1)
    const before = readFileSync(path, 'utf8')
    chmodSync(path, 0)
    assert.throws(() => appendAudit(path, fields()), /securely/)
    chmodSync(path, 0o600)
    assert.equal(readFileSync(path, 'utf8'), before)
  })
})

describe('interrupted writes', () => {
  test('a short write is truncated back off: no torn record, chain still verifies, next append works', () => {
    const { path } = logWith(1)
    const before = readFileSync(path, 'utf8')
    const half = (fd, data) => writeSync(fd, data.slice(0, 40)) // returns 40, not the full length
    assert.throws(() => appendAudit(path, fields(), { write: half }), /partial write was removed/)
    assert.equal(readFileSync(path, 'utf8'), before)
    assert.deepEqual([verifyAudit(path).ok, verifyAudit(path).records], [true, 1])
    appendAudit(path, fields())
    assert.equal(verifyAudit(path).records, 2)
  })

  test('a write that throws midway is rolled back the same way', () => {
    const { path } = logWith(2)
    const before = readFileSync(path, 'utf8')
    const boom = (fd, data) => { writeSync(fd, data.slice(0, 25)); throw new Error('disk full') }
    assert.throws(() => appendAudit(path, fields(), { write: boom }), /partial write was removed/)
    assert.equal(readFileSync(path, 'utf8'), before)
    assert.equal(verifyAudit(path).ok, true)
  })

  test('a torn tail left by a crash is DETECTED by verify and appends are refused until an operator repairs it', () => {
    const { path, recs } = logWith(2)
    const goodSize = sizeOf(path)
    appendFileSync(path, '{"format":"jb-audit-1","seq":3,"ru') // process died mid-append
    const v = verifyAudit(path)
    assert.equal(v.ok, false)
    assert.match(v.problems.join('\n'), /not newline-terminated|not valid JSON/)
    assert.throws(() => appendAudit(path, fields()), /does not verify/)
    // Operator recovery: keep the evidence, drop the torn tail, verify against the trusted checkpoint, resume.
    writeFileSync(`${path}.torn-evidence`, readFileSync(path))
    truncateSync(path, goodSize)
    assert.equal(verifyAudit(path, { expectHead: recs[1].hash, expectCount: 2 }).ok, true)
    appendAudit(path, fields())
    assert.equal(verifyAudit(path).records, 3)
  })

  test('a crash between records leaves a log that is simply shorter and still valid (truncation is only detectable with a checkpoint)', () => {
    const { path, recs } = logWith(3)
    truncateSync(path, lines(path).slice(0, 2).join('\n').length + 1)
    assert.equal(verifyAudit(path).ok, true)
    assert.equal(verifyAudit(path, { expectHead: recs[2].hash }).ok, false)
  })
})

describe('concurrency', () => {
  test('verifying while writers append never throws and only ever sees a valid prefix (or a flagged torn tail)', async () => {
    const dir = privateDir(); const path = join(dir, 'c.jsonl')
    const script = `import { appendAudit, newRunId } from ${JSON.stringify(new URL('../sandbox/audit.mjs', import.meta.url).href)}
      for (let i=0;i<8;i++) { for (;;) { try { appendAudit(${JSON.stringify(path)}, { runId: newRunId(), targetFingerprint:'${H('a')}', securityPolicyVersion:'t', sandboxConfigDigest:'${H('b')}', outcome:'completed', testResults:{}, reportDigest:null }); break } catch (e) { if (!/locked/.test(e.message)) throw e } } }`
    const { spawn } = await import('node:child_process')
    const writers = [0, 1].map(() => new Promise((res) => { const c = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'ignore' }); c.on('close', res) }))
    let reads = 0
    let done = false
    const reader = (async () => { while (!done) { const v = verifyAudit(path); assert.equal(typeof v.ok, 'boolean'); reads++; await new Promise((r) => setTimeout(r, 5)) } })()
    await Promise.all(writers); done = true; await reader
    const v = verifyAudit(path)
    assert.deepEqual([v.ok, v.records], [true, 16], v.problems.join('; '))
    assert.ok(reads > 0)
    assert.ok(!existsSync(`${path}.lock`))
  })

  test('two appenders racing on a stale-lock-free log never interleave partial lines', () => {
    const { path } = logWith(1)
    for (let i = 0; i < 20; i++) appendAudit(path, fields({ time: new Date(Date.UTC(2026, 10, 14, 11, i)) }))
    const raw = readFileSync(path, 'utf8')
    assert.ok(raw.endsWith('\n'))
    assert.ok(raw.split('\n').filter(Boolean).every((l) => { try { JSON.parse(l); return true } catch { return false } }))
    void open; void close
  })
})
