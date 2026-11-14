// Host-side snapshot boundary: synthetic hostile repositories only (built here, first-party, benign canaries).
// None of these tests need the sandbox; they prove that unsafe input is refused BEFORE any write outside the
// designated scratch area, and that a repository's own configuration cannot run a command.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, existsSync, symlinkSync, statSync, lstatSync, chmodSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { createSnapshot } from '../sandbox/sandbox.mjs'
import {
  SnapshotRefused, parseLsTree, checkPath, planSnapshot, parseCatBatch, writePlan, symlinkTargetIsSafe, SNAPSHOT_LIMITS,
} from '../sandbox/snapshot.mjs'
import { authorise } from '../core/guard.mjs'
import { createContext } from '../core/context.mjs'
import { filterNeutralisers } from '../core/gitsafe.mjs'
import { makeCommittedRepo, writeConfig } from './helpers.mjs'

const NOW = new Date('2026-11-13T00:00:00Z')
const OID = (n) => String(n).padStart(40, '0')
const blob = (path, extra = {}) => ({ mode: '100644', type: 'blob', oid: OID(1), size: 1, path, ...extra })
const snapDirs = () => readdirSync(os.tmpdir()).filter((n) => n.startsWith('jb-snap-')).length
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const auth = (dir) => authorise({ configPath: writeConfig(dir), targetId: 'fixture', mode: 'passive', now: NOW })
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof SnapshotRefused && (!re || re.test(e.message)), String(re))

/** A canary directory OUTSIDE any scratch area; nothing may be created, changed or removed in it. */
function canaryDir() {
  const d = mkdtempSync(join(os.tmpdir(), 'jb-canary-'))
  writeFileSync(join(d, 'keep.txt'), 'untouched\n')
  return { dir: d, listing: () => readdirSync(d).sort().join(','), keep: () => readFileSync(join(d, 'keep.txt'), 'utf8') }
}

describe('path validation (refused before any write)', () => {
  const bad = {
    'parent traversal': '../escape', 'nested traversal': 'a/b/../../../escape', 'dot component': 'a/./b', 'empty component': 'a//b',
    'absolute path': '/etc/cron.d/x', 'trailing slash': 'a/', 'nested git dir': 'sub/.git/config', 'git dir, other case': 'sub/.GIT/hooks/post-checkout',
    'control character': 'a\nb', 'NUL byte': 'a\0b', 'DEL character': 'a\x7fb', 'empty path': '',
  }
  for (const [name, p] of Object.entries(bad)) test(`refuses ${name}`, () => refused(() => checkPath(p)))

  test('refuses depth, path length and component length over the ceilings', () => {
    refused(() => checkPath(Array.from({ length: SNAPSHOT_LIMITS.maxDepth + 1 }, () => 'd').join('/')), /too deep/)
    assert.deepEqual(checkPath(Array.from({ length: SNAPSHOT_LIMITS.maxDepth }, () => 'd').join('/')).length, SNAPSHOT_LIMITS.maxDepth)
    refused(() => checkPath('x'.repeat(SNAPSHOT_LIMITS.maxNameBytes + 1)), /component too long/)
    refused(() => checkPath(`${'x'.repeat(200)}/`.repeat(6) + 'f'), /too long/)
  })

  test('accepts ordinary and unicode names', () => {
    assert.deepEqual(checkPath('src/app/page.tsx'), ['src', 'app', 'page.tsx'])
    assert.deepEqual(checkPath('docs/notes/résumé.md'), ['docs', 'notes', 'résumé.md'])
    assert.deepEqual(checkPath('.github/workflows/ci.yml'), ['.github', 'workflows', 'ci.yml'])
    assert.deepEqual(checkPath('.gitignore'), ['.gitignore'])
  })
})

describe('plan validation', () => {
  test('one bad entry refuses the entire snapshot (all-or-nothing)', () => {
    refused(() => planSnapshot([blob('ok.txt'), blob('../escape')]), /unsafe path/)
  })
  test('unexpected modes, object types, sizes and unparseable records are refused', () => {
    refused(() => planSnapshot([blob('a', { mode: '100666' })]), /unexpected entry mode/)
    refused(() => planSnapshot([blob('a', { mode: '040000' })]), /unexpected entry mode/)
    refused(() => planSnapshot([blob('a', { type: 'tree' })]), /unexpected object type/)
    refused(() => planSnapshot([blob('a', { size: -1 })]), /bad size/)
    refused(() => planSnapshot([blob('a', { size: 1.5 })]), /bad size/)
    refused(() => parseLsTree('garbage-record\0'), /unparseable/)
    refused(() => parseLsTree('100644 blob zzz       1\ta\0'), /unparseable/)
  })
  test('ls-tree records parse, including paths with spaces and tabs-free unicode', () => {
    const e = parseLsTree(`100644 blob ${OID(7)}       5\tdir name/résumé.txt\0`)
    assert.deepEqual(e, [{ mode: '100644', type: 'blob', oid: OID(7), size: 5, path: 'dir name/résumé.txt' }])
  })
  test('duplicate paths and file/directory conflicts are refused', () => {
    refused(() => planSnapshot([blob('a'), blob('a')]), /duplicate/)
    refused(() => planSnapshot([blob('a'), blob('a/b')]), /both a file and a directory/)
  })
  test('size, file-count and total ceilings are enforced from the listing, before any blob is read', () => {
    refused(() => planSnapshot([blob('big', { size: 101 })], { maxFileBytes: 100 }), /exceeds 100 bytes/)
    refused(() => planSnapshot([blob('a', { size: 60 }), blob('b', { size: 60 })], { maxTotalBytes: 100 }), /snapshot exceeds 100 bytes/)
    refused(() => planSnapshot(Array.from({ length: 6 }, (_, i) => blob(`f${i}`)), { maxFiles: 5 }), /exceeds 5 files/)
  })
  test('submodule entries are dropped and reported, never materialised', () => {
    const plan = planSnapshot([blob('sm', { mode: '160000', type: 'commit', size: 0 }), blob('ok')])
    assert.deepEqual(plan.dropped, [{ path: 'sm', reason: 'submodule' }])
    assert.equal(plan.files.length, 1)
  })
})

describe('symlink policy', () => {
  test('safe-target decisions', () => {
    for (const [link, target, ok] of [
      ['a/l', '../b', true], ['a/l', 'sibling', true], ['l', 'src/x', true],
      ['l', '..', false], ['l', '../x', false], ['a/l', '../../x', false], ['a/b/l', '../../../x', false],
      ['l', '/etc/passwd', false], ['l', '', false], ['l', 'a\0b', false], ['l', 'a/../../b', false], ['l', 'x'.repeat(2000), false],
    ]) assert.equal(symlinkTargetIsSafe(link, target), ok, `${link} -> ${JSON.stringify(target.slice(0, 20))}`)
  })
})

describe('writing a plan (synthetic, no git)', () => {
  const contents = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k, Buffer.from(v)]))

  test('hard links cannot be produced: two entries with one blob become independent files', () => {
    const tree = mkdtempSync(join(os.tmpdir(), 'jb-wp-'))
    const plan = planSnapshot([blob('a', { oid: OID(1), size: 3 }), blob('b', { oid: OID(1), size: 3 })])
    writePlan(plan, contents({ [OID(1)]: 'abc' }), tree)
    const [ia, ib] = [statSync(join(tree, 'a')), statSync(join(tree, 'b'))]
    assert.notEqual(ia.ino, ib.ino)
    assert.equal(ia.nlink, 1)
    assert.equal(ib.nlink, 1)
  })

  test('modes are normalised: no setuid/setgid/sticky, no group/world write, regardless of input mode', () => {
    const tree = mkdtempSync(join(os.tmpdir(), 'jb-wp-'))
    const plan = planSnapshot([blob('x', { mode: '100755', oid: OID(2), size: 1 }), blob('y', { oid: OID(3), size: 1 })])
    writePlan(plan, contents({ [OID(2)]: 'x', [OID(3)]: 'y' }), tree)
    assert.equal(statSync(join(tree, 'x')).mode & 0o7777, 0o755 & ~process.umask())
    assert.equal(statSync(join(tree, 'y')).mode & 0o7777, 0o644 & ~process.umask())
  })

  test('a pre-existing symlink at a destination is never followed: file creation fails and the outside file is untouched', () => {
    const out = canaryDir()
    const tree = mkdtempSync(join(os.tmpdir(), 'jb-wp-'))
    symlinkSync(join(out.dir, 'keep.txt'), join(tree, 'victim'))
    const plan = planSnapshot([blob('victim', { oid: OID(4), size: 4 })])
    assert.throws(() => writePlan(plan, contents({ [OID(4)]: 'EVIL' }), tree), /EEXIST/)
    assert.equal(out.keep(), 'untouched\n')
  })

  test('escaping symlinks are dropped and reported; safe ones are created last', () => {
    const tree = mkdtempSync(join(os.tmpdir(), 'jb-wp-'))
    const plan = planSnapshot([
      blob('dir/real.txt', { oid: OID(5), size: 1 }),
      blob('dir/good', { mode: '120000', oid: OID(6), size: 8 }),
      blob('dir/evil-abs', { mode: '120000', oid: OID(7), size: 11 }),
      blob('dir/evil-rel', { mode: '120000', oid: OID(8), size: 12 }),
    ])
    const r = writePlan(plan, contents({ [OID(5)]: 'r', [OID(6)]: 'real.txt', [OID(7)]: '/etc/passwd', [OID(8)]: '../../../etc' }), tree)
    assert.equal(r.symlinks, 1)
    assert.deepEqual(r.dropped.map((d) => d.path).sort(), ['dir/evil-abs', 'dir/evil-rel'])
    assert.equal(lstatSync(join(tree, 'dir/good')).isSymbolicLink(), true)
    assert.equal(existsSync(join(tree, 'dir/evil-abs')), false)
    assert.equal(existsSync(join(tree, 'dir/evil-rel')), false)
  })

  test('cat-file output is cross-checked: wrong size, unrequested object, truncation and missing objects are refused', () => {
    const expected = new Map([[OID(9), 3]])
    assert.equal(parseCatBatch(Buffer.from(`${OID(9)} blob 3\nabc\n`), expected).get(OID(9)).toString(), 'abc')
    refused(() => parseCatBatch(Buffer.from(`${OID(9)} blob 4\nabcd\n`), expected), /differs/)
    refused(() => parseCatBatch(Buffer.from(`${OID(8)} blob 3\nabc\n`), expected), /not requested/)
    refused(() => parseCatBatch(Buffer.from(`${OID(9)} blob 3\nab`), expected), /truncated/)
    refused(() => parseCatBatch(Buffer.from(''), expected), /missing/)
    refused(() => parseCatBatch(Buffer.from(`${OID(9)} missing\n`), expected), /unexpected cat-file header/)
  })
})

describe('real git repositories (synthetic, built here)', () => {
  test('hostile core.fsmonitor in the repository config is never executed', () => {
    const out = canaryDir()
    const dir = makeCommittedRepo({ 'a.txt': 'hello\n' })
    const script = join(out.dir, 'fsmonitor.sh')
    writeFileSync(script, `#!/bin/sh\ntouch ${join(out.dir, 'FSMONITOR_RAN')}\nprintf '\\0'\n`)
    chmodSync(script, 0o755)
    git(dir, 'config', 'core.fsmonitor', script)
    // Control: plain git DOES run it (proves the fixture is hostile, so the assertion below is meaningful).
    git(dir, 'status', '--porcelain')
    assert.ok(existsSync(join(out.dir, 'FSMONITOR_RAN')), 'control: unhardened git executes the configured command')
    execFileSync('rm', [join(out.dir, 'FSMONITOR_RAN')])
    const snap = createSnapshot(auth(dir))
    try {
      assert.equal(existsSync(join(out.dir, 'FSMONITOR_RAN')), false, 'hardened snapshot must not run repo-configured commands')
      assert.equal(readFileSync(join(snap.treeDir, 'a.txt'), 'utf8'), 'hello\n')
    } finally { snap.cleanup() }
  })

  test('hostile filter drivers and attributes (export-subst, export-ignore, smudge) are neither executed nor applied', () => {
    const out = canaryDir()
    const dir = makeCommittedRepo({
      '.gitattributes': 'secret.txt filter=evil\nsubst.txt export-subst\nignored.txt export-ignore\n',
      'secret.txt': 'RAW-BLOB\n', 'subst.txt': '$Format:%H$\n', 'ignored.txt': 'present\n',
    })
    git(dir, 'config', 'filter.evil.smudge', `sh -c 'touch ${join(out.dir, 'SMUDGE_RAN')}; cat'`)
    git(dir, 'config', 'filter.evil.required', 'true')
    const snap = createSnapshot(auth(dir))
    try {
      assert.equal(existsSync(join(out.dir, 'SMUDGE_RAN')), false)
      assert.equal(readFileSync(join(snap.treeDir, 'secret.txt'), 'utf8'), 'RAW-BLOB\n')
      assert.equal(readFileSync(join(snap.treeDir, 'subst.txt'), 'utf8'), '$Format:%H$\n', 'export-subst is not expanded: raw committed bytes')
      assert.equal(readFileSync(join(snap.treeDir, 'ignored.txt'), 'utf8'), 'present\n', 'export-ignore does not hide committed files')
    } finally { snap.cleanup() }
  })

  test('a hostile clean filter is not executed by `git status` in either path (sandbox snapshot or in-process context)', () => {
    const out = canaryDir()
    const dir = makeCommittedRepo({ '.gitattributes': 'a.txt filter=evil\n', 'a.txt': 'same\n' })
    git(dir, 'config', 'filter.evil.clean', `sh -c 'touch ${join(out.dir, 'CLEAN_RAN')}; cat'`)
    const bump = () => utimesSync(join(dir, 'a.txt'), new Date(Date.now() + 5000), new Date(Date.now() + 5000)) // stat-dirty, same content
    bump()
    git(dir, 'status', '--porcelain')
    assert.ok(existsSync(join(out.dir, 'CLEAN_RAN')), 'control: unhardened `git status` runs the repo-configured clean filter')
    execFileSync('rm', [join(out.dir, 'CLEAN_RAN')])
    bump()
    const snap = createSnapshot(auth(dir))
    try { assert.equal(typeof snap.dirty, 'boolean') } finally { snap.cleanup() }
    assert.equal(existsSync(join(out.dir, 'CLEAN_RAN')), false, 'sandbox snapshot path')
    bump()
    const cfg = writeConfig(dir)
    const ctx = createContext(dir, { schemaVersion: 1 }, { now: NOW })
    const st = ctx.git(['status', '--porcelain'])
    assert.equal(typeof st, 'string', 'status still works (filters blanked, not refused)')
    assert.ok(!/a\.txt/.test(st), 'content unchanged: a.txt is not reported modified')
    assert.equal(existsSync(join(out.dir, 'CLEAN_RAN')), false, 'in-process path')
    assert.ok(cfg)
  })

  test('filter names that cannot be overridden safely make status report unknown instead of running', () => {
    assert.deepEqual(filterNeutralisers(''), [])
    assert.ok(Array.isArray(filterNeutralisers('filter.lfs.clean\nfilter.lfs.smudge\n')))
    assert.equal(filterNeutralisers('filter.bad name.clean\n'), null)
    assert.equal(filterNeutralisers('filter.a=b.clean\n'), null)
    assert.equal(filterNeutralisers('filter.x.unknownvar\n'), null)
  })

  test('replace refs cannot swap committed content', () => {
    const dir = makeCommittedRepo({ 'a.txt': 'committed\n' })
    const fake = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: dir, input: 'REPLACED\n', encoding: 'utf8' }).trim()
    const real = git(dir, 'rev-parse', 'HEAD:a.txt').trim()
    git(dir, 'replace', real, fake)
    assert.equal(git(dir, 'cat-file', 'blob', real), 'REPLACED\n', 'control: replace ref is active for plain git')
    const snap = createSnapshot(auth(dir))
    try { assert.equal(readFileSync(join(snap.treeDir, 'a.txt'), 'utf8'), 'committed\n') } finally { snap.cleanup() }
  })

  test('a repo-local config include and unusual config keys do not change what is exported', () => {
    const dir = makeCommittedRepo({ 'a.txt': 'x\n' })
    git(dir, 'config', 'core.attributesFile', '/nonexistent')
    git(dir, 'config', 'core.pager', 'touch /nonexistent-should-not-run')
    git(dir, 'config', 'diff.external', 'false')
    const snap = createSnapshot(auth(dir))
    try { assert.equal(readFileSync(join(snap.treeDir, 'a.txt'), 'utf8'), 'x\n') } finally { snap.cleanup() }
  })

  test('symlinks to host files are dropped, safe relative links are kept, manifest lists only what exists', () => {
    const dir = makeCommittedRepo({ 'src/a.ts': 'x\n' }, { symlinks: { 'abs': '/etc/passwd', 'rel-escape': '../../../../etc/passwd', 'src/ok': 'a.ts' } })
    const snap = createSnapshot(auth(dir))
    try {
      assert.equal(snap.stats.symlinks, 1)
      assert.equal(snap.stats.dropped, 2)
      assert.equal(existsSync(join(snap.treeDir, 'abs')), false)
      assert.equal(readFileSync(join(snap.treeDir, 'src/ok'), 'utf8'), 'x\n')
      const manifest = readFileSync(join(snap.metaDir, 'files.txt'), 'utf8').split('\0').filter(Boolean).sort()
      assert.deepEqual(manifest, ['src/a.ts', 'src/ok'])
    } finally { snap.cleanup() }
  })

  test('excessive depth, file count and size are refused; scratch is cleaned and the outside area is untouched', () => {
    const out = canaryDir()
    const before = { snaps: snapDirs(), listing: out.listing() }
    const deep = Array.from({ length: SNAPSHOT_LIMITS.maxDepth + 1 }, (_, i) => `d${i}`).join('/')
    refused(() => createSnapshot(auth(makeCommittedRepo({ [`${deep}/f.txt`]: 'x\n' }))), /too deep/)
    const many = makeCommittedRepo(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}.txt`, 'x\n'])))
    refused(() => createSnapshot(auth(many), { limits: { maxFiles: 10 } }), /exceeds 10 files/)
    const big = makeCommittedRepo({ 'big.bin': 'x'.repeat(5000) })
    refused(() => createSnapshot(auth(big), { limits: { maxFileBytes: 1000 } }), /exceeds 1000 bytes/)
    refused(() => createSnapshot(auth(big), { limits: { maxTotalBytes: 1000, maxFileBytes: 10_000 } }), /snapshot exceeds 1000 bytes/)
    assert.equal(snapDirs(), before.snaps, 'refused snapshots leave no scratch directory behind')
    assert.equal(out.listing(), before.listing)
    assert.equal(out.keep(), 'untouched\n')
  })

  test('a committed tree is exported faithfully: contents, executable bit, nested directories, nothing extra', () => {
    const dir = makeCommittedRepo({ 'a/b/c.txt': 'c\n', 'run.sh': '#!/bin/sh\n', 'top.md': 'top\n' })
    chmodSync(join(dir, 'run.sh'), 0o755)
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'mode')
    writeFileSync(join(dir, 'untracked.env'), 'NOT_COMMITTED=1\n')
    const snap = createSnapshot(auth(dir))
    try {
      assert.equal(readFileSync(join(snap.treeDir, 'a/b/c.txt'), 'utf8'), 'c\n')
      assert.ok(statSync(join(snap.treeDir, 'run.sh')).mode & 0o100)
      assert.equal(existsSync(join(snap.treeDir, 'untracked.env')), false)
      assert.equal(existsSync(join(snap.treeDir, '.git')), false, 'no repository metadata in the snapshot')
      assert.equal(snap.stats.files, 3)
    } finally { snap.cleanup() }
  })
})
