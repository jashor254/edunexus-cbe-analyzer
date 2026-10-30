// lib/sharing/sharedReports.test.ts
//
// Unit tests for the shared-report lookup's own logic, with an injected fake
// client that records exactly what was asked of the database. The database's
// side of the boundary (anon/authenticated reads denied, forged inserts
// rejected) is proven against a real stack in sharedReportsRls.test.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSharedReportByToken } from './sharedReports'

type Db = NonNullable<NonNullable<Parameters<typeof getSharedReportByToken>[1]>['db']>

type Row = { student_name: string; grade: string; report_data: unknown; created_at: string; expires_at: string }

function fakeDb(rowsByToken: Record<string, Row>, opts: { error?: string } = {}) {
  const calls: Array<{ table: string; columns: string; column: string; value: string }> = []
  const db = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              calls.push({ table, columns, column, value })
              return {
                async maybeSingle() {
                  if (opts.error) return { data: null, error: { message: opts.error } }
                  return { data: rowsByToken[value] ?? null, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
  return { db: db as unknown as Db, calls }
}

const NOW = new Date('2026-10-30T12:00:00Z')
const LIVE: Row = {
  student_name: 'Synthetic Learner A', grade: '8',
  report_data: { overallLevel: 3, strengths: ['Fractions'] },
  created_at: '2026-10-20T08:00:00Z', expires_at: '2026-11-19T08:00:00Z',
}
const OTHER: Row = { ...LIVE, student_name: 'Synthetic Learner B' }
const EXPIRED: Row = { ...LIVE, expires_at: '2026-10-01T08:00:00Z' }

test('a valid token returns exactly its own report, mapped to the rendered fields only', async () => {
  const { db } = fakeDb({ AAAAAAAAAAAA: LIVE, BBBBBBBBBBBB: OTHER })
  const result = await getSharedReportByToken('AAAAAAAAAAAA', { db, now: NOW })
  assert.equal(result.status, 'found')
  assert.ok(result.status === 'found')
  assert.deepEqual(result.report, {
    studentName: 'Synthetic Learner A', grade: '8',
    reportData: { overallLevel: 3, strengths: ['Fractions'] },
    createdAt: LIVE.created_at, expiresAt: LIVE.expires_at,
  })
  assert.deepEqual(Object.keys(result.report).sort(), ['createdAt', 'expiresAt', 'grade', 'reportData', 'studentName'])
})

test('the query is an exact token match that never selects user_id, student_id or token', async () => {
  const { db, calls } = fakeDb({ AAAAAAAAAAAA: LIVE })
  await getSharedReportByToken('AAAAAAAAAAAA', { db, now: NOW })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].table, 'shared_reports')
  assert.equal(calls[0].column, 'token')
  assert.equal(calls[0].value, 'AAAAAAAAAAAA')
  for (const forbidden of ['user_id', 'student_id', 'token', '*']) {
    assert.ok(!calls[0].columns.split(',').map(c => c.trim()).includes(forbidden), `selected ${forbidden}`)
  }
})

test("a token cannot retrieve a different report", async () => {
  const { db } = fakeDb({ AAAAAAAAAAAA: LIVE, BBBBBBBBBBBB: OTHER })
  const result = await getSharedReportByToken('BBBBBBBBBBBB', { db, now: NOW })
  assert.ok(result.status === 'found')
  assert.equal(result.report.studentName, 'Synthetic Learner B')
})

test('an expired token returns no report content at all', async () => {
  const { db } = fakeDb({ EEEEEEEEEEEE: EXPIRED })
  const result = await getSharedReportByToken('EEEEEEEEEEEE', { db, now: NOW })
  assert.deepEqual(result, { status: 'expired' })
})

test('a report expiring exactly now is treated as expired', async () => {
  const { db } = fakeDb({ EEEEEEEEEEEE: { ...LIVE, expires_at: NOW.toISOString() } })
  assert.deepEqual(await getSharedReportByToken('EEEEEEEEEEEE', { db, now: NOW }), { status: 'expired' })
})

test('an unknown token is not found', async () => {
  const { db } = fakeDb({ AAAAAAAAAAAA: LIVE })
  assert.deepEqual(await getSharedReportByToken('ZZZZZZZZZZZZ', { db, now: NOW }), { status: 'not_found' })
})

test('malformed tokens are rejected before any database query', async () => {
  const { db, calls } = fakeDb({ AAAAAAAAAAAA: LIVE })
  for (const bad of ['', 'AAAA AAAA', 'AAAA%2C*', "x' or 1=1", 'A'.repeat(65), 'a,b', 'tok/../x']) {
    assert.deepEqual(await getSharedReportByToken(bad, { db, now: NOW }), { status: 'not_found' }, bad)
  }
  assert.equal(calls.length, 0)
})

test('a legacy-format token (lowercase, hyphenated) is still looked up, not rejected', async () => {
  const { db, calls } = fakeDb({ 'legacy-token_1': LIVE })
  const result = await getSharedReportByToken('legacy-token_1', { db, now: NOW })
  assert.equal(result.status, 'found')
  assert.equal(calls.length, 1)
})

test('a database error throws without echoing the token', async () => {
  const { db } = fakeDb({}, { error: 'connection reset' })
  await assert.rejects(
    getSharedReportByToken('SECRETTOKEN1', { db, now: NOW }),
    (err: Error) => err.message.includes('connection reset') && !err.message.includes('SECRETTOKEN1'),
  )
})
