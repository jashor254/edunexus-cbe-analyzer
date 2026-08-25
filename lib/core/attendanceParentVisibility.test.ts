// lib/core/attendanceParentVisibility.test.ts
//
// Parent Portal Phase P4.5 (Attendance Visibility Convergence): proves the
// authorization policy inside `getLearnerAttendanceHistory` directly
// against real (synthetic, cleaned-up) data — admin allowed, a real
// registered guardian of the TARGET learner allowed, an unrelated parent
// denied, a parent of a SIBLING learner denied for the sibling's own
// child (not the target), and a bogus learner id denied. This is the one
// function P4's own closeout (`docs/architecture/parent-portal-p4-attention-action-model.md`
// §16/§35) found gated admin-tier-only, silently neutering
// `composeAttendance()` for every real parent viewer.
//
// The fix (lib/core/attendance.ts) widens the existing internal
// authorization check rather than adding a separate wrapper/policy
// function — every other exported function in this file already does its
// own authorization inline (assertOwnershipChain/assertClassAccess), so
// this keeps the same, single, already-established convention. `resolveParent`
// (lib/core/identity.ts) — the SAME resolver `requireParent` in
// lib/core/permissions.ts uses — is reused, never re-implemented.
//
// Run: npx tsx --env-file=.env.local --test lib/core/attendanceParentVisibility.test.ts
// (also wired into `npm run test:deep` via scripts/deep-tests.json)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createAttendanceSession, bulkRecordAttendance, getLearnerAttendanceHistory } from '@/lib/core/attendance'
import { PermissionDeniedError } from '@/lib/core/errors'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_P4_5_ATTENDANCE_AUTHZ_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades attendance_sessions/records/learner_guardians
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

test('getLearnerAttendanceHistory: admin allowed, target guardian allowed, unrelated parent denied, sibling-parent denied for the other child, bogus learner id denied', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const targetEnroll = await onboardLearner(school.id, {
    admission_number: `p45-target-${Date.now()}`,
    first_name: 'Target', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(targetEnroll.status, 'complete')
  const targetLearnerId = targetEnroll.learnerId!

  const siblingEnroll = await onboardLearner(school.id, {
    admission_number: `p45-sibling-${Date.now()}`,
    first_name: 'Sibling', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(siblingEnroll.status, 'complete')
  const siblingLearnerId = siblingEnroll.learnerId!

  // One real attendance record for the target learner, so a successful
  // read actually returns real data, not just an empty array.
  const session = await createAttendanceSession(admin.id, {
    school_id: school.id, academic_year_id: academicYearId, term_id: termId, class_id: classId,
    attendance_date: '2026-03-01',
  })
  await bulkRecordAttendance(admin.id, school.id, session.id, [{ learner_id: targetLearnerId, status: 'present' }])

  const targetParent = await mkAuthUser('target-parent')
  const { error: guardianErr } = await db.from('learner_guardians').insert({
    learner_id: targetLearnerId, school_id: school.id, user_id: targetParent.id,
    relationship: 'mother', full_name: MARKER, phone: '0700000020',
  })
  if (guardianErr) throw guardianErr

  const siblingParent = await mkAuthUser('sibling-parent')
  const { error: siblingGuardianErr } = await db.from('learner_guardians').insert({
    learner_id: siblingLearnerId, school_id: school.id, user_id: siblingParent.id,
    relationship: 'father', full_name: MARKER, phone: '0700000021',
  })
  if (siblingGuardianErr) throw siblingGuardianErr

  const unrelatedParent = await mkAuthUser('unrelated-parent')

  // ── Admin: allowed (unchanged behavior) ──────────────────────────────
  const adminRead = await getLearnerAttendanceHistory(admin.id, school.id, targetLearnerId)
  assert.equal(adminRead.length, 1, 'admin sees the one real attendance record')
  assert.equal(adminRead[0].status, 'present')

  // ── The target learner's own registered guardian: now allowed (the fix) ──
  const parentRead = await getLearnerAttendanceHistory(targetParent.id, school.id, targetLearnerId)
  assert.equal(parentRead.length, 1, 'the target learner\'s own guardian sees the same real record')
  assert.equal(parentRead[0].status, 'present')

  // ── An unrelated parent (guardian of nobody at this school): denied ──
  await assert.rejects(
    () => getLearnerAttendanceHistory(unrelatedParent.id, school.id, targetLearnerId),
    PermissionDeniedError,
    'an unrelated parent must still be denied'
  )

  // ── A parent of a SIBLING learner may not read the TARGET learner's
  // history — guardianship is per-learner, never family-wide or
  // school-wide ──
  await assert.rejects(
    () => getLearnerAttendanceHistory(siblingParent.id, school.id, targetLearnerId),
    PermissionDeniedError,
    'a parent of a different (sibling) learner must be denied for the target learner'
  )

  // ── Sibling parent CAN read their own child's history (proves the fix is
  // additive, not a family-wide grant masquerading as per-learner) ──
  const siblingParentOwnRead = await getLearnerAttendanceHistory(siblingParent.id, school.id, siblingLearnerId)
  assert.equal(siblingParentOwnRead.length, 0, 'the sibling has zero attendance records seeded, but the READ itself is authorized')

  // ── A bogus/nonexistent learner id: denied, never a partial/empty allow ──
  await assert.rejects(
    () => getLearnerAttendanceHistory(targetParent.id, school.id, '00000000-0000-0000-0000-000000000000'),
    PermissionDeniedError,
    'a learner id the caller is not a guardian of (even a nonexistent one) must be denied, not silently return empty'
  )
})
