// lib/core/termRollover.test.ts
//
// Phase 4 ("The Term Turns and the Learner Moves"), Task C — proves the
// Phase 3 audit's P0 finding is closed: before this, runEndOfTerm advanced
// the school to the next term but never re-enrolled anyone, so the first
// day of the new term every class roster the platform could compute was
// empty (lib/core/endOfTerm.ts vs lib/core/learners.ts::getClassRoster).
//
// Run: npx tsx --env-file=.env.local --test lib/core/termRollover.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { withdrawLearner, getClassRoster, rollEnrollmentsToTerm } from '@/lib/core/learners'
import { transferLearner } from '@/lib/core/transfers'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE4_TERM_ROLLOVER_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

let schoolId: string
let academicYearId: string
let classA_id: string
let term1Id: string
let term2Id: string

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', schoolId).limit(1)
  classA_id = classes![0].id
  academicYearId = classes![0].academic_year_id

  const term1 = await repos.schools.findCurrentTerm(schoolId)
  term1Id = term1!.id

  // activateSchool() already creates all 3 terms for the year — reuse the
  // existing term_number 2 rather than inserting a duplicate (which would
  // collide with terms_school_id_academic_year_id_term_number_key).
  const allTerms = await repos.schools.listTerms(schoolId, academicYearId)
  const term2 = allTerms.find(t => t.term_number === 2)!
  term2Id = term2.id
})

after(async () => {
  await db.from('learner_enrollments').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of createdAuthUserIds) await deleteAuthUserOrThrow(db, id)
})

async function admit(admissionNumber: string, classId: string, termId: string): Promise<string> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  return result.learnerId!
}

test('active learner rolls forward into the new term, same class', async () => {
  const learnerId = await admit(`${SYNTHETIC_MARKER}-ACTIVE`, classA_id, term1Id)
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)

  const rosterTerm2 = await getClassRoster(classA_id, term2Id)
  assert.ok(rosterTerm2.some(l => l.id === learnerId))
})

test('withdrawn learner does NOT roll forward', async () => {
  const learnerId = await admit(`${SYNTHETIC_MARKER}-WITHDRAWN`, classA_id, term1Id)
  await withdrawLearner(learnerId, schoolId, term1Id)
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)

  const rosterTerm2 = await getClassRoster(classA_id, term2Id)
  assert.ok(!rosterTerm2.some(l => l.id === learnerId))
})

test('transferred-out learner does NOT roll forward', async () => {
  const learnerId = await admit(`${SYNTHETIC_MARKER}-TRANSFERRED`, classA_id, term1Id)
  await transferLearner(
    (await db.from('school_users').select('id').eq('school_id', schoolId).limit(1).single()).data!.id,
    { learner_id: learnerId, direction: 'out', transfer_date: new Date().toISOString().split('T')[0], to_school_name: 'Another School', reason: 'relocation' }
  )
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)

  const rosterTerm2 = await getClassRoster(classA_id, term2Id)
  assert.ok(!rosterTerm2.some(l => l.id === learnerId))
})

test('rollover retry produces no duplicate active enrollments', async () => {
  const learnerId = await admit(`${SYNTHETIC_MARKER}-RETRY`, classA_id, term1Id)
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId) // retry

  const { data: rows } = await db.from('learner_enrollments').select('id').eq('learner_id', learnerId).eq('term_id', term2Id)
  assert.equal(rows?.length, 1)
})

test('multiple classes roll correctly, each into its own roster', async () => {
  const { data: classB } = await db.from('classes').insert({
    school_id: schoolId, class_name: 'G7 B Rollover', display_name: 'G7 B Rollover',
    grade_id: (await db.from('classes').select('grade_id').eq('id', classA_id).single()).data!.grade_id,
    academic_year_id: academicYearId,
  }).select('id').single()
  const classB_id = classB!.id

  const learnerA = await admit(`${SYNTHETIC_MARKER}-MULTI-A`, classA_id, term1Id)
  const learnerB = await admit(`${SYNTHETIC_MARKER}-MULTI-B`, classB_id, term1Id)

  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)
  await rollEnrollmentsToTerm(schoolId, classB_id, term1Id, term2Id, academicYearId)

  const rosterA2 = await getClassRoster(classA_id, term2Id)
  const rosterB2 = await getClassRoster(classB_id, term2Id)
  assert.ok(rosterA2.some(l => l.id === learnerA))
  assert.ok(!rosterA2.some(l => l.id === learnerB))
  assert.ok(rosterB2.some(l => l.id === learnerB))
  assert.ok(!rosterB2.some(l => l.id === learnerA))
})

test('source enrollment history is unchanged by rollover (Term 1 roster still readable, still active)', async () => {
  const learnerId = await admit(`${SYNTHETIC_MARKER}-HISTORY`, classA_id, term1Id)
  await rollEnrollmentsToTerm(schoolId, classA_id, term1Id, term2Id, academicYearId)

  const rosterTerm1 = await getClassRoster(classA_id, term1Id)
  assert.ok(rosterTerm1.some(l => l.id === learnerId), 'Term 1 roster must remain intact — rollover creates a NEW row, never edits the old one')

  const { data: term1Row } = await db.from('learner_enrollments').select('ended_at').eq('learner_id', learnerId).eq('term_id', term1Id).single()
  assert.equal(term1Row?.ended_at, null, 'the Term 1 row itself is untouched — ended_at only applies within-term (a move), not across a term boundary')
})

test('a school with no learners in a class rolls forward cleanly (zero-row no-op, not an error)', async () => {
  const { data: emptyClass } = await db.from('classes').insert({
    school_id: schoolId, class_name: 'G7 Empty', display_name: 'G7 Empty',
    grade_id: (await db.from('classes').select('grade_id').eq('id', classA_id).single()).data!.grade_id,
    academic_year_id: academicYearId,
  }).select('id').single()

  const count = await rollEnrollmentsToTerm(schoolId, emptyClass!.id, term1Id, term2Id, academicYearId)
  assert.equal(count, 0)
})
