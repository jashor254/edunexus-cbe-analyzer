// lib/core/attendanceReportCardIntegration.test.ts
//
// Sprint 12B (ADR-0004 — Attendance -> Report Card Integration): proves,
// against real (synthetic, cleaned-up) data, that generateReportCards
// actually populates days_present/days_absent from real Attendance data —
// not just that the wiring compiles. Present+Late -> days_present,
// Absent+Excused -> days_absent (Report Cards' own interpretation of
// Attendance's raw per-status counts, per ADR-0004 §4 — see
// lib/core/report-cards.ts's toReportCardAttendance for the same rule).
//
// Also proves the "no fabricated zero" rule: a learner enrolled in a class
// with zero attendance sessions gets `null`/`null`, never `0`/`0`.
//
// Run: npx tsx --env-file=.env.local --test lib/core/attendanceReportCardIntegration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createAttendanceSession, bulkRecordAttendance } from '@/lib/core/attendance'
import { generateReportCards, getReportCard } from '@/lib/core/report-cards'

const SYNTHETIC_MARKER = 'SYNTHETIC_12B_ATTENDANCE_REPORTCARD_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12b-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades everything Core-side, including attendance_sessions/records
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('generateReportCards computes days_present/days_absent from real Attendance data, never fabricating a zero for a learner with no sessions', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  // Two learners: one gets a real attendance record (mixed statuses across
  // several sessions), the other is enrolled but never marked at all.
  const markedEnroll = await onboardLearner(school.id, {
    admission_number: `12b-marked-${Date.now()}`,
    first_name: 'Marked', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Marked Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(markedEnroll.status, 'complete')
  const markedLearnerId = markedEnroll.learnerId!

  const unmarkedEnroll = await onboardLearner(school.id, {
    admission_number: `12b-unmarked-${Date.now()}`,
    first_name: 'Unmarked', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Unmarked Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  assert.equal(unmarkedEnroll.status, 'complete')
  const unmarkedLearnerId = unmarkedEnroll.learnerId!

  // Four sessions, one status each: present, late, absent, excused.
  // Expected: days_present = 2 (present + late), days_absent = 2 (absent + excused).
  const statuses: Array<'present' | 'late' | 'absent' | 'excused'> = ['present', 'late', 'absent', 'excused']
  for (let i = 0; i < statuses.length; i++) {
    const session = await createAttendanceSession(admin.id, {
      school_id: school.id, academic_year_id: academicYearId, term_id: termId, class_id: classId,
      attendance_date: `2026-02-0${i + 1}`,
    })
    await bulkRecordAttendance(admin.id, school.id, session.id, [
      { learner_id: markedLearnerId, status: statuses[i] },
    ])
  }

  const { generated } = await generateReportCards(admin.id, school.id, classId, termId, {})
  assert.equal(generated, 2)

  const markedCard = await getReportCard(markedLearnerId, termId, school.id)
  assert.ok(markedCard)
  assert.equal(markedCard!.days_present, 2, 'present + late')
  assert.equal(markedCard!.days_absent, 2, 'absent + excused')

  const unmarkedCard = await getReportCard(unmarkedLearnerId, termId, school.id)
  assert.ok(unmarkedCard)
  assert.equal(unmarkedCard!.days_present, null, 'no attendance data at all -> null, never a fabricated 0')
  assert.equal(unmarkedCard!.days_absent, null, 'no attendance data at all -> null, never a fabricated 0')

  // ── Ownership proof: this test never wrote attendance_sessions/records
  // through anything but lib/core/attendance.ts's own exported functions,
  // and Report Cards never wrote to those tables at all — confirmed by
  // inspection of this test's own calls, not asserted at runtime.
})
