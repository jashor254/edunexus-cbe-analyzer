// Descriptor containment must never be silently skipped. Where it cannot be enforced the context refuses to start
// unless the caller explicitly opts in, and the report records which mode was used.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { descriptorContainmentSupport, readRegularFile } from '../core/safeopen.mjs'
import { createContext } from '../core/context.mjs'
import { run } from '../core/runner.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig } from './helpers.mjs'

const SAFEOPEN = new URL('../core/safeopen.mjs', import.meta.url).pathname
const linux = process.platform === 'linux'

describe('capability probe', () => {
  test('this host: supported when Linux with a usable /proc, and the answer comes from actually doing it', (t) => {
    if (!linux) return t.skip('not Linux')
    assert.deepEqual(descriptorContainmentSupport(), { supported: true })
  })
  test('non-Linux platforms are reported unsupported with a reason', () => {
    for (const platform of ['darwin', 'win32', 'freebsd']) {
      const r = descriptorContainmentSupport({ platform })
      assert.equal(r.supported, false)
      assert.match(r.reason, new RegExp(platform))
    }
  })
  test('Linux WITHOUT a usable /proc is detected, not assumed from the platform name', (t) => {
    if (!linux || !existsSync('/usr/bin/bwrap')) return t.skip('needs Linux + bwrap')
    const script = `import { descriptorContainmentSupport } from ${JSON.stringify(SAFEOPEN)}; console.log(JSON.stringify(descriptorContainmentSupport()))`
    const r = spawnSync('/usr/bin/bwrap', ['--ro-bind', '/', '/', '--tmpfs', '/proc', '--dev', '/dev', '--unshare-user', '--die-with-parent', '--', process.execPath, '--input-type=module', '-e', script], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    const out = JSON.parse(r.stdout)
    assert.equal(out.supported, false)
    assert.match(out.reason, /\/proc/)
  })
})

describe('createContext', () => {
  const repo = () => makeRepo({ 'a.txt': 'x\n' })

  test('refuses to start where containment is unavailable, with an actionable message', () => {
    assert.throws(() => createContext(repo(), {}, { platformForTests: 'darwin' }), /Descriptor-based containment is unavailable.*Refusing to read the target with path checks only.*allowPathOnlyContainment/s)
  })

  test('the explicit opt-in is recorded as path-only, and the path checks still refuse an escaping symlink', () => {
    const dir = repo()
    const outside = realpathSync(mkdtempSync(join(os.tmpdir(), 'jb-cs-'))); writeFileSync(join(outside, 's'), 'OUTSIDE')
    symlinkSync(join(outside, 's'), join(dir, 'esc'))
    const ctx = createContext(dir, {}, { platformForTests: 'darwin', allowPathOnlyContainment: true })
    assert.equal(ctx.containment, 'path-only')
    assert.equal(ctx.read('a.txt'), 'x\n')
    assert.throws(() => ctx.read('esc'), /escapes target root/)
  })

  test('normal Linux mode is "descriptor"; the sandbox worker\'s read-only snapshot is "immutable-snapshot"', (t) => {
    if (!linux) return t.skip('not Linux')
    assert.equal(createContext(repo(), {}, {}).containment, 'descriptor')
    assert.equal(createContext(repo(), {}, { immutableRoot: true }).containment, 'immutable-snapshot')
  })

  test('the opt-in cannot be used to hide a supported platform: on Linux the strong mode is still chosen', (t) => {
    if (!linux) return t.skip('not Linux')
    assert.equal(createContext(repo(), {}, { allowPathOnlyContainment: true }).containment, 'descriptor')
  })
})

describe('reports and CLI', () => {
  test('a run records which containment mode protected the reads', async (t) => {
    if (!linux) return t.skip('not Linux')
    const dir = makeRepo({ '.nvmrc': '24\n', 'a.ts': 'export {}\n' })
    const r = await run({ adapters: { edunexus }, configPath: writeConfig(dir), targetId: 'fixture', now: new Date('2026-11-14') })
    assert.equal(r.subject.containment, 'descriptor')
  })

  test('the CLI accepts --allow-path-only-containment and still reports the strong mode on Linux', (t) => {
    if (!linux) return t.skip('not Linux')
    const dir = makeRepo({ '.nvmrc': '24\n', 'a.ts': 'export {}\n' })
    const out = mkdtempSync(join(os.tmpdir(), 'jb-cs-out-')); mkdirSync(out, { recursive: true })
    const r = spawnSync(process.execPath, [new URL('../cli.mjs', import.meta.url).pathname, 'run', '--config', writeConfig(dir), '--target', 'fixture', '--allow-path-only-containment', '--json'], { encoding: 'utf8' })
    assert.ok([0, 1].includes(r.status), r.stderr)
    assert.equal(JSON.parse(r.stdout).subject.containment, 'descriptor')
  })

  test('--sandbox with --allow-path-only-containment is refused, never silently downgraded', () => {
    const dir = makeRepo({ '.nvmrc': '24\n', 'a.ts': 'export {}\n' })
    const r = spawnSync(process.execPath, [new URL('../cli.mjs', import.meta.url).pathname, 'run', '--config', writeConfig(dir), '--target', 'fixture', '--sandbox', '--allow-path-only-containment'], { encoding: 'utf8' })
    assert.equal(r.status, 3)
    assert.match(r.stderr, /cannot be combined with --sandbox/)
    assert.equal(r.stdout, '')
  })

  test('readRegularFile still reads and refuses as before (no behavioural change where supported)', (t) => {
    if (!linux) return t.skip('not Linux')
    const d = realpathSync(mkdtempSync(join(os.tmpdir(), 'jb-cs-'))); writeFileSync(join(d, 'f'), 'ok')
    assert.deepEqual(readRegularFile(join(d, 'f'), { root: d }), { ok: true, text: 'ok' })
  })
})
