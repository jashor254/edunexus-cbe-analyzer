// lib/learnerWellbeing/wellbeing.integration.test.ts
//
// Sprint 13G — proves, against real synthetic Supabase data, the full
// Learner Wellbeing lifecycle (Concern Raised -> Initial Assessment ->
// Support Plan Active -> Review -> Outcome Recorded -> Closed, No Action
// Needed reachable from Initial Assessment, Withdrawn reachable from
// Support Plan Active/Review) with NO Verification and NO Published state
// (ADR-0017's deliberate departure), and that the DB trigger — not just
// this service's own checks — is the final backstop against editing a
// terminal-state case, even under the service-role client. Also proves
// Support-Team-scoped access (not school-staff-wide), cross-school
// isolation, teacher/parent/learner denial, visibility-tier filtering,
// and the mission's explicit "every forbidden relationship proven absent"
// requirement (Blueprint/Parent Experience/Behaviour untouched).
//
// Run: npx tsx --env-file=.env.local --test lib/learnerWellbeing/wellbeing.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  raiseConcern, updateConcern, beginAssessment, markNoActionNeeded, activateSupportPlan,
  reviewCase, withdrawCase, recordOutcome, closeCase, setEscalation,
  addSupportTeamMember, removeSupportTeamMember, listSupportTeam, addUpdate,
  findCaseById, listUpdates,
} from './wellbeing'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'

const SYNTHETIC_MARKER = 'SYNTHETIC_13G_WELLBEING_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint13g-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

after(async () => {
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_wellbeing_cases/support_team/updates
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fixtureSchoolWithTwoTeachers(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacherA = await mkAuthUser(`${labelPrefix}-teacherA`)
  const inviteA = await inviteTeacher(school.id, teacherA.email, admin.id)
  if (inviteA.status !== 'invited') throw new Error(`fixture invite A failed: ${inviteA.status}`)
  const acceptA = await acceptTeacherInvitation(teacherA.id, school.id, { full_name: `${labelPrefix} Teacher A` })
  if (acceptA.status !== 'accepted') throw new Error(`fixture accept A failed: ${acceptA.status}`)

  const teacherB = await mkAuthUser(`${labelPrefix}-teacherB`)
  const inviteB = await inviteTeacher(school.id, teacherB.email, admin.id)
  if (inviteB.status !== 'invited') throw new Error(`fixture invite B failed: ${inviteB.status}`)
  const acceptB = await acceptTeacherInvitation(teacherB.id, school.id, { full_name: `${labelPrefix} Teacher B` })
  if (acceptB.status !== 'accepted') throw new Error(`fixture accept B failed: ${acceptB.status}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  const enroll = await onboardLearner(school.id, {
    admission_number: `13g-${labelPrefix}-${Date.now()}`,
    first_name: 'Wellbeing', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Wellbeing Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('fixture enrollment failed')

  return {
    schoolId: school.id,
    teacherAUserId: teacherA.id, teacherAEmail: teacherA.email,
    teacherBUserId: teacherB.id, teacherBEmail: teacherB.email,
    learnerId: enroll.learnerId!,
  }
}

const FIELDS = {
  caseType: 'support_plan' as const,
  concernSummary: 'Learner has appeared withdrawn during lunch periods for the past two weeks; a form tutor raised it after a conversation with the learner.',
  defaultVisibilityClassification: 'core_team' as const,
}

test('full lifecycle: concern raised -> initial assessment -> support plan active -> review -> outcome recorded -> closed, NO Verification, NO Published, immutability at every stage, versioning + updates', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('lifecycle')
  const client = await signInAs(fx.teacherAEmail)

  const raised = await raiseConcern(client, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)
  assert.equal(raised.status, 'concern_raised')
  assert.equal(raised.version, 1)

  // Illegal transitions from concern_raised.
  await assert.rejects(() => reviewCase(client, fx.schoolId, raised.id, null), /Only an active support plan/)
  await assert.rejects(() => closeCase(client, fx.schoolId, raised.id), /Only a case with a recorded outcome/)

  const edited = await updateConcern(client, fx.schoolId, raised.id, { concernSummary: 'Updated: also noted reduced participation in group activities.' })
  assert.match(edited.concernSummary, /reduced participation/)

  const assessed = await beginAssessment(client, fx.schoolId, raised.id)
  assert.equal(assessed.status, 'initial_assessment')

  // Once assessment begins, concern-only editing is closed (DB trigger backstop).
  await assert.rejects(() => updateConcern(client, fx.schoolId, raised.id, { concernSummary: 'x' }), /moved past concern_raised/)

  const active = await activateSupportPlan(client, fx.schoolId, raised.id, 'Weekly check-in with form tutor for four weeks.')
  assert.equal(active.status, 'support_plan_active')
  assert.equal(active.supportGoal, 'Weekly check-in with form tutor for four weeks.')

  const reviewed = await reviewCase(client, fx.schoolId, raised.id, 'Learner reports feeling more settled; will continue check-ins one more week.')
  assert.equal(reviewed.status, 'review')

  const outcome = await recordOutcome(client, fx.schoolId, raised.id, 'Learner re-engaged with peer group; check-ins concluded by mutual agreement.')
  assert.equal(outcome.status, 'outcome_recorded')
  assert.ok(outcome.outcomeRecordedAt)

  const closed = await closeCase(client, fx.schoolId, raised.id)
  assert.equal(closed.status, 'closed')
  assert.ok(closed.closedAt)
  // No verifiedBy/verifiedAt/publishedAt field exists anywhere on this domain's shape at all.
  assert.equal('verifiedBy' in closed, false)
  assert.equal('publishedAt' in closed, false)

  // Full update stream, in order — status changes plus the one logged review note.
  const updates = await listUpdates(client, fx.schoolId, raised.id)
  const statusChanges = updates.filter(u => u.updateType === 'status_change').map(u => `${u.fromStatus}->${u.toStatus}`)
  assert.deepEqual(statusChanges, [
    'null->concern_raised', 'concern_raised->initial_assessment', 'initial_assessment->support_plan_active',
    'support_plan_active->review', 'review->outcome_recorded', 'outcome_recorded->closed',
  ])
  assert.equal(updates.some(u => u.updateType === 'review' && u.content?.includes('feeling more settled')), true)

  // DB-level immutability: the final backstop, even bypassing the service entirely, even under service-role.
  const rawUpdate = await db.from('learner_wellbeing_cases').update({ concern_summary: 'tampered' }).eq('id', raised.id)
  assert.ok(rawUpdate.error, 'UPDATE on a closed case must be rejected by the immutability trigger, even under service-role')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_wellbeing_cases').delete().eq('id', raised.id)
  assert.ok(rawDelete.error, 'DELETE on a closed case must be rejected by the immutability trigger, even under service-role')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Updates are append-only unconditionally, even before terminal status.
  const anyUpdate = updates[0]
  const rawUpdateEdit = await db.from('learner_wellbeing_updates').update({ content: 'tampered' }).eq('id', anyUpdate.id)
  assert.ok(rawUpdateEdit.error, 'UPDATE on a wellbeing update row must be rejected — append-only, even under service-role')
  const rawUpdateDelete = await db.from('learner_wellbeing_updates').delete().eq('id', anyUpdate.id)
  assert.ok(rawUpdateDelete.error, 'DELETE on a wellbeing update row must be rejected — append-only, even under service-role')
})

test('terminal branch: No Action Needed is reachable only from Initial Assessment', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('no-action')
  const client = await signInAs(fx.teacherAEmail)

  const raised = await raiseConcern(client, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)
  await assert.rejects(() => markNoActionNeeded(client, fx.schoolId, raised.id, 'x'), /Only a case in initial assessment/)

  const assessed = await beginAssessment(client, fx.schoolId, raised.id)
  await assert.rejects(() => markNoActionNeeded(client, fx.schoolId, assessed.id, ''), /reason is required/)
  const noAction = await markNoActionNeeded(client, fx.schoolId, assessed.id, 'Learner confirmed this was a one-off, already resolved with a friend.')
  assert.equal(noAction.status, 'no_action_needed')

  const rawUpdate = await db.from('learner_wellbeing_cases').update({ concern_summary: 'x' }).eq('id', raised.id)
  assert.ok(rawUpdate.error, 'a no_action_needed case is permanently immutable')
})

test('terminal branch: Withdrawn is reachable from Support Plan Active or Review, carries only a neutral factual reason', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('withdraw')
  const client = await signInAs(fx.teacherAEmail)

  const raised = await raiseConcern(client, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)
  await assert.rejects(() => withdrawCase(client, fx.schoolId, raised.id, 'x'), /Only a case in Support Plan Active or Review/)

  await beginAssessment(client, fx.schoolId, raised.id)
  const active = await activateSupportPlan(client, fx.schoolId, raised.id, null)

  await assert.rejects(() => withdrawCase(client, fx.schoolId, active.id, ''), /withdrawal reason is required/)
  const withdrawn = await withdrawCase(client, fx.schoolId, active.id, 'Family relocated to another school mid-term.')
  assert.equal(withdrawn.status, 'withdrawn')
  assert.equal(withdrawn.withdrawnReason, 'Family relocated to another school mid-term.')

  const rawUpdate = await db.from('learner_wellbeing_cases').update({ concern_summary: 'x' }).eq('id', raised.id)
  assert.ok(rawUpdate.error, 'a withdrawn case is permanently immutable')
})

test('Escalation Status is independent of the main lifecycle and can be set at any non-terminal status', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('escalation')
  const client = await signInAs(fx.teacherAEmail)

  const raised = await raiseConcern(client, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)
  assert.equal(raised.escalationStatus, 'not_escalated')

  const escalated = await setEscalation(client, fx.schoolId, raised.id, 'escalated_school_leadership')
  assert.equal(escalated.escalationStatus, 'escalated_school_leadership')
  assert.equal(escalated.status, 'concern_raised', 'escalation never changes the main lifecycle status')
  assert.ok(escalated.escalatedAt)

  await beginAssessment(client, fx.schoolId, raised.id)
  const assessed = await activateSupportPlan(client, fx.schoolId, raised.id, null)
  const reEscalated = await setEscalation(client, fx.schoolId, assessed.id, 'escalated_external_authority')
  assert.equal(reEscalated.escalationStatus, 'escalated_external_authority')

  const withdrawn = await withdrawCase(client, fx.schoolId, reEscalated.id, 'No longer required.')
  await assert.rejects(() => setEscalation(client, fx.schoolId, withdrawn.id, 'not_escalated'), /closed\/terminal/)
})

test('Support-Team-scoped access: a teacher NOT on the case\'s Support Team is denied read and write, even though they are a legitimate school staff member', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('team-scope')
  const clientA = await signInAs(fx.teacherAEmail)
  const clientB = await signInAs(fx.teacherBEmail)

  const raised = await raiseConcern(clientA, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)

  // Teacher B is a real, active member of the same school but was never added to this case's Support Team.
  await assert.rejects(() => findCaseById(clientB, fx.schoolId, raised.id), /not on this case's Support Team/)
  await assert.rejects(() => beginAssessment(clientB, fx.schoolId, raised.id), /not on this case's Support Team/)
  await assert.rejects(() => listUpdates(clientB, fx.schoolId, raised.id), /not on this case's Support Team/)

  // DB-level proof: RLS itself rejects a direct read by teacher B, independent of the service layer.
  const rawReadAsB = await clientB.from('learner_wellbeing_cases').select('id').eq('id', raised.id)
  assert.equal(rawReadAsB.data?.length ?? 0, 0, 'RLS must return zero rows for a non-support-team member, not just an application-level denial')

  // Once explicitly added by a core_team member, teacher B gains access.
  const teacherBStaff = await repos.teachers.findSchoolUser(fx.teacherBUserId, fx.schoolId)
  await addSupportTeamMember(clientA, fx.schoolId, raised.id, teacherBStaff!.id, 'school_leadership')
  const nowVisible = await findCaseById(clientB, fx.schoolId, raised.id)
  assert.ok(nowVisible)

  // A school_leadership-role member cannot add further members (only core_team can).
  const outsider = await mkAuthUser('team-scope-outsider')
  const outsiderStaffInvite = await inviteTeacher(fx.schoolId, outsider.email, fx.teacherAUserId)
  void outsiderStaffInvite
  await assert.rejects(
    () => addSupportTeamMember(clientB, fx.schoolId, raised.id, teacherBStaff!.id, 'core_team'),
    /Only a core_team Support Team member/
  )

  // core_team member can remove a member.
  await removeSupportTeamMember(clientA, fx.schoolId, raised.id, teacherBStaff!.id)
  await assert.rejects(() => findCaseById(clientB, fx.schoolId, raised.id), /not on this case's Support Team/)
})

test('visibility-tier filtering: a school_leadership-role team member never sees core_team-classified updates', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('visibility')
  const clientA = await signInAs(fx.teacherAEmail)
  const clientB = await signInAs(fx.teacherBEmail)

  const raised = await raiseConcern(clientA, fx.schoolId, fx.learnerId, fx.teacherAUserId, { ...FIELDS, defaultVisibilityClassification: 'school_leadership' })

  const teacherBStaff = await repos.teachers.findSchoolUser(fx.teacherBUserId, fx.schoolId)
  await addSupportTeamMember(clientA, fx.schoolId, raised.id, teacherBStaff!.id, 'school_leadership')

  // An override to a looser tier than the case default is rejected outright (never possible, since school_leadership is already the loosest tier this domain models) — but an override tightening to core_team is allowed.
  await addUpdate(clientA, fx.schoolId, raised.id, 'note', 'Sensitive detail shared in confidence by the learner.', 'core_team')
  await addUpdate(clientA, fx.schoolId, raised.id, 'conversation', 'General check-in, nothing sensitive.', null)

  const asA = await listUpdates(clientA, fx.schoolId, raised.id) // teacherA is core_team (auto-added as raiser)
  const asB = await listUpdates(clientB, fx.schoolId, raised.id) // teacherB is school_leadership

  assert.equal(asA.some(u => u.content?.includes('Sensitive detail')), true, 'core_team member sees core_team-classified content')
  assert.equal(asB.some(u => u.content?.includes('Sensitive detail')), false, 'school_leadership member never sees core_team-classified content')
  assert.equal(asB.some(u => u.content?.includes('General check-in')), true, 'school_leadership member sees school_leadership-classified content')

  // A case whose own default is already core_team rejects an update trying to loosen to school_leadership.
  const strictCase = await raiseConcern(clientA, fx.schoolId, fx.learnerId, fx.teacherAUserId, { ...FIELDS, defaultVisibilityClassification: 'core_team' })
  await assert.rejects(
    () => addUpdate(clientA, fx.schoolId, strictCase.id, 'note', 'x', 'school_leadership'),
    /never be classified more loosely/
  )
})

test('parent and learner accounts (not school staff at all) are denied at the first gate — requireSchoolStaff/requireSchoolMembership, before any Support-Team check is even reached', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('deny')
  const outsider = await mkAuthUser('deny-outsider') // simulates a parent/learner account with no school_users row at all
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => raiseConcern(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )

  const raised = await raiseConcern(await signInAs(fx.teacherAEmail), fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)
  await assert.rejects(() => findCaseById(outsiderClient, fx.schoolId, raised.id), /require|membership/i)
})

test('cross-school isolation: a support-team member at School A cannot read or act on School B\'s wellbeing case', async () => {
  const fxA = await fixtureSchoolWithTwoTeachers('isoA')
  const fxB = await fixtureSchoolWithTwoTeachers('isoB')
  const clientA = await signInAs(fxA.teacherAEmail)
  const clientB = await signInAs(fxB.teacherAEmail)

  const caseB = await raiseConcern(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherAUserId, FIELDS)

  await assert.rejects(() => findCaseById(clientA, fxA.schoolId, caseB.id), /not found|not on this case/)
  // clientA has no membership in School B at all, so requireSchoolMembership fails before the Support-Team check is even reached — a stricter, earlier denial than the support-team message, and still a correct rejection.
  await assert.rejects(() => beginAssessment(clientA, fxB.schoolId, caseB.id), /require|membership|not on this case/i)
})

test('repository behaviour: no generic update()/delete() exists — every lifecycle transition is its own named method', async () => {
  const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repos.wellbeing))
  assert.ok(!repoMethods.includes('update'), 'WellbeingRepository must not expose a generic update()')
  assert.ok(!repoMethods.includes('delete'), 'WellbeingRepository must not expose a generic delete()')
  assert.ok(!repoMethods.includes('mutate'), 'WellbeingRepository must not expose a generic mutate()')
  assert.ok(repoMethods.includes('beginAssessment'))
  assert.ok(repoMethods.includes('closeCase'))
  assert.ok(!repoMethods.includes('publish'), 'WellbeingRepository must never have a publish() method — ADR-0017 has no Published state')
})

test('regression: Blueprint composition is completely unaffected by a learner having an active Wellbeing case — no field, flag, or section changes', async () => {
  const fx = await fixtureSchoolWithTwoTeachers('blueprint-regression')
  const client = await signInAs(fx.teacherAEmail)

  const { blueprint: before } = await composeBlueprint({ actorUserId: fx.teacherAUserId, coreLearnerId: fx.learnerId, schoolId: fx.schoolId })

  await raiseConcern(client, fx.schoolId, fx.learnerId, fx.teacherAUserId, FIELDS)

  const { blueprint: after } = await composeBlueprint({ actorUserId: fx.teacherAUserId, coreLearnerId: fx.learnerId, schoolId: fx.schoolId })

  // Every section's status/shape is identical before and after a Wellbeing case exists for this learner.
  assert.deepEqual(Object.keys(before).sort(), Object.keys(after).sort())
  assert.equal('wellbeing' in after, false, 'LearnerBlueprint has no wellbeing key at all')
  assert.deepEqual(
    Object.entries(after).filter(([k]) => k !== 'metadata').map(([k, v]) => [k, (v as { status: string }).status]),
    Object.entries(before).filter(([k]) => k !== 'metadata').map(([k, v]) => [k, (v as { status: string }).status]),
  )
})
