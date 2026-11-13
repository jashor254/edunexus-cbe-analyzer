import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../core/runner.mjs'
import { toMarkdown } from '../core/report.mjs'
import { verifyDigest } from '../core/finding.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig, FAKE } from './helpers.mjs'

const adapters = { edunexus }
const NOW = new Date('2026-11-13T00:00:00Z')
const CLI = new URL('../cli.mjs', import.meta.url).pathname

const files = () => ({
  '.nvmrc': '22\n',
  'package.json': JSON.stringify({ engines: { node: '>=20.9.0' } }),
  '.github/workflows/ci.yml': "name: ci\njobs:\n  a:\n    steps:\n      - uses: some-org/thing@v1\n",
  'src/a.ts': `const k = "${FAKE.aws}"\n`,
  'src/b.ts': `const k = "${FAKE.github}"\n`,
})

async function scan(entries) {
  const dir = makeRepo(entries)
  return run({ adapters, configPath: writeConfig(dir), targetId: 'fixture', now: NOW })
}

test('identical content in different directories and creation orders gives an identical report', async () => {
  const forward = files()
  const reversed = Object.fromEntries(Object.entries(files()).reverse())
  const a = await scan(forward)
  const b = await scan(reversed)
  assert.equal(a.evidenceDigest, b.evidenceDigest)
  assert.deepEqual(a, b, 'whole report, not just the digest, is path-independent')
  assert.equal(toMarkdown(a), toMarkdown(b))
  assert.equal(JSON.stringify(a), JSON.stringify(b))
})

test('digest changes when the subject changes', async () => {
  const base = await scan(files())
  const changed = await scan({ ...files(), 'src/c.ts': `const k = "${FAKE.paystack}"\n` })
  assert.notEqual(base.evidenceDigest, changed.evidenceDigest)
})

test('verifyDigest accepts an untouched report and rejects any tampering', async () => {
  const r = await scan(files())
  assert.equal(verifyDigest(structuredClone(r)), true)
  const dropped = structuredClone(r); dropped.findings.pop()
  const edited = structuredClone(r); edited.findings[0].severity = 'info'
  const retitled = structuredClone(r); retitled.findings[0].title = 'all good'
  const forged = structuredClone(r); forged.evidenceDigest = '0'.repeat(64)
  for (const bad of [dropped, edited, retitled, forged, {}, null, { findings: [] }, { evidenceDigest: 'x' }]) assert.equal(verifyDigest(bad), false)
})

test('CLI: --out report verifies offline; altering it is detected', async () => {
  const dir = makeRepo(files())
  const cfg = writeConfig(dir)
  const out = mkdtempSync(join(tmpdir(), 'jb-out-'))
  const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' })
  assert.equal(cli('run', '--config', cfg, '--target', 'fixture', '--out', out).status, 0)
  const file = join(out, 'report.json')
  assert.equal(cli('verify', file).status, 0)
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  doc.findings.shift()
  writeFileSync(file, JSON.stringify(doc))
  assert.equal(cli('verify', file).status, 1)
  assert.equal(cli('verify', join(out, 'missing.json')).status, 2)
})

test('two real CLI runs on the same target produce the same digest', () => {
  const dir = makeRepo(files())
  const cfg = writeConfig(dir)
  const digest = () => JSON.parse(spawnSync(process.execPath, [CLI, 'run', '--config', cfg, '--target', 'fixture', '--json'], { encoding: 'utf8' }).stdout).evidenceDigest
  assert.equal(digest(), digest())
})
