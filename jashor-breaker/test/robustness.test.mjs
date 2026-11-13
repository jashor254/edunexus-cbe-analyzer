import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authorise, GuardRefusal } from '../core/guard.mjs'
import { run } from '../core/runner.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig, FAKE } from './helpers.mjs'

const adapters = { edunexus }
const CLI = new URL('../cli.mjs', import.meta.url).pathname
const refusal = (fn, re) => assert.throws(fn, (e) => e instanceof GuardRefusal && re.test(e.message))

test('malformed configs are refused as GuardRefusal, never a raw crash, and never echo their content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jb-cfg-'))
  const cases = {
    'broken.json': `{ "version": 1, ${FAKE.aws}`,
    'empty.json': '',
    'array.json': '[]',
    'null.json': 'null',
    'string.json': '"hello"',
    'number.json': '42',
    'wrong-version.json': JSON.stringify({ version: 2, defaultPolicy: 'deny', targets: [] }),
    'allow-policy.json': JSON.stringify({ version: 1, defaultPolicy: 'allow', targets: [] }),
    'no-targets.json': JSON.stringify({ version: 1, defaultPolicy: 'deny' }),
    'bad-id.json': JSON.stringify({ version: 1, defaultPolicy: 'deny', targets: [{ id: 'A B', adapter: 'x', kind: 'repository', path: '.', environment: 'development', allowedModes: ['passive'], authorisation: {} }] }),
  }
  for (const [name, content] of Object.entries(cases)) {
    const p = join(dir, name)
    writeFileSync(p, content)
    assert.throws(() => authorise({ configPath: p, targetId: 'x', mode: 'passive' }), (e) => {
      assert.ok(e instanceof GuardRefusal, `${name} -> ${e?.name}: ${e?.message}`)
      assert.ok(!e.message.includes(FAKE.aws), 'config content must not be echoed')
      return true
    })
  }
  refusal(() => authorise({ configPath: dir, targetId: 'x', mode: 'passive' }), /unreadable|No target config/)
})

test('odd target ids are refused', () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  const cfg = writeConfig(dir)
  for (const id of ['__proto__', 'constructor', '', ' fixture', 'fixture ', 'FIXTURE', 'fixture\0']) {
    refusal(() => authorise({ configPath: cfg, targetId: id, mode: 'passive' }), /not listed|never inferred/)
  }
})

test('unknown --check id is an error, not a silent zero-check run', async () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  await assert.rejects(run({ adapters, configPath: writeConfig(dir), targetId: 'fixture', only: ['no-such-check'] }), /Unknown check/)
})

test('adapter name that collides with Object.prototype is not resolved', async () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  await assert.rejects(run({ adapters, configPath: writeConfig(dir, { adapter: 'constructor' }), targetId: 'fixture' }), /No adapter registered/)
})

test('invalid adapter config is rejected before any check runs', async () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  const bad = { ...edunexus, loadConfig: () => ({ nodePolicy: { line: 'twenty-two' } }) }
  await assert.rejects(run({ adapters: { edunexus: bad }, configPath: writeConfig(dir), targetId: 'fixture' }), /Adapter config invalid/)
})

test('malformed package.json / lockfile surface as redacted check errors; other checks still run', async () => {
  const dir = makeRepo({
    'package.json': `{ "name": "${FAKE.aws}", oops`,
    'package-lock.json': `not json ${FAKE.github}`,
    '.nvmrc': '22\n',
  })
  const r = await run({ adapters, configPath: writeConfig(dir), targetId: 'fixture' })
  const failed = r.checkErrors.map((e) => e.checkId).sort()
  assert.deepEqual(failed, ['lockfile-sources', 'node-runtime'])
  const blob = JSON.stringify(r)
  assert.ok(!blob.includes(FAKE.aws) && !blob.includes(FAKE.github), 'parser messages must be redacted')
  assert.ok(r.checksRun.includes('secret-patterns') && r.checksRun.includes('actions-pinning'), 'unaffected checks still ran')
})

test('unexpected file contents do not crash the scan', async () => {
  const dir = makeRepo({
    'empty.txt': '',
    'crlf.ts': `const a = 1\r\nconst b = 2\r\n`,
    'unicode ünï/名前.ts': 'export const ok = true\n',
    'binary.dat': Buffer.from([0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]).toString('latin1'),
    'long-line.ts': 'x'.repeat(200_000),
    'only-newlines.txt': '\n\n\n',
  })
  const r = await run({ adapters, configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(r.checkErrors, [])
})

test('target that is not a git repository yields no tracked files and no crash', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jb-nogit-'))
  writeFileSync(join(dir, '.nvmrc'), '22.23.5\n')
  mkdirSync(join(dir, 'sub'))
  const r = await run({ adapters, configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(r.checkErrors, [])
  assert.equal(r.subject.gitHead, null)
})

test('CLI exit codes: usage 2, refusal 3, bad --fail-on 2, unknown check 2', () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  const cfg = writeConfig(dir)
  const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' })
  assert.equal(cli().status, 2)
  assert.equal(cli('nonsense').status, 2)
  assert.equal(cli('run').status, 3)
  assert.equal(cli('run', '--config', cfg).status, 3)
  assert.equal(cli('run', '--config', cfg, '--target', 'fixture', '--fail-on', 'extreme').status, 2)
  assert.equal(cli('run', '--config', cfg, '--target', 'fixture', '--check', 'nope').status, 2)
  assert.equal(cli('run', '--config', cfg, '--target', 'fixture', '--mode', 'active').status, 3)
  assert.equal(cli('run', '--config', cfg, '--target', 'fixture').status, 0)
})
