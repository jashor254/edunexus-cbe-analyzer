// lib/core/transfers.test.ts
//
// Sprint 10 (Core Administration Completion) — lib/core/transfers.ts had
// zero test coverage before this sprint (docs/architecture/
// sprint9-school-operations-excellence-audit.md §Phase 7: "None found" for
// transfers — the only caller was a FutureModule placeholder tile). First
// real coverage, now that the new Transfer page
// (app/teacher/core-office/academic/transfer) calls transferLearner().
//
// Run: npx tsx --env-file=.env.local --test lib/core/transfers.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { transferLearner, getLearnerTransfers } from '@/lib/core/transfers'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_S10_TRANSFERS_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string }> {
  const email = `s10-transfer-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id }
}

let schoolId: string
let classId: string
let termId: string
let academicYearId: string
let adminSchoolUserId: string
let learnerId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  const adminSchoolUser = await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  // learner_transfers.processed_by is a FK to school_users(id), not
  // auth.uid() — see the app/api/core/transfers/route.ts fix this sprint
  // made for exactly this (same bug class as promotions.test.ts).
  adminSchoolUserId = adminSchoolUser.id

  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', schoolId).limit(1)
  classId = classes![0].id
  academicYearId = classes![0].academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  termId = terms![0].id

  const learner = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-1`, first_name: 'Transfer', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerId = learner.learnerId!
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

test('transferLearner (direction: out): records a transfer, marks the learner transferred, withdraws active enrollment', async () => {
  const transfer = await transferLearner(adminSchoolUserId, {
    learner_id: learnerId,
    direction: 'out',
    transfer_date: new Date().toISOString().split('T')[0],
    to_school_name: `${SYNTHETIC_MARKER} Destination School`,
    reason: 'Family relocation',
  })
  assert.equal(transfer.learner_id, learnerId)
  assert.equal(transfer.direction, 'out')
  assert.equal(transfer.from_school_id, schoolId)
  assert.equal(transfer.to_school_name, `${SYNTHETIC_MARKER} Destination School`)

  const { data: learner } = await db.from('learners').select('status').eq('id', learnerId).single()
  assert.equal(learner!.status, 'transferred')

  const { data: enrollments } = await db.from('learner_enrollments').select('status').eq('learner_id', learnerId)
  assert.ok(enrollments!.every(e => e.status !== 'active'), 'transfer-out must withdraw every active enrollment')
})

test('getLearnerTransfers: returns the transfer just recorded', async () => {
  const transfers = await getLearnerTransfers(learnerId)
  assert.equal(transfers.length, 1)
  assert.equal(transfers[0].direction, 'out')
  assert.equal(transfers[0].reason, 'Family relocation')
})
