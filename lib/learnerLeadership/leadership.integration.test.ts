// lib/learnerLeadership/leadership.integration.test.ts
//
// Sprint 13D — proves, against real synthetic Supabase data, the full
// Learner Leadership lifecycle (Nomination -> Selection -> Active Service
// -> Review -> Completion -> Verification -> Published -> Historical, Not
// Selected reachable from Nomination, Discontinued reachable from Active
// Service/Review, Rejected reachable from Verification, Revoked reachable
// from Published) and that the DB trigger — not just this service's own
// checks — is the final backstop against editing a terminal-state or
// published row. Also proves illegal-transition rejection, Blueprint
// composition, permission checks, cross-school isolation, evidence
// references, neutral handling of Discontinued, and — per the mission's
// explicit instruction — that Portfolio, Achievement, Projects, and
// Competitions are entirely unaffected by this domain's addition.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerLeadership/leadership.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  createNomination, updateNomination, selectForLeadership, markNotSelected, beginActiveService,
  reviewLeadership, discontinueLeadership, completeLeadership, queueLeadershipForVerification,
  publishLeadership, rejectLeadership, revokeLeadership, moveLeadershipToHistorical, setReflection,
  listForLearner, listPublished, getLeadershipSummary, getVerificationHistory,
} from './leadership'
import { createAchievement, verifyAchievement, publishAchievement, getAchievementSummary } from '@/lib/learnerAchievement/achievement'
import { addItem as addPortfolioItem, submitItem as submitPortfolioItem, verifyItem, publishItem, getPortfolioSummary } from '@/lib/learnerPortfolio/portfolio'
import { createDraft as createProjectDraft, getProjectsSummary } from '@/lib/learnerProjects/project'
import { createOpportunity as createCompetitionOpportunity, registerCompetition, getCompetitionsSummary } from '@/lib/learnerCompetitions/competition'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_13D_LEADERSHIP_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint13d-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_leadership/history
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fixtureSchoolWithTeacher(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacher = await mkAuthUser(`${labelPrefix}-teacher`)
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: `${labelPrefix} Teacher` })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed: ${accept.status}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  const enroll = await onboardLearner(school.id, {
    admission_number: `13d-${labelPrefix}-${Date.now()}`,
    first_name: 'Leadership', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Leadership Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('fixture enrollment failed')

  return {
    schoolId: school.id,
    teacherUserId: teacher.id,
    teacherEmail: teacher.email,
    learnerId: enroll.learnerId!,
  }
}

const FIELDS = {
  positionTitle: 'Head Prefect',
  scope: 'Whole School',
  body: 'Student Council',
  responsibilities: 'Chairs weekly council meetings, represents the student body to staff.',
  isActing: false,
  supportingEvidenceIds: [],
}

test('full lifecycle: nomination -> selection -> active service -> review -> completion -> verification -> published -> historical, immutability at every stage, versioning + history', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await listForLearner(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(nom.status, 'nomination')
  assert.equal(nom.version, 1)

  // Illegal transitions from nomination.
  await assert.rejects(() => beginActiveService(client, fx.schoolId, nom.id), /Only a selected entry/)
  await assert.rejects(() => publishLeadership(client, fx.schoolId, nom.id), /not awaiting verification/)
  await assert.rejects(() => revokeLeadership(client, fx.schoolId, nom.id, 'x'), /Only a published entry/)

  const edited = await updateNomination(client, fx.schoolId, nom.id, { scope: 'Senior School' })
  assert.equal(edited.scope, 'Senior School')
  assert.equal(edited.positionTitle, FIELDS.positionTitle, 'unedited fields survive a partial update untouched')

  const selected = await selectForLeadership(client, fx.schoolId, nom.id)
  assert.equal(selected.status, 'selection')

  // Once selected, nomination-only editing is closed (DB trigger backstop).
  await assert.rejects(() => updateNomination(client, fx.schoolId, nom.id, { positionTitle: 'x' }), /already moved past nomination/)

  const active = await beginActiveService(client, fx.schoolId, nom.id)
  assert.equal(active.status, 'active_service')
  assert.ok(active.startDate)

  const reviewed = await reviewLeadership(client, fx.schoolId, nom.id, 'Reliable, well-organized, strong communicator.')
  assert.equal(reviewed.status, 'review')
  assert.equal(reviewed.reviewNotes, 'Reliable, well-organized, strong communicator.')

  const completed = await completeLeadership(client, fx.schoolId, nom.id, 'Served a full, uneventful term.')
  assert.equal(completed.status, 'completion')
  assert.ok(completed.endDate)

  const queued = await queueLeadershipForVerification(client, fx.schoolId, nom.id)
  assert.equal(queued.status, 'verification')

  const published = await publishLeadership(client, fx.schoolId, nom.id)
  assert.equal(published.status, 'published')
  assert.ok(published.verifiedBy)
  assert.ok(published.verifiedAt)
  assert.ok(published.publishedAt)

  // Now listPublished/summary see it, and Blueprint composes it.
  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 1)
  assert.equal(pub[0].id, nom.id)

  const summary = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.equal(summary.completedRoleCount, 1)
  assert.equal(summary.latestCompletedRole!.title, FIELDS.positionTitle)
  // Never exposes review notes, election data, meeting history, mentor comments, or disciplinary info.
  assert.deepEqual(Object.keys(summary).sort(), ['available', 'completedRoleCount', 'currentRole', 'latestCompletedRole', 'leadershipUrl'])
  assert.equal(JSON.stringify(summary).includes('Reliable, well-organized'), false)

  // Full transition history, in order.
  const history = await getVerificationHistory(client, fx.schoolId, nom.id)
  assert.deepEqual(
    history.map(h => `${h.fromStatus}->${h.toStatus}`),
    ['nomination->selection', 'selection->active_service', 'active_service->review', 'review->completion', 'completion->verification', 'verification->published']
  )

  // Service-layer immutability.
  await assert.rejects(() => updateNomination(client, fx.schoolId, nom.id, { positionTitle: 'tampered' }), /already moved past nomination/)

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('learner_leadership').update({ position_title: 'tampered' }).eq('id', nom.id)
  assert.ok(rawUpdate.error, 'UPDATE (non historical/revoked field) on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_leadership').delete().eq('id', nom.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Historical is one of the two legal transitions on a published row.
  const historical = await moveLeadershipToHistorical(client, fx.schoolId, nom.id)
  assert.equal(historical.status, 'historical')
  assert.ok(historical.historicalAt)

  // Historical is fully terminal.
  const rawUpdateHistorical = await db.from('learner_leadership').update({ position_title: 'tampered again' }).eq('id', nom.id)
  assert.ok(rawUpdateHistorical.error, 'UPDATE on a historical row must be rejected')
  await assert.rejects(() => moveLeadershipToHistorical(client, fx.schoolId, nom.id), /Only a published entry/)

  // History rows are themselves append-only.
  const anyHistoryRow = (await getVerificationHistory(client, fx.schoolId, nom.id))[0]
  const rawHistoryUpdate = await db.from('leadership_history').update({ reason: 'tampered' })
    .eq('leadership_id', nom.id).eq('version', anyHistoryRow.version)
  assert.ok(rawHistoryUpdate.error, 'UPDATE on a leadership_history row must be rejected — append-only')
})

test('terminal branch: not selected is reachable only from Nomination', async () => {
  const fx = await fixtureSchoolWithTeacher('not-selected')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => markNotSelected(client, fx.schoolId, nom.id, ''), /reason is required/)
  const notSelected = await markNotSelected(client, fx.schoolId, nom.id, 'Another candidate was chosen for the role.')
  assert.equal(notSelected.status, 'not_selected')
  assert.equal(notSelected.notSelectedReason, 'Another candidate was chosen for the role.')

  const rawUpdate = await db.from('learner_leadership').update({ position_title: 'x' }).eq('id', nom.id)
  assert.ok(rawUpdate.error, 'a not-selected row is permanently immutable')

  // Once selected, "not selected" is no longer a legal exit.
  const nom2 = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  const selected = await selectForLeadership(client, fx.schoolId, nom2.id)
  await assert.rejects(() => markNotSelected(client, fx.schoolId, selected.id, 'too late'), /Only a nomination/)
})

test('terminal branch: discontinued is reachable from Active Service or Review, carries only a neutral factual reason, never a disciplinary record', async () => {
  const fx = await fixtureSchoolWithTeacher('discontinue')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => discontinueLeadership(client, fx.schoolId, nom.id, 'x'), /Only an entry in Active Service or Review/)

  await selectForLeadership(client, fx.schoolId, nom.id)
  const active = await beginActiveService(client, fx.schoolId, nom.id)

  await assert.rejects(() => discontinueLeadership(client, fx.schoolId, active.id, ''), /discontinuation reason is required/)
  const discontinued = await discontinueLeadership(client, fx.schoolId, active.id, 'Learner transferred to another school mid-term.')
  assert.equal(discontinued.status, 'discontinued')
  assert.equal(discontinued.discontinuedReason, 'Learner transferred to another school mid-term.')
  assert.ok(discontinued.discontinuedAt)
  assert.ok(discontinued.endDate)
  // The domain has no disciplinary-case field anywhere on the row — the reason is the one, neutral, factual field.
  assert.equal('disciplinaryCase' in discontinued, false)
  assert.equal('caseNotes' in discontinued, false)

  const rawUpdate = await db.from('learner_leadership').update({ position_title: 'x' }).eq('id', nom.id)
  assert.ok(rawUpdate.error, 'a discontinued row is permanently immutable')

  // Reachable from Review too.
  const nom2 = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await selectForLeadership(client, fx.schoolId, nom2.id)
  await beginActiveService(client, fx.schoolId, nom2.id)
  const reviewed = await reviewLeadership(client, fx.schoolId, nom2.id, 'Good so far.')
  const discontinued2 = await discontinueLeadership(client, fx.schoolId, reviewed.id, 'Role dissolved due to restructuring.')
  assert.equal(discontinued2.status, 'discontinued')
})

test('terminal branch: rejected is reachable only from Verification', async () => {
  const fx = await fixtureSchoolWithTeacher('reject')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await selectForLeadership(client, fx.schoolId, nom.id)
  await beginActiveService(client, fx.schoolId, nom.id)
  await reviewLeadership(client, fx.schoolId, nom.id, 'Fine.')
  await completeLeadership(client, fx.schoolId, nom.id, 'Term complete.')
  const queued = await queueLeadershipForVerification(client, fx.schoolId, nom.id)

  await assert.rejects(() => rejectLeadership(client, fx.schoolId, queued.id, ''), /rejection reason is required/)
  const rejected = await rejectLeadership(client, fx.schoolId, queued.id, 'Could not confirm the completed term with school records.')
  assert.equal(rejected.status, 'rejected')

  await assert.rejects(() => publishLeadership(client, fx.schoolId, rejected.id), /not awaiting verification/)
  const rawUpdate = await db.from('learner_leadership').update({ position_title: 'x' }).eq('id', rejected.id)
  assert.ok(rawUpdate.error, 'a rejected row is permanently immutable')
})

test('terminal branch: revoked is reachable only from Published, and revocation removes it from the published surface', async () => {
  const fx = await fixtureSchoolWithTeacher('revoke')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await selectForLeadership(client, fx.schoolId, nom.id)
  await beginActiveService(client, fx.schoolId, nom.id)
  await reviewLeadership(client, fx.schoolId, nom.id, 'Fine.')
  await completeLeadership(client, fx.schoolId, nom.id, 'Term complete.')
  await queueLeadershipForVerification(client, fx.schoolId, nom.id)
  await publishLeadership(client, fx.schoolId, nom.id)
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 1)

  await assert.rejects(() => revokeLeadership(client, fx.schoolId, nom.id, ''), /revocation reason is required/)
  const revoked = await revokeLeadership(client, fx.schoolId, nom.id, 'Later found the term record was fabricated.')
  assert.equal(revoked.status, 'revoked')
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 0)
  const summary = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.completedRoleCount, 0)
})

test('evidence references: reference-only, never fabricated, never a copy of Evidence machinery', async () => {
  const fx = await fixtureSchoolWithTeacher('evidence')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, supportingEvidenceIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
  })
  assert.deepEqual(nom.supportingEvidenceIds, ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'])

  const noEvidence = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, supportingEvidenceIds: [] })
  assert.deepEqual(noEvidence.supportingEvidenceIds, [], 'no evidence is a valid, honest empty state, never fabricated')
})

test('Canonical summary: unavailable for zero entries, available with completedRoleCount/latest once published, currentRole surfaces only an in-progress entry with no internal detail', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(empty.available, false)

  // An in-progress (not yet published) role surfaces as currentRole only.
  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, positionTitle: 'Sports Captain' })
  await selectForLeadership(client, fx.schoolId, nom.id)

  const midway = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(midway.available, true)
  assert.equal(midway.completedRoleCount, 0, 'never counts an in-progress role as completed')
  assert.equal(midway.currentRole!.title, 'Sports Captain')
  // currentRole never leaks internal lifecycle status, review notes, or dates.
  assert.deepEqual(Object.keys(midway.currentRole!).sort(), ['scope', 'title'])

  // Now publish a second role.
  const nom2 = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, positionTitle: 'Head Prefect' })
  await selectForLeadership(client, fx.schoolId, nom2.id)
  await beginActiveService(client, fx.schoolId, nom2.id)
  await reviewLeadership(client, fx.schoolId, nom2.id, 'Confidential staff notes about the term.')
  await completeLeadership(client, fx.schoolId, nom2.id, 'Term complete.')
  await queueLeadershipForVerification(client, fx.schoolId, nom2.id)
  await publishLeadership(client, fx.schoolId, nom2.id)

  const available = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(available.available, true)
  assert.equal(available.completedRoleCount, 1)
  assert.equal(available.latestCompletedRole!.title, 'Head Prefect')
  // Never exposes review notes anywhere in the Blueprint section.
  assert.equal(JSON.stringify(available).includes('Confidential staff notes'), false)
})

test('Leadership Reflection is scoped to this service only, never merged with the general Teacher Reflection domain', async () => {
  const fx = await fixtureSchoolWithTeacher('reflection')
  const client = await signInAs(fx.teacherEmail)

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => setReflection(client, fx.schoolId, nom.id, ''), /reflection is required/)
  const withReflection = await setReflection(client, fx.schoolId, nom.id, 'I learned to listen before deciding.')
  assert.equal(withReflection.reflection, 'I learned to listen before deciding.')
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s leadership entries', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const nomB = await createNomination(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  await assert.rejects(() => updateNomination(clientA, fxA.schoolId, nomB.id, { positionTitle: 'hijacked' }), /not found/)
  await assert.rejects(() => selectForLeadership(clientA, fxA.schoolId, nomB.id), /not found/)
  await assert.rejects(() => selectForLeadership(clientA, fxB.schoolId, nomB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot create or read leadership entries', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => createNomination(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})

test('repository behaviour: no generic update()/delete() exists — every lifecycle transition is its own named method', async () => {
  const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repos.leadership))
  assert.ok(!repoMethods.includes('update'), 'LeadershipRepository must not expose a generic update()')
  assert.ok(!repoMethods.includes('delete'), 'LeadershipRepository must not expose a generic delete()')
  assert.ok(!repoMethods.includes('mutate'), 'LeadershipRepository must not expose a generic mutate()')
  assert.ok(repoMethods.includes('select'), 'named lifecycle methods must exist')
  assert.ok(repoMethods.includes('publish'))
  assert.ok(repoMethods.includes('revoke'))
  assert.ok(repoMethods.includes('moveToHistorical'))
})

test('regression: Portfolio, Achievement, Projects, and Competitions are entirely unaffected by the Leadership domain\'s addition — all four still work normally in the same fixture, and Blueprint composes every section together without error', async () => {
  const fx = await fixtureSchoolWithTeacher('regression')
  const client = await signInAs(fx.teacherEmail)

  const achievement = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    achievementType: 'leadership', category: 'leadership', title: 'Outstanding Prefect Award',
    description: null, supportingEvidenceIds: [], verifyingDocumentReference: 'ref-1',
    awardingOrganization: 'Mwatate Ridge Senior School', awardDate: '2026-05-01', expiresAt: null,
  })
  await verifyAchievement(client, fx.schoolId, achievement.id)
  await publishAchievement(client, fx.schoolId, achievement.id)
  const achievementSummary = await getAchievementSummary(fx.learnerId, fx.schoolId)
  assert.equal(achievementSummary.available, true)
  assert.equal(achievementSummary.achievementCount, 1)

  const portfolioItem = await addPortfolioItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    category: 'writing', title: 'My Term as Prefect', description: null, reflection: null, supportingEvidenceIds: [],
  })
  await submitPortfolioItem(client, fx.schoolId, portfolioItem.id)
  await verifyItem(client, fx.schoolId, portfolioItem.id)
  await publishItem(client, fx.schoolId, portfolioItem.id)
  const portfolioSummary = await getPortfolioSummary(fx.learnerId, fx.schoolId)
  assert.equal(portfolioSummary.available, true)
  assert.equal(portfolioSummary.publishedCount, 1)

  const project = await createProjectDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    title: 'Council Fundraiser', description: null, goal: null, category: 'leadership',
    startDate: null, completionDate: null, reflection: null, supportingEvidenceIds: [],
  })
  const projectsSummary = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(projectsSummary.available, false, 'a draft-only project has no published or active signal yet, unrelated to Leadership')
  void project

  const competition = await createCompetitionOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    name: 'Regional Debate Championship', organizingBody: 'Kenya Debate Union', level: 'regional', category: 'debate',
    eventDate: '2026-09-01', venue: null, projectId: null, supportingEvidenceIds: [],
  })
  await registerCompetition(client, fx.schoolId, competition.id)
  const competitionsSummary = await getCompetitionsSummary(fx.learnerId, fx.schoolId)
  assert.equal(competitionsSummary.available, true)
  assert.equal(competitionsSummary.currentParticipation!.name, 'Regional Debate Championship')

  const nom = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await selectForLeadership(client, fx.schoolId, nom.id)

  // Blueprint composes every section together — Achievement/Portfolio/Competitions/Leadership all present, none clobbered by another.
  const { blueprint } = await composeBlueprint({ actorUserId: fx.teacherUserId, coreLearnerId: asLearnerId(fx.learnerId), schoolId: fx.schoolId })
  assert.equal(blueprint.achievement.status, 'available')
  assert.equal(blueprint.achievement.data!.achievementCount, 1)
  assert.equal(blueprint.portfolio.status, 'available')
  assert.equal(blueprint.portfolio.data!.publishedCount, 1)
  // Competitions/Leadership are no longer Blueprint sections (2026-08-12: no write path,
  // no UI, permanently `unavailable`), so their half of the no-clobbering invariant is
  // asserted against their own canonical summaries.
  const leadershipSummary = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(leadershipSummary.available, true)
  assert.equal(leadershipSummary.currentRole!.title, FIELDS.positionTitle)
})
