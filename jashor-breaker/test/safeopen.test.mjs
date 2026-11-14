// Open-then-validate reads: symlink replacement, file replacement between validation and use, unexpected file
// types, unreadable files. Synthetic files in private temp directories only.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { chmodSync, closeSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openRegularFile, readRegularFile, sizeOfRegularFile } from '../core/safeopen.mjs'
import { createContext } from '../core/context.mjs'
import { authorise, GuardRefusal } from '../core/guard.mjs'
import { makeRepo } from './helpers.mjs'

const tmp = () => realpathSync(mkdtempSync(join(os.tmpdir(), 'jb-so-')))
const fifo = (p) => execFileSync('/usr/bin/mkfifo', [p])
const linux = process.platform === 'linux'

describe('openRegularFile / readRegularFile', () => {
  test('reads a regular file and reports its size', () => {
    const d = tmp(); writeFileSync(join(d, 'f'), 'hello')
    assert.deepEqual(readRegularFile(join(d, 'f')), { ok: true, text: 'hello' })
    assert.equal(sizeOfRegularFile(join(d, 'f')), 5)
  })

  test('missing, directory and FIFO are refused with distinct reasons; a FIFO does not hang', () => {
    const d = tmp(); mkdirSync(join(d, 'dir')); fifo(join(d, 'pipe'))
    assert.deepEqual(readRegularFile(join(d, 'nope')), { ok: false, reason: 'missing' })
    assert.deepEqual(readRegularFile(join(d, 'dir')), { ok: false, reason: 'not-regular' })
    assert.deepEqual(readRegularFile(join(d, 'pipe')), { ok: false, reason: 'not-regular' })
    assert.equal(sizeOfRegularFile(join(d, 'pipe')), null)
    assert.equal(sizeOfRegularFile(join(d, 'dir')), null)
  })

  test('size ceiling is enforced on the open descriptor', () => {
    const d = tmp(); writeFileSync(join(d, 'big'), 'x'.repeat(100))
    assert.deepEqual(readRegularFile(join(d, 'big'), { maxBytes: 10 }), { ok: false, reason: 'too-large' })
    assert.equal(readRegularFile(join(d, 'big'), { maxBytes: 100 }).ok, true)
  })

  test('an unreadable file is refused, not thrown', (t) => {
    if (process.getuid() === 0) return t.skip('root can read mode 000 files')
    const d = tmp(); writeFileSync(join(d, 'f'), 'x'); chmodSync(join(d, 'f'), 0)
    assert.deepEqual(readRegularFile(join(d, 'f')), { ok: false, reason: 'unreadable' })
  })

  test('noFollow refuses a symlink in the final component', () => {
    const d = tmp(); writeFileSync(join(d, 'real'), 'x'); symlinkSync(join(d, 'real'), join(d, 'link'))
    assert.equal(readRegularFile(join(d, 'link')).ok, true, 'followed by default (operator-supplied paths)')
    assert.equal(readRegularFile(join(d, 'link'), { noFollow: true }).ok, false)
  })

  test('containment is judged on the OPEN file: a symlink swapped in before the open is refused', (t) => {
    if (!linux) return t.skip('/proc/self/fd containment is Linux-only')
    const root = tmp(); const outside = tmp()
    writeFileSync(join(outside, 'secret'), 'OUTSIDE')
    symlinkSync(join(outside, 'secret'), join(root, 'file')) // what an attacker swaps in
    assert.deepEqual(readRegularFile(join(root, 'file'), { root }), { ok: false, reason: 'outside-root' })
    writeFileSync(join(root, 'inside'), 'ok'); symlinkSync(join(root, 'inside'), join(root, 'inner-link'))
    assert.equal(readRegularFile(join(root, 'inner-link'), { root }).ok, true, 'links that stay inside are fine')
  })

  test('replacement AFTER the open cannot redirect the read: the descriptor still names the original inode', () => {
    const root = tmp(); const outside = tmp()
    writeFileSync(join(root, 'f'), 'ORIGINAL'); writeFileSync(join(outside, 'secret'), 'OUTSIDE')
    const o = openRegularFile(join(root, 'f'), {
      root,
      afterOpen: (abs) => { renameSync(abs, `${abs}.moved`); symlinkSync(join(outside, 'secret'), abs) }, // swap during the validation window
    })
    assert.equal(o.ok, true)
    assert.equal(readFileSync(o.fd, 'utf8'), 'ORIGINAL', 'reads the inode that was validated, not whatever is at the path now')
    closeSync(o.fd)
  })

  test('replacement with a directory or FIFO after the open is irrelevant for the same reason', () => {
    const root = tmp(); writeFileSync(join(root, 'f'), 'ORIGINAL')
    const o = openRegularFile(join(root, 'f'), { afterOpen: (abs) => { renameSync(abs, `${abs}.moved`); mkdirSync(abs) } })
    assert.equal(readFileSync(o.fd, 'utf8'), 'ORIGINAL')
    closeSync(o.fd)
  })
})

describe('context.read / context.size', () => {
  const ctxFor = (files) => { const dir = makeRepo(files); return { dir, ctx: createContext(dir, {}, {}) } }

  test('FIFO and directory entries return null/0 without hanging', () => {
    const { dir, ctx } = ctxFor({ 'a.txt': 'x\n', 'sub/b.txt': 'y\n' })
    fifo(join(dir, 'pipe'))
    assert.equal(ctx.read('pipe'), null)
    assert.equal(ctx.size('pipe'), 0)
    assert.equal(ctx.read('sub'), null)
    assert.equal(ctx.size('sub'), 0)
    assert.equal(ctx.read('a.txt'), 'x\n')
    assert.equal(ctx.size('a.txt'), 2)
  })

  test('a symlink that escapes the root is not readable (existing check) and one that stays inside is', () => {
    const { dir, ctx } = ctxFor({ 'a.txt': 'x\n' })
    const outside = tmp(); writeFileSync(join(outside, 's'), 'OUTSIDE')
    symlinkSync(join(outside, 's'), join(dir, 'esc'))
    symlinkSync(join(dir, 'a.txt'), join(dir, 'ok'))
    assert.throws(() => ctx.read('esc'), /escapes target root/)
    assert.equal(ctx.read('ok'), 'x\n')
  })

  test('a file swapped for an escaping symlink after path resolution is still not returned (Linux)', (t) => {
    if (!linux) return t.skip('Linux-only')
    const { dir } = ctxFor({ 'a.txt': 'x\n' })
    const outside = tmp(); writeFileSync(join(outside, 's'), 'OUTSIDE')
    const realRoot = realpathSync(dir)
    // Model the race directly: the path was validated as in-root, then replaced before the open.
    rmSwap(join(dir, 'a.txt'), join(outside, 's'))
    assert.deepEqual(readRegularFile(join(dir, 'a.txt'), { root: realRoot }), { ok: false, reason: 'outside-root' })
  })
})

function rmSwap(path, target) { renameSync(path, `${path}.orig`); symlinkSync(target, path) }

describe('authorise(): config file handling', () => {
  const mode = { targetId: 'fixture', mode: 'passive' }

  test('missing config keeps the original refusal message', () => {
    assert.throws(() => authorise({ configPath: join(tmp(), 'none.json'), ...mode }), (e) => e instanceof GuardRefusal && /No target config/.test(e.message))
    assert.throws(() => authorise({ configPath: '', ...mode }), /No target config/)
  })

  test('a FIFO or directory as config is refused as unreadable, without hanging and without echoing content', () => {
    const d = tmp(); fifo(join(d, 'pipe')); mkdirSync(join(d, 'dir'))
    for (const p of ['pipe', 'dir']) assert.throws(() => authorise({ configPath: join(d, p), ...mode }), (e) => e instanceof GuardRefusal && /unreadable or not valid JSON/.test(e.message))
  })

  test('invalid JSON stays refused with no parser message; a symlinked regular config still works as before', () => {
    const d = tmp(); writeFileSync(join(d, 'bad.json'), '{"secret-looking": ')
    assert.throws(() => authorise({ configPath: join(d, 'bad.json'), ...mode }), (e) => e instanceof GuardRefusal && !/secret-looking|Unexpected/.test(e.message))
    symlinkSync(join(d, 'bad.json'), join(d, 'ln.json'))
    assert.throws(() => authorise({ configPath: join(d, 'ln.json'), ...mode }), GuardRefusal)
  })
})
