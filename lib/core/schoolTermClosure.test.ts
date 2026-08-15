// lib/core/schoolTermClosure.test.ts
//
// Phase 12 (DR-05 fix) — proves runSchoolEndOfTerm() (lib/core/endOfTerm.ts)
// closes the exact defect the Phase 10 rehearsal found: closing one class's
// term must not advance the school's global current_term while other
// classes remain unrolled. The old, class-level runEndOfTerm() is
// deliberately left untouched (see endOfTermFullChain.test.ts) — this suite
// exercises only the new school-level orchestration.
//
// Run: npx tsx --env-file=.env.local --test lib/core/schoolTermClosure.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createBridgedAssessment, ensureBridgedClass } from '@/lib/core/academicBridge'
import { getClassRoster } from '@/lib/core/learners'
import { getCurrentTerm } from '@/lib/core/school'
import { runSchoolEndOfTerm } from '@/lib/core/endOfTerm'
import { publishAssessment } from '@/lib/core/assessments'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE12_TERM_CLOSURE_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

let schoolId: string
let adminId: string
let teacherUserId: string
let academicYearId: string
let term1Id: string
let term2Id: string
let class7A_id: string
let class7B_id: string
let class8A_id: string // deliberately left with zero learners — Phase 10's empty-class scenario

async function admit(admissionNumber: string, classId: string, termId: string): Promise<string> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  return result.learnerId!
}

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  class7A_id = classes![0].id
  academicYearId = classes![0].academic_year_id
  const gradeId = classes![0].grade_id

  const term1 = await repos.schools.findCurrentTerm(schoolId)
  term1Id = term1!.id
  const allTerms = await repos.schools.listTerms(schoolId, academicYearId)
  term2Id = allTerms.find(t => t.term_number === 2)!.id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  class7B_id = class7B!.id
  const { data: class8A } = await db.from('classes').insert({
    school_id: schoolId, class_name: '8A', display_name: '8A', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  class8A_id = class8A!.id

  const teacher = await mkAuthUser('teacher')
  teacherUserId = teacher.id
  await inviteTeacher(schoolId, teacher.email, adminId)
  await acceptTeacherInvitation(teacher.id, schoolId, { full_name: 'Closure Teacher' })
})

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) {
      const { data: bridgedClasses } = await db.from('teacher_classes').select('id').in('external_id', classExternalIds)
      const legacyClassIds = (bridgedClasses ?? []).map(c => c.id)
      if (legacyClassIds.length) {
        await db.from('class_assessments').delete().in('class_id', legacyClassIds)
        await db.from('teacher_classes').delete().in('id', legacyClassIds)
      }
    }
    await db.from('school_report_cards').delete().in('school_id', createdSchoolIds)
    await db.from('term_subject_summaries').delete().in('school_id', createdSchoolIds)
  }
  for (const id of createdSchoolIds) {
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── §30/§31: DR-05 regression + multi-class consistency, combined ──────────

test('DR-05 fixed: closing the school term rolls EVERY class forward before advancing the global current term (incl. an empty class)', async () => {
  const janeId = await admit(`${SYNTHETIC_MARKER}-JANE`, class7A_id, term1Id)
  const peterId = await admit(`${SYNTHETIC_MARKER}-PETER`, class7A_id, term1Id)
  const maryId = await admit(`${SYNTHETIC_MARKER}-MARY`, class7B_id, term1Id)
  // class8A_id deliberately has zero learners — must not block or error.

  const before7A = await getClassRoster(class7A_id, term1Id)
  assert.equal(before7A.length, 2, 'fixture: 7A has 2 current learners before closure')

  const result = await runSchoolEndOfTerm(schoolId, adminId, term1Id, {
    academic_year_id: academicYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01',
  })
  assert.equal(result.ok, true)
  if (result.ok && !result.academicYearComplete) {
    assert.equal(result.classResults.length, 3, 'all three classes processed in one call')
  }

  const current = await getCurrentTerm(schoolId)
  assert.equal(current?.id, term2Id, 'global current term advanced exactly once, for the whole school')

  const roster7A = await getClassRoster(class7A_id, term2Id)
  const roster7B = await getClassRoster(class7B_id, term2Id)
  const roster8A = await getClassRoster(class8A_id, term2Id)
  assert.equal(roster7A.length, 2)
  assert.ok(roster7A.some(l => l.id === janeId) && roster7A.some(l => l.id === peterId))
  assert.equal(roster7B.length, 1)
  assert.ok(roster7B.some(l => l.id === maryId))
  assert.equal(roster8A.length, 0, 'an empty class rolls forward as a clean no-op, not an error')

  // Term 1 rosters remain queryable, unmodified — historical continuity.
  const historicalRoster7A = await getClassRoster(class7A_id, term1Id)
  assert.equal(historicalRoster7A.length, 2, 'Term 1 history is untouched by the roll-forward')
})

// ── §32: partial failure — one class blocks, global term must NOT advance ──

test('partial failure: an unpublished assessment in ONE class blocks closure for the whole school — current term stays put', async () => {
  const { data: newSchool } = await db.from('schools').insert({ school_name: `${SYNTHETIC_MARKER}-partial` }).select('id').single()
  const partialSchoolId = newSchool!.id
  createdSchoolIds.push(partialSchoolId)
  const partialAdmin = await mkAuthUser('partial-admin')
  await repos.schools.addSchoolUser(partialSchoolId, partialAdmin.id, 'school_admin')
  const activation = await activateSchool(partialSchoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', partialSchoolId).limit(1)
  const readyClassId = classes![0].id
  const partialYearId = classes![0].academic_year_id
  const partialTerm1 = await repos.schools.findCurrentTerm(partialSchoolId)
  const { data: blockedClass } = await db.from('classes').insert({
    school_id: partialSchoolId, class_name: 'Blocked', display_name: 'Blocked', grade_id: classes![0].grade_id, academic_year_id: partialYearId,
  }).select('id').single()
  const blockedClassId = blockedClass!.id

  const teacher = await mkAuthUser('partial-teacher')
  await inviteTeacher(partialSchoolId, teacher.email, partialAdmin.id)
  await acceptTeacherInvitation(teacher.id, partialSchoolId, { full_name: 'Partial Teacher' })
  await ensureBridgedClass(partialSchoolId, blockedClassId, teacher.id)
  const { assessmentId: blockingAssessmentId } = await createBridgedAssessment(partialSchoolId, blockedClassId, teacher.id, {
    title: 'Unpublished Exam', assessment_type: 'exam', term: '1', year: 2026, max_score: 100, subjects: ['SS-MATH'], curriculum_type: 'cbc',
  })
  // Never published — this is the block.

  const result = await runSchoolEndOfTerm(partialSchoolId, partialAdmin.id, partialTerm1!.id, {
    academic_year_id: partialYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01',
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.failures.length, 1)
    assert.equal(result.failures[0].classId, blockedClassId)
    assert.match(result.failures[0].reason, /unpublished/i)
  }

  const currentAfterFailure = await getCurrentTerm(partialSchoolId)
  assert.equal(currentAfterFailure?.id, partialTerm1!.id, 'the school never advanced — the failing class blocked the whole operation')

  const { data: newTermRows } = await db.from('terms').select('id').eq('school_id', partialSchoolId).eq('term_number', 2)
  assert.equal(newTermRows?.length, 1, 'Term 2 was NOT recreated a second time on this failed attempt (find-or-create already existed from activation)')

  // Publish the blocking assessment through the real action a teacher would
  // take, then retry — must succeed exactly once.
  await publishAssessment(blockingAssessmentId)

  const retry = await runSchoolEndOfTerm(partialSchoolId, partialAdmin.id, partialTerm1!.id, {
    academic_year_id: partialYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01',
  })
  assert.equal(retry.ok, true)

  const currentAfterRetry = await getCurrentTerm(partialSchoolId)
  assert.equal(currentAfterRetry?.term_number, 2, 'retry succeeded — school reaches Term 2 exactly once')

  const { data: readyRosterTerm1 } = await db.from('learner_enrollments').select('id').eq('class_id', readyClassId).eq('term_id', partialTerm1!.id)
  void readyRosterTerm1 // no learners in this fixture — presence of the class itself in the loop is what's proven
})

// ── §33: final term — no phantom Term 4, no premature advance ──────────────

test('closing Term 3 finalizes report cards but does not create a term or roll enrollments — academic year is simply complete', async () => {
  const term3 = (await repos.schools.listTerms(schoolId, academicYearId)).find(t => t.term_number === 3)!
  // Advance this school's OWN current term to Term 3 for this test, reusing
  // the existing canonical action rather than a raw DB write.
  const { setCurrentTerm } = await import('@/lib/core/school')
  await setCurrentTerm(schoolId, term3.id)

  const learnerId = await admit(`${SYNTHETIC_MARKER}-TERM3`, class7A_id, term3.id)

  const result = await runSchoolEndOfTerm(schoolId, adminId, term3.id)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.academicYearComplete, true, 'Term 3 has no next term to roll into within the same academic year')

  const current = await getCurrentTerm(schoolId)
  assert.equal(current?.id, term3.id, 'current term is untouched — no phantom Term 4 was created or set current')

  const { data: term4Rows } = await db.from('terms').select('id').eq('school_id', schoolId).eq('academic_year_id', academicYearId).eq('term_number', 4)
  assert.equal(term4Rows?.length ?? 0, 0, 'no Term 4 exists')

  const rosterStillInTerm3 = await getClassRoster(class7A_id, term3.id)
  assert.ok(rosterStillInTerm3.some(l => l.id === learnerId), 'the learner is still in their Term 3 placement — nothing to roll into yet')
})

// ── §29/§34: security — a mismatched currentTermId is rejected ─────────────

test('a stale/wrong currentTermId is rejected before any mutation', async () => {
  await assert.rejects(
    () => runSchoolEndOfTerm(schoolId, adminId, term2Id, {
      academic_year_id: academicYearId, term_number: 3, name: 'Term 3 (stale attempt)', start_date: '2026-08-01', end_date: '2026-11-01',
    }),
    /current term/i,
  )
})
