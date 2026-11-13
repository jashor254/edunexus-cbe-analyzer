import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../core/runner.mjs'
import { toMarkdown } from '../core/report.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig, FAKE } from './helpers.mjs'

const lock = {
  lockfileVersion: 3,
  packages: {
    '': { name: 'x' },
    'node_modules/good': { version: '1.0.0', resolved: 'https://registry.npmjs.org/good/-/good-1.0.0.tgz', integrity: 'sha512-abc' },
    'node_modules/gitdep': { version: '1.0.0', resolved: 'git+https://github.com/someone/gitdep.git#abc' },
  },
}

function fixture() {
  return makeRepo({
    '.nvmrc': '22\n',
    'package.json': JSON.stringify({ engines: { node: '>=20.9.0' }, devDependencies: { '@types/node': '^20.1.0' } }),
    'package-lock.json': JSON.stringify(lock),
    '.env.local': 'SOMETHING=1\n',
    '.env.example': 'SOMETHING=\n',
    '.github/workflows/ci.yml': ['name: ci', 'env:', "  NODE_VERSION: '22.22.3'", 'jobs:', '  a:', '    steps:', '      - uses: actions/checkout@v4', '      - uses: some-org/thing@v1', `      - uses: pinned/ok@${'a'.repeat(40)}`, '      - run: echo hi'].join('\n'),
    'src/leak.ts': `export const k = "${FAKE.aws}"\nconst fine = process.env.SECRET_TOKEN\n`,
    'src/pay.ts': `const key = '${FAKE.paystack}'\n`,
  })
}

const adapters = { edunexus }
const has = (r, checkId, cls, sev) => r.findings.some((f) => f.checkId === checkId && f.classification === cls && (!sev || f.severity === sev))

test('edunexus adapter finds the seeded issues with correct classification', async () => {
  const dir = fixture()
  const r = await run({ adapters, configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(r.checkErrors, [])
  assert.equal(r.checksRun.length, 5)
  assert.ok(has(r, 'node-runtime', 'confirmed', 'low'), 'floating .nvmrc')
  assert.ok(has(r, 'node-runtime', 'confirmed', 'medium'), 'exact below floor')
  assert.ok(has(r, 'node-runtime', 'unverified'), 'platform runtime gap is unverified, not confirmed')
  assert.ok(r.findings.some((f) => f.title.startsWith('package.json engines permits')))
  assert.ok(has(r, 'actions-pinning', 'confirmed', 'medium'), 'third-party unpinned')
  assert.ok(has(r, 'actions-pinning', 'confirmed', 'low'), 'first-party unpinned')
  assert.ok(has(r, 'actions-pinning', 'suspected'), 'missing permissions')
  assert.ok(!r.findings.some((f) => f.evidence.some((e) => e.detail.includes('pinned/ok'))), 'SHA-pinned action not flagged')
  assert.ok(has(r, 'tracked-env-files', 'confirmed', 'high'))
  assert.ok(!r.findings.some((f) => f.evidence.some((e) => e.location === '.env.example')))
  assert.ok(has(r, 'lockfile-sources', 'confirmed', 'medium'))
  assert.ok(has(r, 'secret-patterns', 'suspected', 'high'), 'aws pattern')
  assert.ok(has(r, 'secret-patterns', 'suspected', 'critical'), 'paystack live pattern')
  assert.ok(!r.findings.some((f) => f.checkId === 'secret-patterns' && f.evidence[0].location.endsWith(':2')), 'process.env reference not flagged')
  assert.ok(!r.findings.some((f) => f.checkId === 'secret-patterns' && f.classification === 'confirmed'), 'pattern matches are never confirmed')
})

test('no raw secret reaches the JSON or Markdown report', async () => {
  const r = await run({ adapters, configPath: writeConfig(fixture()), targetId: 'fixture' })
  const blob = JSON.stringify(r) + toMarkdown(r)
  for (const s of Object.values(FAKE)) assert.ok(!blob.includes(s), 'raw secret leaked')
  assert.match(blob, /\[REDACTED:aws-access-key-id:[0-9a-f]{8}\]/)
})

test('runs are reproducible: identical input gives identical digest', async () => {
  const dir = fixture()
  const cfg = writeConfig(dir)
  const a = await run({ adapters, configPath: cfg, targetId: 'fixture' })
  const b = await run({ adapters, configPath: cfg, targetId: 'fixture' })
  assert.equal(a.evidenceDigest, b.evidenceDigest)
  assert.deepEqual(a.findings.map((f) => f.id), b.findings.map((f) => f.id))
})

test('a clean repo yields only the unverified platform gap', async () => {
  const dir = makeRepo({ '.nvmrc': '22.23.5\n', 'README.md': 'hi' })
  const r = await run({ adapters, configPath: writeConfig(dir), targetId: 'fixture' })
  assert.deepEqual(r.findings.filter((f) => f.classification !== 'unverified' && f.severity !== 'info'), [])
})

test('engine refuses a non-passive check and surfaces check errors', async () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  const cfg = writeConfig(dir)
  const active = { ...edunexus, checks: [{ id: 'bad', title: 'bad', mode: 'active', run: () => [] }] }
  await assert.rejects(run({ adapters: { edunexus: active }, configPath: cfg, targetId: 'fixture' }), /only passive/)
  const boom = { ...edunexus, checks: [{ id: 'boom', title: 'boom', mode: 'passive', run: () => { throw new Error('kaput') } }] }
  const r = await run({ adapters: { edunexus: boom }, configPath: cfg, targetId: 'fixture' })
  assert.equal(r.checkErrors[0].message, 'kaput')
})
