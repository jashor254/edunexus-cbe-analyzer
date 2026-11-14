import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { run } from '../core/runner.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig } from './helpers.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const CLI = join(ROOT, 'cli.mjs')
const fixture = () => makeRepo({ '.nvmrc': '22.23.5\n', 'a.ts': 'export {}\n' })
const withChecks = (checks) => ({ edunexus: { ...edunexus, checks } })
const ok = { id: 'ok', title: 'ok', mode: 'passive', run: () => [] }

test('every non-passive or malformed mode is rejected, even for checks not selected', async () => {
  const dir = fixture()
  const cfg = writeConfig(dir)
  for (const mode of ['active', 'ACTIVE', 'Passive', 'passive ', '', undefined, null, 1, ['passive'], { toString: () => 'passive' }]) {
    const sneaky = { id: 'sneaky', title: 't', mode, run: () => [] }
    await assert.rejects(run({ adapters: withChecks([ok, sneaky]), configPath: cfg, targetId: 'fixture', only: ['ok'] }), /only passive/, `mode ${String(mode)}`)
  }
  await assert.rejects(run({ adapters: withChecks([{ id: 'x', title: 't', mode: 'passive' }]), configPath: cfg, targetId: 'fixture' }), /Malformed check/)
})

test('a check cannot flip its own mode, replace capabilities, or alter the check list at run time', async () => {
  const dir = fixture()
  const attempts = []
  const hostile = {
    id: 'hostile', title: 'h', mode: 'passive',
    run(ctx) {
      for (const [name, fn] of Object.entries({
        flipMode: () => { hostile.mode = 'active' },
        swapRun: () => { hostile.run = () => ['pwned'] },
        replaceRead: () => { ctx.read = () => 'x' },
        addNetwork: () => { ctx.fetch = () => 1 },
        mutateConfig: () => { ctx.adapterConfig.nodePolicy.minimumPatch = '0.0.0' },
      })) {
        try { fn(); attempts.push(`${name}: SUCCEEDED`) } catch (e) { attempts.push(`${name}: ${e.constructor.name}`) }
      }
      return []
    },
  }
  const list = [hostile]
  await run({ adapters: withChecks(list), configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(attempts, ['flipMode: TypeError', 'swapRun: TypeError', 'replaceRead: TypeError', 'addNetwork: TypeError', 'mutateConfig: TypeError'])
  assert.equal(hostile.mode, 'passive')
  assert.throws(() => list.push(ok), TypeError, 'check list is frozen')
})

test('the full EduNexus adapter makes no network calls', async () => {
  const dir = makeRepo({ '.nvmrc': '22\n', 'package.json': '{}', '.github/workflows/ci.yml': 'name: x\n' })
  const fetchSpy = mock.method(globalThis, 'fetch', async () => { throw new Error('network attempted') })
  const connectSpy = mock.method(net.Socket.prototype, 'connect', function () { throw new Error('socket attempted') })
  try {
    const r = await run({ adapters: { edunexus }, configPath: writeConfig(dir), targetId: 'fixture' })
    assert.deepEqual(r.checkErrors, [])
    assert.equal(fetchSpy.mock.callCount(), 0)
    assert.equal(connectSpy.mock.callCount(), 0)
  } finally {
    fetchSpy.mock.restore()
    connectSpy.mock.restore()
  }
})

test('CLI refuses any mode other than exactly "passive"', () => {
  const cfg = writeConfig(fixture())
  for (const mode of ['active', 'PASSIVE', 'passive,active', '']) {
    const res = spawnSync(process.execPath, [CLI, 'run', '--config', cfg, '--target', 'fixture', '--mode', mode], { encoding: 'utf8' })
    assert.equal(res.status, 3, `mode "${mode}"`)
  }
})

// ---- Source tripwire -------------------------------------------------------
// A lint-style guard that makes accidental active/network/write behaviour in
// core or adapters fail loudly in review. It is NOT a security boundary: a
// determined author can evade a regex. See docs/SAFETY.md.

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.mjs') ? [p] : []
  })
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const FORBIDDEN = [
  [/node:(http|https|http2|net|tls|dgram|dns|worker_threads|vm|cluster|inspector)['"]/, 'network/code-exec module'],
  [/\bfetch\s*\(/, 'fetch'], [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/, 'browser network API'],
  [/\beval\s*\(|new\s+Function\s*\(/, 'dynamic code'], [/\bimport\s*\(/, 'dynamic import'], [/\brequire\s*\(/, 'require'],
  [/process\.(binding|dlopen)|\bprocess\.env\b/, 'process internals / environment access'],
]
const WRITE_FS = /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|symlink|symlinkSync|chmod|chmodSync|truncate|truncateSync|createWriteStream)\s*\(/

test('source tripwire: core and adapters contain no network, dynamic-code, env or write primitives', () => {
  const targets = [...sources(join(ROOT, 'core')), ...sources(join(ROOT, 'adapters'))]
  assert.ok(targets.length >= 15, 'tripwire must actually be scanning files')
  for (const file of targets) {
    const rel = relative(ROOT, file)
    const src = strip(readFileSync(file, 'utf8'))
    for (const [re, what] of FORBIDDEN) assert.ok(!re.test(src), `${rel}: forbidden ${what}`)
    assert.ok(!WRITE_FS.test(src), `${rel}: filesystem write primitive (only cli.mjs may write reports)`)
    if (/child_process/.test(src)) assert.equal(rel, 'core/context.mjs', `${rel}: child_process is allowed only in core/context.mjs`)
  }
})

test('the only subprocess is git, with read-only subcommands, in one file', () => {
  const src = strip(readFileSync(join(ROOT, 'core/context.mjs'), 'utf8'))
  assert.equal((src.match(/execFileSync\(/g) ?? []).length, 1)
  assert.match(src, /new Set\(\['ls-files', 'rev-parse', 'status'\]\)/)
  assert.ok(!/\bexec\(|execSync|spawn\(|spawnSync/.test(src))
})

test('package has zero dependencies (nothing third-party can be pulled in implicitly)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.deepEqual(pkg.dependencies, {})
  assert.deepEqual(pkg.devDependencies, {})
})
