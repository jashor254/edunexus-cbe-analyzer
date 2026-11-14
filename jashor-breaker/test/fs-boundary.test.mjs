import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext } from '../core/context.mjs'
import { run } from '../core/runner.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { writeConfig, FAKE } from './helpers.mjs'

function repoWithLinks() {
  const outside = mkdtempSync(join(tmpdir(), 'jb-outside-'))
  writeFileSync(join(outside, 'secret.txt'), `outside ${FAKE.aws}\n`)
  mkdirSync(join(outside, 'dir'))
  writeFileSync(join(outside, 'dir', 'inner.txt'), 'inner-outside')
  const dir = mkdtempSync(join(tmpdir(), 'jb-boundary-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  writeFileSync(join(dir, 'a.txt'), 'inside')
  mkdirSync(join(dir, 'sub'))
  writeFileSync(join(dir, 'sub', 'b.txt'), 'sub-inside')
  symlinkSync(join(outside, 'secret.txt'), join(dir, 'link-out-file'))
  symlinkSync(outside, join(dir, 'link-out-dir'))
  symlinkSync('a.txt', join(dir, 'link-in'))
  symlinkSync('../../../../nonexistent-target', join(dir, 'link-dangling'))
  execFileSync('git', ['add', '-A'], { cwd: dir })
  return { dir, outside }
}

test('lexical escapes and malformed paths are refused', () => {
  const { dir } = repoWithLinks()
  const ctx = createContext(dir, {})
  for (const p of ['..', '../x', 'sub/../../x', '/etc/passwd', 'a\0b', '', '.\0', '//etc/passwd']) {
    assert.throws(() => ctx.read(p), /escapes|NUL|Absolute|non-empty/, `path ${JSON.stringify(p)}`)
  }
  for (const p of [null, undefined, 42, {}, []]) assert.throws(() => ctx.read(p), /non-empty string/)
  assert.equal(ctx.read('sub/../a.txt'), 'inside', 'normalisation that stays inside is allowed')
})

test('symlinks that resolve outside the root are never followed (file and directory)', () => {
  const { dir } = repoWithLinks()
  const ctx = createContext(dir, {})
  assert.throws(() => ctx.read('link-out-file'), /Symlink escapes/)
  assert.throws(() => ctx.read('link-out-dir/dir/inner.txt'), /Symlink escapes/)
  assert.throws(() => ctx.exists('link-out-dir'), /Symlink escapes/)
  assert.throws(() => ctx.size('link-out-file'), /Symlink escapes/)
})

test('in-root symlinks work, dangling links and directories read as null', () => {
  const { dir } = repoWithLinks()
  const ctx = createContext(dir, {})
  assert.equal(ctx.read('link-in'), 'inside')
  assert.equal(ctx.read('link-dangling'), null)
  assert.equal(ctx.read('sub'), null, 'a directory is not a readable file')
  assert.equal(ctx.read('missing.txt'), null)
  assert.equal(ctx.size('sub'), 0)
})

test('a root that is itself a symlink still works and still confines', () => {
  const { dir } = repoWithLinks()
  const holder = mkdtempSync(join(tmpdir(), 'jb-rootlink-'))
  symlinkSync(dir, join(holder, 'root'))
  const ctx = createContext(join(holder, 'root'), {})
  assert.equal(ctx.read('a.txt'), 'inside')
  assert.throws(() => ctx.read('link-out-file'), /Symlink escapes/)
})

test('context object is frozen; capabilities cannot be replaced or added', () => {
  const { dir } = repoWithLinks()
  const ctx = createContext(dir, {})
  assert.throws(() => { ctx.read = () => 'hijack' }, TypeError)
  assert.throws(() => { ctx.network = () => 1 }, TypeError)
  assert.throws(() => { ctx.git = () => 'x' }, TypeError)
})

test('git capability is limited to read-only subcommands', () => {
  const { dir } = repoWithLinks()
  const ctx = createContext(dir, {})
  for (const args of [['push'], ['commit', '-m', 'x'], ['config', 'a.b', 'c'], ['clone', 'x'], ['fetch'], ['checkout', '.'], ['-c', 'core.pager=x', 'ls-files'], [], 'ls-files', null]) {
    assert.throws(() => ctx.git(args), /not permitted/, JSON.stringify(args))
  }
  assert.match(ctx.git(['ls-files']), /a\.txt/)
})

test('end to end: tracked escaping symlinks are reported, their targets are never read', async () => {
  const { dir } = repoWithLinks()
  const r = await run({ adapters: { edunexus }, configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(r.checkErrors, [])
  const esc = r.findings.filter((f) => f.title.startsWith('Tracked symlink resolves outside'))
  assert.deepEqual(esc.map((f) => f.evidence[0].location).sort(), ['link-out-dir', 'link-out-file'])
  assert.ok(!JSON.stringify(r).includes(FAKE.aws), 'content behind the symlink must never be scanned or reported')
  assert.ok(!r.findings.some((f) => f.checkId === 'secret-patterns' && f.rationale.includes('Pattern match')), 'no secret finding from outside content')
})
