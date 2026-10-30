// lib/alerts/teacherAlerts.test.ts
//
// Security audit 2026-10-30, F-05: a teacher may raise an alert — which
// messages the learner's parent — only for a learner they actually teach.
// Proves the authorization runs BEFORE any write or notification, and that
// a denied request leaves no row and sends nothing. The canonical ownership
// check and the notifier are mocked; the database client is an injected
// recorder. lib/alerts/teacherAlertsOwnership.test.ts proves the same
// boundary against a real database with the real ownership check.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/alerts/teacherAlerts.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const TEACHER_USER   = '00000000-0000-4000-8000-00000000a001'
const TEACHER_ID     = '00000000-0000-4000-8000-00000000b001'
const TAUGHT_STUDENT = '00000000-0000-4000-8000-00000000c001'
const OTHER_STUDENT  = '00000000-0000-4000-8000-00000000c002'

const ownershipCalls: Array<{ userId: string; studentId: string }> = []
const notified: string[] = []

mock.module('@/lib/compass/ownership', {
  namedExports: {
    resolveTeacherOwnership: async (userId: string, studentId: string) => {
      ownershipCalls.push({ userId, studentId })
      return userId === TEACHER_USER && studentId === TAUGHT_STUDENT
        ? { allowed: true, via: 'teacher_roster' }
        : { allowed: false }
    },
  },
})
mock.module('@/lib/notifications/notify', {
  namedExports: { notifyAlertCreated: async (alertId: string) => { notified.push(alertId) } },
})

let createTeacherAlert: typeof import('./teacherAlerts').createTeacherAlert
type Db = NonNullable<NonNullable<Parameters<typeof createTeacherAlert>[1]>['db']>

function recordingDb(opts: { fail?: boolean } = {}) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = []
  const db = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row })
          return {
            select() {
              return {
                async single() {
                  return opts.fail
                    ? { data: null, error: { message: 'insert rejected' } }
                    : { data: { id: 'alert-1' }, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
  return { db: db as unknown as Db, inserts }
}

before(async () => {
  ({ createTeacherAlert } = await import('./teacherAlerts'))
})

beforeEach(() => {
  ownershipCalls.length = 0
  notified.length = 0
})

const flush = () => new Promise(resolve => setImmediate(resolve))

test('a teacher can raise an alert for a learner they teach, and the parent is notified', async () => {
  const { db, inserts } = recordingDb()
  const result = await createTeacherAlert(
    { userId: TEACHER_USER, teacherId: TEACHER_ID, studentId: TAUGHT_STUDENT, alertType: 'inactive', message: 'Missed three lessons' },
    { db },
  )
  await flush()
  assert.deepEqual(result, { status: 'created', alertId: 'alert-1' })
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].table, 'student_alerts')
  assert.deepEqual(inserts[0].row, {
    student_id: TAUGHT_STUDENT, teacher_id: TEACHER_ID,
    alert_type: 'inactive', message: 'Missed three lessons', is_resolved: false,
  })
  assert.deepEqual(notified, ['alert-1'])
})

test('a learner the teacher does not teach is forbidden — no row, no notification', async () => {
  const { db, inserts } = recordingDb()
  const result = await createTeacherAlert(
    { userId: TEACHER_USER, teacherId: TEACHER_ID, studentId: OTHER_STUDENT, alertType: 'inactive', message: 'Click this link' },
    { db },
  )
  await flush()
  assert.deepEqual(result, { status: 'forbidden' })
  assert.equal(inserts.length, 0)
  assert.equal(notified.length, 0)
})

test('authorization is decided for the authenticated user and the requested learner', async () => {
  const { db } = recordingDb()
  await createTeacherAlert(
    { userId: TEACHER_USER, teacherId: TEACHER_ID, studentId: OTHER_STUDENT, alertType: 'inactive', message: 'y' },
    { db },
  )
  assert.deepEqual(ownershipCalls, [{ userId: TEACHER_USER, studentId: OTHER_STUDENT }])
})

test('an unrelated account is forbidden even when it names a real teacher id', async () => {
  const { db, inserts } = recordingDb()
  const result = await createTeacherAlert(
    { userId: '00000000-0000-4000-8000-00000000a999', teacherId: TEACHER_ID, studentId: TAUGHT_STUDENT, alertType: 'inactive', message: 'y' },
    { db },
  )
  await flush()
  assert.deepEqual(result, { status: 'forbidden' })
  assert.equal(inserts.length, 0)
  assert.equal(notified.length, 0)
})

test('a failed insert throws and sends no notification', async () => {
  const { db } = recordingDb({ fail: true })
  await assert.rejects(
    createTeacherAlert(
      { userId: TEACHER_USER, teacherId: TEACHER_ID, studentId: TAUGHT_STUDENT, alertType: 'inactive', message: 'y' },
      { db },
    ),
    /insert rejected/,
  )
  await flush()
  assert.equal(notified.length, 0)
})
