// scripts/security/db-advisor-rules.test.ts
// Unit tests for the Supabase security-advisor gate policy
// (scripts/check-supabase-advisors.mjs). Fixtures mirror the advisor
// response shape — no network, no database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAdvisors, flattenLints } from './db-advisor-rules.mjs'

const TODAY = '2026-10-12'

function lint(name: string, level: string, entities: string[]) {
  return {
    name, level, categories: ['SECURITY'],
    findings: entities.map(e => ({ detail: `${name} on ${e}`, metadata: { name: e } })),
  }
}
function accept(lintName: string, entities: string[], expires = '2027-01-01') {
  return { lint: lintName, entities, reason: 'reviewed', accepted: '2026-10-12', expires }
}
const rules = (r: ReturnType<typeof evaluateAdvisors>, key: 'blocking' | 'warnings' = 'blocking') => r[key].map(x => x.rule)

test('flattenLints: one row per finding; auth-level findings use metadata.entity', () => {
  const rows = flattenLints({
    lints: [
      lint('rls_disabled_in_public', 'ERROR', ['a', 'b']),
      { name: 'auth_leaked_password_protection', level: 'WARN', categories: ['SECURITY'], findings: [{ detail: 'off', metadata: { entity: 'Auth' } }] },
    ],
  })
  assert.deepEqual(rows.map(r => `${r.lint}:${r.entity}`), ['rls_disabled_in_public:a', 'rls_disabled_in_public:b', 'auth_leaked_password_protection:Auth'])
})

test('flattenLints: ignores non-security categories', () => {
  const rows = flattenLints({ lints: [{ ...lint('unindexed_foreign_keys', 'INFO', ['t']), categories: ['PERFORMANCE'] }] })
  assert.deepEqual(rows, [])
})

test('a new table without RLS blocks', () => {
  const r = evaluateAdvisors({ response: { lints: [lint('rls_disabled_in_public', 'ERROR', ['learner_notes'])] }, accepted: [], today: TODAY })
  assert.deepEqual(rules(r), ['new-db-finding'])
})

test('a new anon-callable SECURITY DEFINER function blocks even when the lint has accepted entities', () => {
  const r = evaluateAdvisors({
    response: { lints: [lint('anon_security_definer_function_executable', 'WARN', ['auth_owns_student', 'export_all_learners'])] },
    accepted: [accept('anon_security_definer_function_executable', ['auth_owns_student'])],
    today: TODAY,
  })
  assert.deepEqual(r.blocking.map(b => b.key), ['anon_security_definer_function_executable:export_all_learners'])
})

test('accepted, unexpired findings pass', () => {
  const r = evaluateAdvisors({
    response: { lints: [lint('extension_in_public', 'WARN', ['pg_trgm'])] },
    accepted: [accept('extension_in_public', ['pg_trgm'])],
    today: TODAY,
  })
  assert.deepEqual(rules(r), [])
})

test('an expired acceptance blocks', () => {
  const r = evaluateAdvisors({
    response: { lints: [lint('auth_leaked_password_protection', 'WARN', ['Auth'])] },
    accepted: [accept('auth_leaked_password_protection', ['Auth'], '2026-10-11')],
    today: TODAY,
  })
  assert.deepEqual(rules(r), ['acceptance-expired'])
})

test('INFO findings warn but do not block', () => {
  const r = evaluateAdvisors({ response: { lints: [lint('rls_enabled_no_policy', 'INFO', ['job_queues'])] }, accepted: [], today: TODAY })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(rules(r, 'warnings'), ['below-threshold'])
})

test('a fixed finding leaves an unused acceptance that warns', () => {
  const r = evaluateAdvisors({ response: { lints: [] }, accepted: [accept('extension_in_public', ['pg_trgm'])], today: TODAY })
  assert.deepEqual(rules(r), [])
  assert.deepEqual(rules(r, 'warnings'), ['acceptance-unused'])
})

test('a response without a lints array blocks instead of passing', () => {
  const r = evaluateAdvisors({ response: { message: 'endpoint removed' }, accepted: [], today: TODAY })
  assert.deepEqual(rules(r), ['advisor-response-invalid'])
})

test('a malformed register entry blocks', () => {
  const r = evaluateAdvisors({ response: { lints: [] }, accepted: [{ lint: 'x' }], today: TODAY })
  assert.deepEqual(rules(r), ['register-invalid'])
})
