// lib/classes/joinClassByCode.test.ts
//
// Security audit 2026-10-30, F-02 — the join flow's ordering guarantees:
// the attempt is reserved BEFORE the class lookup, a limiter outage or a
// refusal means no lookup at all, a miss keeps its reservation (the guess
// counts) and a hit is refunded. The real limiter and real enrolment are
// proven against a database in classEnrollment.integration.test.ts.
//
// Run with: npx tsx --test lib/classes/joinClassByCode.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joinClassByCode } from './joinClassByCode'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

type Db = NonNullable<NonNullable<Parameters<typeof joinClassByCode>[1]>['db']>

type Script = {
  reserve: { data: unknown; error: { message: string } | null }
  classRow?: Record<string, unknown> | null
  enrolled?: boolean
}

function scriptedDb(script: Script) {
  const log: string[] = []
  const db = {
    async rpc(fn: string) {
      log.push(fn)
      return fn === 'rate_limit_reserve' ? script.reserve : { data: null, error: null }
    },
    from(table: string) {
      return {
        select() {
          const chain = {
            eq(column: string, value: string) { log.push(`${table}.eq(${column}=${value})`); return chain },
            async maybeSingle() {
              if (table === 'teacher_classes') return { data: script.classRow ?? null, error: null }
              return { data: script.enrolled ? { id: 'cs-1' } : null, error: null }
            },
          }
          return chain
        },
        async insert() { log.push(`${table}.insert`); return { error: null } },
      }
    },
  }
  return { db: db as unknown as Db, log }
}

const INPUT = { userId: 'user-1', studentId: 'student-1', classCode: ' mat825abcdefgh ' }
const CLASS_ROW = { id: 'class-1', name: '8A', subject: 'Mathematics', grade: 8, academic_year: '2026', teachers: { full_name: 'T', school: 'S' } }

test('a limiter outage fails closed: throws and never looks the code up', async () => {
  const { db, log } = scriptedDb({ reserve: { data: null, error: { message: 'down' } }, classRow: CLASS_ROW })
  await assert.rejects(joinClassByCode(INPUT, { db }), AttemptLimiterUnavailableError)
  assert.ok(!log.some(l => l.startsWith('teacher_classes')), 'class lookup ran despite limiter outage')
})

test('a refused reservation returns rate_limited and never looks the code up — even for a valid code', async () => {
  const { db, log } = scriptedDb({ reserve: { data: null, error: null }, classRow: CLASS_ROW })
  assert.deepEqual(await joinClassByCode(INPUT, { db }), { status: 'rate_limited' })
  assert.ok(!log.some(l => l.startsWith('teacher_classes')))
})

test('a wrong code keeps its reservation (the guess counts) and enrols nothing', async () => {
  const { db, log } = scriptedDb({ reserve: { data: 'res-1', error: null }, classRow: null })
  assert.deepEqual(await joinClassByCode(INPUT, { db }), { status: 'not_found' })
  assert.ok(!log.includes('rate_limit_release'), 'a miss was refunded')
  assert.ok(!log.includes('class_students.insert'))
})

test('a correct code is refunded, normalised, and enrols the caller-owned learner', async () => {
  const { db, log } = scriptedDb({ reserve: { data: 'res-1', error: null }, classRow: CLASS_ROW })
  const result = await joinClassByCode(INPUT, { db })
  assert.equal(result.status, 'joined')
  assert.ok(log.includes('teacher_classes.eq(class_code=MAT825ABCDEFGH)'))
  assert.ok(log.indexOf('rate_limit_release') < log.indexOf('class_students.insert'))
})

test('an already-enrolled learner is refunded and not inserted twice', async () => {
  const { db, log } = scriptedDb({ reserve: { data: 'res-1', error: null }, classRow: CLASS_ROW, enrolled: true })
  assert.deepEqual(await joinClassByCode(INPUT, { db }), { status: 'already_enrolled' })
  assert.ok(log.includes('rate_limit_release'))
  assert.ok(!log.includes('class_students.insert'))
})
