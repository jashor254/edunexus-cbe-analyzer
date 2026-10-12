// scripts/security/audit-rules.test.ts
// Unit tests for the dependency-audit gate policy (scripts/check-dependency-audit.mjs).
// Fixtures mirror the shape of `npm audit --json` — no network, no npm.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAudit, extractAdvisories } from './audit-rules.mjs'

const TODAY = '2026-10-12'

function advisory(id: string, severity: string, name = 'pkg') {
  return { source: 1, name, title: `${name} problem`, url: `https://github.com/advisories/${id}`, severity, range: '<2.0.0' }
}
function audit(...entries: Array<{ pkg: string; via: Array<object | string> }>) {
  const vulnerabilities: Record<string, object> = {}
  for (const e of entries) vulnerabilities[e.pkg] = { name: e.pkg, severity: 'high', via: e.via }
  return { vulnerabilities, metadata: { vulnerabilities: {} } }
}
function accept(id: string, expires = '2027-01-01') {
  return { id, package: 'pkg', reason: 'proven unreachable', accepted: '2026-10-01', expires }
}
const rules = (r: ReturnType<typeof evaluateAudit>, key: 'blocking' | 'warnings' = 'blocking') => r[key].map(x => x.rule)

test('extractAdvisories: dedupes by advisory id and skips transitive string pointers', () => {
  const a = audit(
    { pkg: 'image-size', via: [advisory('GHSA-aaaa', 'high', 'image-size')] },
    { pkg: 'pptxgenjs', via: ['image-size'] },
    { pkg: 'other', via: [advisory('GHSA-aaaa', 'high', 'image-size')] },
  )
  assert.deepEqual(extractAdvisories(a).map(x => x.id), ['GHSA-aaaa'])
})

test('a clean audit passes with nothing to report', () => {
  const r = evaluateAudit({ audit: audit(), accepted: [], today: TODAY })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(rules(r, 'warnings'), [])
})

test('a new high advisory blocks', () => {
  const r = evaluateAudit({ audit: audit({ pkg: 'next', via: [advisory('GHSA-new1', 'high')] }), accepted: [], today: TODAY })
  assert.deepEqual(rules(r), ['new-advisory'])
})

test('a new critical advisory blocks', () => {
  const r = evaluateAudit({ audit: audit({ pkg: 'next', via: [advisory('GHSA-new2', 'critical')] }), accepted: [], today: TODAY })
  assert.deepEqual(rules(r), ['new-advisory'])
})

test('moderate and low advisories warn but do not block', () => {
  const r = evaluateAudit({
    audit: audit({ pkg: 'a', via: [advisory('GHSA-mod', 'moderate')] }, { pkg: 'b', via: [advisory('GHSA-low', 'low')] }),
    accepted: [], today: TODAY,
  })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(rules(r, 'warnings'), ['below-threshold', 'below-threshold'])
})

test('an accepted, unexpired high advisory passes', () => {
  const r = evaluateAudit({ audit: audit({ pkg: 'image-size', via: [advisory('GHSA-acc', 'high')] }), accepted: [accept('GHSA-acc')], today: TODAY })
  assert.deepEqual(rules(r), [])
})

test('an acceptance past its expiry date blocks', () => {
  const r = evaluateAudit({ audit: audit({ pkg: 'image-size', via: [advisory('GHSA-acc', 'high')] }), accepted: [accept('GHSA-acc', '2026-10-11')], today: TODAY })
  assert.deepEqual(rules(r), ['acceptance-expired'])
})

test('an acceptance expiring today still passes (expiry is inclusive)', () => {
  const r = evaluateAudit({ audit: audit({ pkg: 'image-size', via: [advisory('GHSA-acc', 'high')] }), accepted: [accept('GHSA-acc', TODAY)], today: TODAY })
  assert.deepEqual(rules(r), [])
})

test('accepting one advisory does not cover a different advisory in the same package', () => {
  const r = evaluateAudit({
    audit: audit({ pkg: 'image-size', via: [advisory('GHSA-acc', 'high'), advisory('GHSA-other', 'high')] }),
    accepted: [accept('GHSA-acc')], today: TODAY,
  })
  assert.deepEqual(r.blocking.map(b => b.id), ['GHSA-other'])
})

test('an accepted advisory that has disappeared warns so the register stays clean', () => {
  const r = evaluateAudit({ audit: audit(), accepted: [accept('GHSA-gone')], today: TODAY })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(rules(r, 'warnings'), ['acceptance-unused'])
})

test('a register entry without a reason or expiry blocks', () => {
  const r = evaluateAudit({ audit: audit(), accepted: [{ id: 'GHSA-x' }], today: TODAY })
  assert.deepEqual(rules(r), ['register-invalid'])
})

test('an npm audit error blocks instead of passing silently', () => {
  const r = evaluateAudit({ audit: { error: { summary: 'network unreachable' } }, accepted: [], today: TODAY })
  assert.deepEqual(rules(r), ['audit-error'])
})
