import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactLine, containsSecret, fingerprint } from '../core/redactor.mjs'
import { makeFinding, evidenceDigest } from '../core/finding.mjs'
import { authorise, GuardRefusal } from '../core/guard.mjs'
import { createContext } from '../core/context.mjs'
import { toAiSafeView, acceptableProposals, NullProvider } from '../core/ai-port.mjs'
import { compareExact, rangeLowerMajor } from '../core/semver.mjs'
import { makeRepo, writeConfig, FAKE } from './helpers.mjs'

test('redactor removes every secret and is stable', () => {
  const line = `const a = "${FAKE.aws}"; const b = "${FAKE.github}"; k=${FAKE.paystack}`
  const { redacted, hits } = redactLine(line)
  assert.equal(hits.length, 3)
  for (const s of Object.values(FAKE)) assert.ok(!redacted.includes(s))
  assert.ok(!containsSecret(redacted))
  assert.equal(fingerprint(FAKE.aws), fingerprint(FAKE.aws))
})

test('makeFinding rejects invalid classification and unredacted secrets', () => {
  const base = { key: 'k', checkId: 'demo', title: 'demo', severity: 'low', classification: 'confirmed', rationale: 'because', evidence: [], reproduce: 'run it', remediationHint: 'hint' }
  assert.match(makeFinding(base).id, /^JB-[0-9a-f]{10}$/)
  assert.throws(() => makeFinding({ ...base, classification: 'definitely' }), /Invalid finding/)
  assert.throws(() => makeFinding({ ...base, rationale: `leak ${FAKE.aws}` }), /unredacted secret/)
})

test('evidence digest is order-independent', () => {
  const a = makeFinding({ key: '1', checkId: 'demo', title: 'one', severity: 'low', classification: 'confirmed', rationale: 'reason one', evidence: [], reproduce: 'x y z', remediationHint: 'h' })
  const b = makeFinding({ key: '2', checkId: 'demo', title: 'two', severity: 'low', classification: 'confirmed', rationale: 'reason two', evidence: [], reproduce: 'x y z', remediationHint: 'h' })
  assert.equal(evidenceDigest([a, b]), evidenceDigest([b, a]))
})

test('guard: default deny and every refusal path', () => {
  const dir = makeRepo({ 'a.txt': 'x' })
  const ok = writeConfig(dir)
  assert.doesNotThrow(() => authorise({ configPath: ok, targetId: 'fixture', mode: 'passive' }))
  const refuse = (args, re) => assert.throws(() => authorise(args), (e) => e instanceof GuardRefusal && re.test(e.message))
  refuse({ configPath: '', targetId: 'fixture', mode: 'passive' }, /No target config/)
  refuse({ configPath: ok, targetId: undefined, mode: 'passive' }, /never inferred/)
  refuse({ configPath: ok, targetId: 'other', mode: 'passive' }, /not listed/)
  refuse({ configPath: ok, targetId: 'fixture', mode: 'active' }, /not implemented/)
  refuse({ configPath: ok, targetId: 'fixture', mode: 'passive', now: new Date('2100-01-01') }, /expired/)
  refuse({ configPath: ok, targetId: 'fixture', mode: 'passive', now: new Date('2025-01-01') }, /not yet effective/)
  refuse({ configPath: writeConfig(dir, { path: 'https://example.com' }), targetId: 'fixture', mode: 'passive' }, /deny pattern/)
  refuse({ configPath: writeConfig(dir, { id: 'production-db' }), targetId: 'production-db', mode: 'passive' }, /deny pattern/)
  refuse({ configPath: writeConfig(dir, { environment: 'production' }), targetId: 'fixture', mode: 'passive' }, /invalid/)
  refuse({ configPath: writeConfig(dir, { allowedModes: ['active'] }), targetId: 'fixture', mode: 'passive' }, /invalid/)
  refuse({ configPath: writeConfig(dir, { url: 'https://x.y' }), targetId: 'fixture', mode: 'passive' }, /unknown property/)
  refuse({ configPath: writeConfig(dir, { authorisation: { approvedBy: 'REPLACE me', approvedAt: '2026-01-01', expiresAt: '2099-01-01', scope: 'REPLACE this scope' } }), targetId: 'fixture', mode: 'passive' }, /placeholders/)
  refuse({ configPath: writeConfig(dir, { path: 'missing-dir' }), targetId: 'fixture', mode: 'passive' }, /does not exist/)
})

test('context: no traversal, only read-only git', () => {
  const dir = makeRepo({ 'a.txt': 'hello' })
  const ctx = createContext(dir, {})
  assert.equal(ctx.read('a.txt'), 'hello')
  assert.equal(ctx.read('nope.txt'), null)
  assert.throws(() => ctx.read('../../etc/passwd'), /escapes target root/)
  assert.throws(() => ctx.git(['push']), /not permitted/)
  assert.throws(() => ctx.git(['commit', '-m', 'x']), /not permitted/)
  assert.deepEqual(ctx.trackedFiles(), ['a.txt'])
})

test('AI port exposes no evidence detail and filters non-passive proposals', async () => {
  const f = makeFinding({ key: 'k', checkId: 'demo', title: 'demo', severity: 'low', classification: 'suspected', rationale: 'why', evidence: [{ kind: 'file-line', location: 'a.ts:1', detail: 'SECRET-LOOKING-DETAIL' }], reproduce: 'x y z', remediationHint: 'h' })
  const view = toAiSafeView(f)
  assert.ok(!JSON.stringify(view).includes('SECRET-LOOKING-DETAIL'))
  assert.deepEqual(view.locations, ['a.ts:1'])
  assert.deepEqual(await NullProvider.propose([view]), [])
  const kept = acceptableProposals([{ findingId: 'a', kind: 'propose-test', text: 't', requiresMode: 'active' }, { findingId: 'b', kind: 'explain', text: 't', requiresMode: 'passive' }])
  assert.equal(kept.length, 1)
})

test('semver helpers', () => {
  assert.ok(compareExact('22.22.3', '22.23.5') < 0)
  assert.ok(compareExact('22.23.5', '22.23.5') === 0)
  assert.ok(Number.isNaN(compareExact('22', '22.23.5')))
  assert.equal(rangeLowerMajor('>=20.9.0'), 20)
  assert.equal(rangeLowerMajor('^20.19.37'), 20)
  assert.equal(rangeLowerMajor('22'), 22)
  assert.equal(rangeLowerMajor('lts/*'), null)
})
