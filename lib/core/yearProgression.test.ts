// lib/core/yearProgression.test.ts
//
// Phase 6 (academic year progression / learner promotion) — proves
// runAnnualPromotion() is the canonical year-progression event: a learner
// progresses (or repeats, or is excluded, or graduates) into a NEW
// academic year while their prior year's terms, learning areas,
// assessments, marks, evidence and identity remain completely unchanged.
//
// Most of the underlying mechanism (runAnnualPromotion, previewPromotion,
// learner_promotions) already existed before this phase — this file proves
// it against the specific scenarios Phase 6 requires, plus the three real
// gaps this phase's own audit found and fixed: explicit cross-school
// scoping, legacy roster convergence on promotion, and the Grade 12
// terminal-grade suggestion bug (previewPromotion only special-cased
// Grade 9 before this phase).
//
// Run: npx tsx --env-file=.env.local --test lib/core/yearProgression.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { getClassRoster } from '@/lib/core/learners'
import { transferLearner } from '@/lib/core/transfers'
import { withdrawLearner } from '@/lib/core/learners'
import { runAnnualPromotion, previewPromotion } from '@/lib/core/promotions'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { SchoolMismatchError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE6_YEAR_PROGRESSION_TEST'
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
let otherSchoolId: string
let adminId: string
let adminSchoolUserId: string
let year2026Id: string
let year2027Id: string
let class7A_id: string
let class7B_id: string
let class8A_id: string
let class8B_id: string
let term1_2026Id: string
let term2_2026Id: string
let term3_2026Id: string
let teacherUserId: string

let janeId: string   // normal promotion, full multi-term bridged history
let peterId: string  // repeater
let maryId: string   // stream change
let transferredId: string
let withdrawnId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const adminSchoolUser = await repos.teachers.findSchoolUser(adminId, schoolId)
  adminSchoolUserId = adminSchoolUser!.id

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const grade7Id = classes![0].grade_id
  year2026Id = classes![0].academic_year_id
  class7A_id = classes![0].id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: grade7Id, academic_year_id: year2026Id,
  }).select('id').single()
  class7B_id = class7B!.id

  const { data: allTerms2026 } = await db.from('terms').select('id, term_number').eq('school_id', schoolId).eq('academic_year_id', year2026Id).order('term_number')
  term1_2026Id = allTerms2026!.find(t => t.term_number === 1)!.id
  term2_2026Id = allTerms2026!.find(t => t.term_number === 2)!.id
  term3_2026Id = allTerms2026!.find(t => t.term_number === 3)!.id

  // ── The new academic year, 2027, with Grade 8 classes ──
  const { data: grade8 } = await db.from('grades').select('id').eq('code', 'G8').single()
  const year2027 = await repos.schools.insertAcademicYear(schoolId, { name: '2027', start_date: '2027-01-01', end_date: '2027-12-31' })
  year2027Id = year2027.id
  await repos.schools.insertTerm(schoolId, { academic_year_id: year2027Id, term_number: 1, name: 'Term 1 2027', start_date: '2027-01-01', end_date: '2027-04-01' })

  const { data: class8A } = await db.from('classes').insert({
    school_id: schoolId, class_name: '8A', display_name: '8A', grade_id: grade8!.id, academic_year_id: year2027Id,
  }).select('id').single()
  class8A_id = class8A!.id
  const { data: class8B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '8B', display_name: '8B', grade_id: grade8!.id, academic_year_id: year2027Id,
  }).select('id').single()
  class8B_id = class8B!.id

  const teacherUser = await mkAuthUser('teacher')
  teacherUserId = teacherUser.id
  await inviteTeacher(schoolId, teacherUser.email, adminId)
  await acceptTeacherInvitation(teacherUser.id, schoolId, { full_name: 'Progression Teacher' })

  // ── Learners ──
  janeId = (await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-JANE`, first_name: 'Jane', last_name: 'Progression', class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id })).learnerId!
  peterId = (await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-PETER`, first_name: 'Peter', last_name: 'Progression', class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id })).learnerId!
  maryId = (await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-MARY`, first_name: 'Mary', last_name: 'Progression', class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id })).learnerId!
  transferredId = (await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-XFER`, first_name: 'Transferred', last_name: 'Learner', class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id })).learnerId!
  withdrawnId = (await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-WD`, first_name: 'Withdrawn', last_name: 'Learner', class_id: class7B_id, term_id: term1_2026Id, academic_year_id: year2026Id })).learnerId!

  // Transferred/withdrawn learners leave BEFORE year close.
  await transferLearner(adminSchoolUserId, { learner_id: transferredId, direction: 'out', transfer_date: '2026-11-01', to_school_name: 'Another School', reason: 'relocation' })
  await withdrawLearner(withdrawnId, schoolId, term1_2026Id)

  // ── Jane's multi-term bridged history: Term 1/2/3 Mathematics ──
  const bridgedClass = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(janeId), bridgedClass)
  for (const [term, year] of [['1', 2026], ['2', 2026], ['3', 2026]] as const) {
    const { assessmentId } = await createBridgedAssessment(schoolId, class7A_id, teacherUserId, {
      title: `Term ${term} Math Exam`, assessment_type: 'exam', term, year, max_score: 100, subjects: ['SS-MATH'], curriculum_type: 'cbc',
    })
    await recordBridgedMarks(schoolId, assessmentId, bridgedClass, teacherUserId, [
      { coreLearnerId: asLearnerId(janeId), admission_number: `${SYNTHETIC_MARKER}-JANE`, student_name: 'Jane Progression', subject_scores: { 'SS-MATH': 70 + Number(term) }, total_marks: 70 + Number(term), mean_score: 70 + Number(term) },
    ])
  }
  void legacyStudentId // re-resolved by external_id in the tests that need it

  // ── A second, unrelated school for the cross-school rejection test ──
  const otherAdmin = await mkAuthUser('other-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')
  await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
})

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('learner_marks').delete().in('student_id', studentIds)
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
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
  }
  for (const id of createdSchoolIds) {
    await db.from('learner_promotions').delete().eq('school_id', id)
    await db.from('learner_transfers').delete().eq('from_school_id', id)
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

// ── §29: normal promotion + §37: current vs historical in one test ──────

test('normal progression: Grade 7 -> Grade 8, current roster moves, 2026 Grade 7 stays queryable', async () => {
  // Task F proof, before the promotion runs: Jane's legacy 7A roster
  // membership is real (she was bridged in the before() fixture).
  const { data: janeStudentBefore } = await db.from('students').select('id').eq('external_id', janeId).single()
  const { data: bridgedClassRow } = await db.from('teacher_classes').select('id').eq('external_id', class7A_id).single()
  const { data: legacyRosterBefore } = await db.from('class_students').select('id').eq('class_id', bridgedClassRow!.id).eq('student_id', janeStudentBefore!.id)
  assert.equal(legacyRosterBefore?.length, 1)

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: janeId, promotion_type: 'promoted', to_class_id: class8A_id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 1)
  assert.deepEqual(result.errors, [])

  // Task F proof, after: the stale legacy 7A roster membership converges
  // (removed) the same way Phase 5 proved for a mid-term move — a teacher
  // whose legacy gradebook still shows 7A must not keep seeing Jane there.
  const { data: legacyRosterAfter } = await db.from('class_students').select('id').eq('class_id', bridgedClassRow!.id).eq('student_id', janeStudentBefore!.id)
  assert.equal(legacyRosterAfter?.length, 0, 'legacy roster convergence must fire on promotion, same as on a mid-term move')

  // Current: Jane is in 8A now — the CURRENT roster query (getClassRoster,
  // established as current-only since Phase 4) correctly shows her there.
  const roster8A = await getClassRoster(class8A_id, (await db.from('terms').select('id').eq('academic_year_id', year2027Id).single()).data!.id)
  assert.ok(roster8A.some(l => l.id === janeId))

  // Historical: getClassRoster is deliberately CURRENT-only (Phase 4/5's
  // own established contract — a withdrawn/promoted-out learner correctly
  // stops appearing there, even for a past term, exactly like a
  // transferred or withdrawn learner already does). The actual historical
  // proof is that the raw enrollment ROW for 2026 Term 1 still exists,
  // unaltered — class_id/term_id/academic_year_id are historical facts,
  // never rewritten; only status/ended_at mark it no longer current.
  const { data: historicalRow } = await db.from('learner_enrollments')
    .select('class_id, term_id, academic_year_id, status, ended_at')
    .eq('learner_id', janeId).eq('term_id', term1_2026Id).single()
  assert.equal(historicalRow?.class_id, class7A_id, 'the 2026 Term 1 placement fact is preserved exactly')
  assert.equal(historicalRow?.academic_year_id, year2026Id)
  assert.ok(historicalRow?.ended_at, 'no longer current, but never deleted or rewritten')
})

// ── §9: identity proof ───────────────────────────────────────────────────

test('learner identity is unchanged by promotion — same learners.id, same bridged students.id', async () => {
  const { data: learnerRow } = await db.from('learners').select('id').eq('id', janeId).single()
  assert.equal(learnerRow?.id, janeId)

  const { data: studentRow } = await db.from('students').select('id, external_id').eq('external_id', janeId).single()
  assert.equal(studentRow?.external_id, janeId, 'no duplicate/second bridge was created for Grade 8')
})

// ── §22/§36: multi-term learning-area history, exact values ─────────────

test('Term 1/2/3 Mathematics history for Jane remains distinct and unchanged after promotion', async () => {
  const { data: janeStudent } = await db.from('students').select('id').eq('external_id', janeId).single()
  const legacyStudentId = janeStudent!.id

  const { data: marks } = await db.from('learner_marks').select('total_marks').eq('student_id', legacyStudentId).order('total_marks')
  assert.equal(marks?.length, 3, 'all three terms of Mathematics history survive as three distinct rows, not collapsed')
  assert.deepEqual(marks?.map(m => m.total_marks), [71, 72, 73])

  const { data: evidenceRows } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  assert.equal(evidenceRows?.length, 3, 'one evidence row per term, not merged into a single current state')
})

// ── §30: repeater ─────────────────────────────────────────────────────────

test('repeater: Peter repeats Grade 7 — 2026 history remains, a NEW 2027 Grade 7 placement exists (not the same row)', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: peterId, promotion_type: 'repeated', to_class_id: class7A_id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 1)

  const { data: peterEnrollments } = await db.from('learner_enrollments').select('academic_year_id, class_id, ended_at').eq('learner_id', peterId).order('created_at')
  assert.equal(peterEnrollments?.length, 2)
  assert.equal(peterEnrollments?.[0].academic_year_id, year2026Id)
  assert.ok(peterEnrollments?.[0].ended_at, '2026 Grade 7 placement is closed, not overwritten')
  assert.equal(peterEnrollments?.[1].academic_year_id, year2027Id)
  assert.equal(peterEnrollments?.[1].class_id, class7A_id)
  assert.equal(peterEnrollments?.[1].ended_at, null)
})

// ── §31: stream change ────────────────────────────────────────────────────

test('stream change: Mary 2026 7A -> 2027 8B — historical 7A remains, current 8B is correct', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: maryId, promotion_type: 'promoted', to_class_id: class8B_id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 1)

  // getClassRoster is current-only (see the normal-progression test's own
  // note) — the historical fact is proven from the raw enrollment row.
  const { data: historicalRow } = await db.from('learner_enrollments')
    .select('class_id, ended_at').eq('learner_id', maryId).eq('term_id', term1_2026Id).single()
  assert.equal(historicalRow?.class_id, class7A_id, 'historical 7A placement fact is preserved')
  assert.ok(historicalRow?.ended_at)

  const term1_2027 = (await db.from('terms').select('id').eq('academic_year_id', year2027Id).single()).data!.id
  const roster8B_2027 = await getClassRoster(class8B_id, term1_2027)
  assert.ok(roster8B_2027.some(l => l.id === maryId))
})

// ── §32/§33: transferred/withdrawn learners are excluded ────────────────

test('a transferred-out learner is excluded from the promotion preview and cannot be promoted', async () => {
  const preview = await previewPromotion(schoolId, year2026Id, term1_2026Id)
  assert.ok(!preview.some(p => p.learner_id === transferredId), 'must not even appear as eligible')

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: transferredId, promotion_type: 'promoted', to_class_id: class8A_id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)
})

test('a withdrawn learner is excluded from the promotion preview and cannot be promoted', async () => {
  const preview = await previewPromotion(schoolId, year2026Id, term1_2026Id)
  assert.ok(!preview.some(p => p.learner_id === withdrawnId))

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: withdrawnId, promotion_type: 'promoted', to_class_id: class8A_id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)
})

// ── §34: duplicate run ────────────────────────────────────────────────────

test('running promotion twice for the same learner+year creates no duplicate current enrollment or promotion history', async () => {
  const input = {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: janeId, promotion_type: 'promoted' as const, to_class_id: class8A_id, to_academic_year_id: year2027Id }],
  }
  // Jane was already promoted in the first test above — this proves a
  // SECOND attempt at the same learner+year is refused, not duplicated.
  const retry = await runAnnualPromotion(schoolId, adminSchoolUserId, input)
  assert.equal(retry.processed, 0)
  assert.equal(retry.errors.length, 1)

  const { data: promotionRows } = await db.from('learner_promotions').select('id').eq('learner_id', janeId).eq('from_academic_year_id', year2026Id)
  assert.equal(promotionRows?.length, 1)

  const { data: currentEnrollments } = await db.from('learner_enrollments').select('id').eq('learner_id', janeId).eq('academic_year_id', year2027Id).is('ended_at', null)
  assert.equal(currentEnrollments?.length, 1)
})

// ── §35: cross-school rejection ───────────────────────────────────────────

test('a destination class/year belonging to a different school is rejected', async () => {
  const otherYear = await repos.schools.findCurrentAcademicYear(otherSchoolId)
  const { data: otherClasses } = await db.from('classes').select('id').eq('school_id', otherSchoolId).limit(1)

  const learner = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-XSCHOOL`, first_name: 'Cross', last_name: 'School',
    class_id: class7B_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!

  // Cross-school DESTINATION CLASS (same-school destination year).
  const resultBadClass = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: learner, promotion_type: 'promoted', to_class_id: otherClasses![0].id, to_academic_year_id: year2027Id }],
  })
  assert.equal(resultBadClass.processed, 0)
  assert.equal(resultBadClass.errors.length, 1)

  // Cross-school DESTINATION YEAR.
  const resultBadYear = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: learner, promotion_type: 'promoted', to_class_id: class8A_id, to_academic_year_id: otherYear!.id }],
  })
  assert.equal(resultBadYear.processed, 0)
  assert.equal(resultBadYear.errors.length, 1)
})

test('a cross-school FROM academic year is rejected up front', async () => {
  const otherYear = await repos.schools.findCurrentAcademicYear(otherSchoolId)
  await assert.rejects(
    () => runAnnualPromotion(schoolId, adminSchoolUserId, {
      academic_year_id: otherYear!.id,
      decisions: [{ learner_id: janeId, promotion_type: 'promoted', to_class_id: class8A_id, to_academic_year_id: year2027Id }],
    }),
    SchoolMismatchError
  )
})

// ── §16: Grade 12 (not just Grade 9) suggests graduate, not promote ─────

// ── Phase 11 — promotion atomicity / stranded-learner recovery ─────────────
//
// Reproduces the exact Phase 10 rehearsal defect: a destination academic
// year that exists but has no term yet. Before the fix, insertPromotion and
// withdrawActiveEnrollments both ran before the missing term was ever
// discovered, permanently stranding the learner (withdrawn, "already
// promoted" per the duplicate guard, enrolled nowhere, unretryable).

let year2028Id: string
let class9A_id: string

test('Phase 11 fixture: a destination year that exists but has no term yet', async () => {
  const year2028 = await repos.schools.insertAcademicYear(schoolId, { name: '2028', start_date: '2028-01-01', end_date: '2028-12-31' })
  year2028Id = year2028.id
  const { data: grade8 } = await db.from('grades').select('id').eq('code', 'G8').single()
  const { data: class9A } = await db.from('classes').insert({
    school_id: schoolId, class_name: '9A', display_name: '9A', grade_id: grade8!.id, academic_year_id: year2028Id,
  }).select('id').single()
  class9A_id = class9A!.id

  const { data: terms } = await db.from('terms').select('id').eq('academic_year_id', year2028Id)
  assert.equal(terms?.length, 0, 'fixture: 2028 genuinely has no term yet')
})

test('missing destination term (promoted): fails safely — source enrollment stays current, no promotion row committed', async () => {
  const graceId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-GRACE`, first_name: 'Grace', last_name: 'Stranded',
    class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: graceId, promotion_type: 'promoted', to_class_id: class9A_id, to_academic_year_id: year2028Id }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /no terms/i)

  // The core invariant: Grace is institutionally placed somewhere valid —
  // her ORIGINAL 2026 7A enrollment, untouched.
  const { data: enrollment } = await db.from('learner_enrollments')
    .select('class_id, status, ended_at').eq('learner_id', graceId).eq('term_id', term1_2026Id).single()
  assert.equal(enrollment?.class_id, class7A_id)
  assert.equal(enrollment?.status, 'active')
  assert.equal(enrollment?.ended_at, null, 'never withdrawn — the old bug withdrew this before discovering the missing term')

  const { data: promotionRows } = await db.from('learner_promotions').select('id').eq('learner_id', graceId)
  assert.equal(promotionRows?.length, 0, 'no audit row for an attempt that never produced a destination — retry must remain possible')
})

test('missing destination term (repeated): same safe-failure guarantee for the repeat decision type', async () => {
  const henryId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-HENRY`, first_name: 'Henry', last_name: 'Stranded',
    class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: henryId, promotion_type: 'repeated', to_class_id: class9A_id, to_academic_year_id: year2028Id }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)

  const { data: enrollment } = await db.from('learner_enrollments')
    .select('status, ended_at').eq('learner_id', henryId).eq('term_id', term1_2026Id).single()
  assert.equal(enrollment?.status, 'active')
  assert.equal(enrollment?.ended_at, null)

  const { data: promotionRows } = await db.from('learner_promotions').select('id').eq('learner_id', henryId)
  assert.equal(promotionRows?.length, 0)
})

test('retry after the admin creates the missing term: both learners now promote successfully', async () => {
  await repos.schools.insertTerm(schoolId, { academic_year_id: year2028Id, term_number: 1, name: 'Term 1 2028', start_date: '2028-01-01', end_date: '2028-04-01' })

  const { data: graceRow } = await db.from('learners').select('id').eq('school_id', schoolId).eq('admission_number', `${SYNTHETIC_MARKER}-GRACE`).single()
  const { data: henryRow } = await db.from('learners').select('id').eq('school_id', schoolId).eq('admission_number', `${SYNTHETIC_MARKER}-HENRY`).single()

  const retryResult = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [
      { learner_id: graceRow!.id, promotion_type: 'promoted', to_class_id: class9A_id, to_academic_year_id: year2028Id },
      { learner_id: henryRow!.id, promotion_type: 'repeated', to_class_id: class9A_id, to_academic_year_id: year2028Id },
    ],
  })
  assert.equal(retryResult.processed, 2)
  assert.deepEqual(retryResult.errors, [])

  for (const id of [graceRow!.id, henryRow!.id]) {
    const { data: promotionRows } = await db.from('learner_promotions').select('id').eq('learner_id', id)
    assert.equal(promotionRows?.length, 1, 'exactly one promotion row, not a leftover from the failed attempt plus a new one')

    const { data: currentEnrollments } = await db.from('learner_enrollments')
      .select('id, class_id').eq('learner_id', id).eq('academic_year_id', year2028Id).is('ended_at', null)
    assert.equal(currentEnrollments?.length, 1, 'exactly one current placement — the invariant that matters most')
    assert.equal(currentEnrollments![0].class_id, class9A_id)

    const { data: oldEnrollment } = await db.from('learner_enrollments')
      .select('ended_at').eq('learner_id', id).eq('term_id', term1_2026Id).single()
    assert.ok(oldEnrollment?.ended_at, 'the original 2026 placement is now correctly closed by the SUCCESSFUL retry')
  }
})

test('cross-school destination class: deterministic downstream-precondition failure leaves no stranded state', async () => {
  // This is the failure mode that would have escaped a fix scoped only to
  // "check the term" — to_class_id's school-scoping was ALSO only ever
  // discovered inside enrollLearner, after insertPromotion/
  // withdrawActiveEnrollments had already run.
  const irisId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-IRIS`, first_name: 'Iris', last_name: 'Stranded',
    class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!
  const { data: otherClasses } = await db.from('classes').select('id').eq('school_id', otherSchoolId).limit(1)

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: irisId, promotion_type: 'promoted', to_class_id: otherClasses![0].id, to_academic_year_id: year2027Id }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)

  const { data: enrollment } = await db.from('learner_enrollments')
    .select('status, ended_at').eq('learner_id', irisId).eq('term_id', term1_2026Id).single()
  assert.equal(enrollment?.status, 'active')
  assert.equal(enrollment?.ended_at, null, 'never withdrawn for a destination that was never actually reachable')

  const { data: promotionRows } = await db.from('learner_promotions').select('id').eq('learner_id', irisId)
  assert.equal(promotionRows?.length, 0)
})

test('graduation still requires no destination class/term — terminal decisions are unaffected by the precondition fix', async () => {
  const kevinId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-KEVIN`, first_name: 'Kevin', last_name: 'Graduate',
    class_id: class7A_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [{ learner_id: kevinId, promotion_type: 'graduated' }],
  })
  assert.equal(result.processed, 1)
  assert.deepEqual(result.errors, [])

  const { data: learnerRow } = await db.from('learners').select('status, graduation_date').eq('id', kevinId).single()
  assert.equal(learnerRow?.status, 'graduated')
  assert.ok(learnerRow?.graduation_date)

  const { data: currentEnrollments } = await db.from('learner_enrollments')
    .select('id').eq('learner_id', kevinId).is('ended_at', null)
  assert.equal(currentEnrollments?.length, 0, 'no destination enrollment is created or expected for a graduate')
})

test('batch independence: one learner with an impossible destination cannot corrupt the rest of the batch', async () => {
  const lucyId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-LUCY`, first_name: 'Lucy', last_name: 'Batch',
    class_id: class7B_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!
  const monicaId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-MONICA`, first_name: 'Monica', last_name: 'Batch',
    class_id: class7B_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!
  const nickId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-NICK`, first_name: 'Nick', last_name: 'Batch',
    class_id: class7B_id, term_id: term1_2026Id, academic_year_id: year2026Id,
  })).learnerId!

  const badYear = await repos.schools.insertAcademicYear(schoolId, { name: '2029-no-term', start_date: '2029-01-01', end_date: '2029-12-31' })
  const { data: grade8 } = await db.from('grades').select('id').eq('code', 'G8').single()
  const { data: badClass } = await db.from('classes').insert({
    school_id: schoolId, class_name: '9B-no-term', display_name: '9B (no term)', grade_id: grade8!.id, academic_year_id: badYear.id,
  }).select('id').single()

  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: year2026Id,
    decisions: [
      { learner_id: lucyId, promotion_type: 'promoted', to_class_id: class8B_id, to_academic_year_id: year2027Id },
      { learner_id: monicaId, promotion_type: 'promoted', to_class_id: badClass!.id, to_academic_year_id: badYear.id },
      { learner_id: nickId, promotion_type: 'promoted', to_class_id: class8B_id, to_academic_year_id: year2027Id },
    ],
  })
  assert.equal(result.processed, 2, 'Lucy and Nick succeed independently of Monica\'s failure')
  assert.equal(result.errors.length, 1)
  assert.ok(result.errors[0].includes(monicaId), 'the error identifies Monica specifically, not a batch-wide failure')
  assert.match(result.errors[0], /no terms/i)

  // §27 — the invariant that matters: every learner is placed somewhere valid.
  for (const id of [lucyId, nickId]) {
    const { data: current } = await db.from('learner_enrollments').select('id, class_id').eq('learner_id', id).is('ended_at', null)
    assert.equal(current?.length, 1)
    assert.equal(current![0].class_id, class8B_id)
  }
  const { data: monicaCurrent } = await db.from('learner_enrollments').select('id, class_id, status').eq('learner_id', monicaId).is('ended_at', null)
  assert.equal(monicaCurrent?.length, 1, 'Monica remains exactly where she started — not zero, not stranded')
  assert.equal(monicaCurrent![0].class_id, class7B_id)
  const { data: monicaPromotions } = await db.from('learner_promotions').select('id').eq('learner_id', monicaId)
  assert.equal(monicaPromotions?.length, 0, 'retryable — no audit row for the failed decision')
})

test('previewPromotion suggests "graduate" for BOTH Grade 9 and Grade 12 — not just Grade 9', async () => {
  const seniorAdmin = await mkAuthUser('senior-admin')
  const seniorSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-senior-school` }, seniorAdmin.id)
  createdSchoolIds.push(seniorSchool.id)
  await repos.schools.addSchoolUser(seniorSchool.id, seniorAdmin.id, 'school_admin')
  const seniorActivation = await activateSchool(seniorSchool.id, { gradeCodes: ['G12'] })
  if (seniorActivation.status !== 'complete') throw new Error(`senior fixture activation failed: ${seniorActivation.error}`)

  const { data: g12Classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', seniorSchool.id).limit(1)
  const seniorYear = await repos.schools.findCurrentAcademicYear(seniorSchool.id)
  const seniorTerm = await repos.schools.findCurrentTerm(seniorSchool.id)

  const g12Learner = await onboardLearner(seniorSchool.id, {
    admission_number: `${SYNTHETIC_MARKER}-G12`, first_name: 'Senior', last_name: 'Learner',
    class_id: g12Classes![0].id, term_id: seniorTerm!.id, academic_year_id: seniorYear!.id,
  })

  const preview = await previewPromotion(seniorSchool.id, seniorYear!.id, seniorTerm!.id)
  const row = preview.find(p => p.learner_id === g12Learner.learnerId)
  assert.equal(row?.suggested_action, 'graduate', 'Grade 12 is the actual final grade — there is no Grade 13 to promote into')
})
