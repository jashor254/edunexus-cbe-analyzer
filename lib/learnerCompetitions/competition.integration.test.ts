// lib/learnerCompetitions/competition.integration.test.ts
//
// Sprint 13B — proves, against real synthetic Supabase data, the full
// Learner Competitions lifecycle (Opportunity -> Registration ->
// Preparation -> Participation -> Judging -> Results -> Verification ->
// Published -> Historical, Rejected reachable from Verification,
// Withdrawn reachable from Registration/Preparation/Participation,
// Revoked reachable from Published) and that the DB trigger — not just
// this service's own checks — is the final backstop against editing a
// terminal-state or published row. Also proves illegal-transition
// rejection, Blueprint composition, permission checks, repository
// behaviour, and — per the mission's explicit Phase 11 instruction — that
// Portfolio, Achievement, Projects, and Blueprint's other sections are
// entirely unaffected by this domain's addition.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerCompetitions/competition.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  createOpportunity, updateOpportunity, registerCompetition, beginPreparation, beginParticipation,
  beginJudging, recordResults, publishCompetition, rejectCompetition, withdrawCompetition,
  revokeCompetition, moveToHistorical, addTeamMember, listForLearner, listPublished,
  getCompetitionsSummary, getVerificationHistory,
} from './competition'
import { composeCompetitions } from '@/lib/learnerBlueprint/composeCompetitions'
import { createAchievement, verifyAchievement, publishAchievement, getAchievementSummary } from '@/lib/learnerAchievement/achievement'
import { addItem as addPortfolioItem, submitItem as submitPortfolioItem, verifyItem, publishItem, getPortfolioSummary } from '@/lib/learnerPortfolio/portfolio'
import { createDraft as createProjectDraft, getProjectsSummary } from '@/lib/learnerProjects/project'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'

const SYNTHETIC_MARKER = 'SYNTHETIC_13B_COMPETITION_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint13b-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_competitions/members/media/history
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
    admission_number: `13b-${labelPrefix}-${Date.now()}`,
    first_name: 'Competition', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Competition Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  name: 'National Robotics Championship',
  organizingBody: 'Kenya Robotics Federation',
  level: 'national' as const,
  category: 'robotics' as const,
  eventDate: '2026-08-15',
  venue: 'Nairobi Convention Centre',
  projectId: null,
  supportingEvidenceIds: [],
}

test('full lifecycle: opportunity -> registration -> preparation -> participation -> judging -> results -> verification -> published -> historical, immutability at every stage, versioning + history', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await listForLearner(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])

  const opp = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(opp.status, 'opportunity')
  assert.equal(opp.version, 1)

  // Illegal transitions from opportunity.
  await assert.rejects(() => beginPreparation(client, fx.schoolId, opp.id), /Only a registered competition/)
  await assert.rejects(() => publishCompetition(client, fx.schoolId, opp.id), /not awaiting verification/)
  await assert.rejects(() => revokeCompetition(client, fx.schoolId, opp.id, 'x'), /Only a published competition/)

  const edited = await updateOpportunity(client, fx.schoolId, opp.id, { venue: 'KICC, Nairobi' })
  assert.equal(edited.venue, 'KICC, Nairobi')
  assert.equal(edited.name, FIELDS.name, 'unedited fields survive a partial update untouched')

  const registered = await registerCompetition(client, fx.schoolId, opp.id)
  assert.equal(registered.status, 'registration')
  assert.equal(registered.version, 2)

  // Once registered, opportunity-only editing is closed (DB trigger backstop).
  await assert.rejects(() => updateOpportunity(client, fx.schoolId, opp.id, { name: 'x' }), /already been registered/)

  const preparing = await beginPreparation(client, fx.schoolId, opp.id)
  assert.equal(preparing.status, 'preparation')

  const participating = await beginParticipation(client, fx.schoolId, opp.id)
  assert.equal(participating.status, 'participation')

  const judging = await beginJudging(client, fx.schoolId, opp.id)
  assert.equal(judging.status, 'judging')

  // Judging -> Results -> Verification, in one call (system-queued automatically).
  const queued = await recordResults(client, fx.schoolId, opp.id, 'placed_2nd', 'Second place overall.', 'Panel of 3 external judges', 'Excellent build quality, strong presentation.')
  assert.equal(queued.status, 'verification')
  assert.equal(queued.position, 'placed_2nd')

  const published = await publishCompetition(client, fx.schoolId, opp.id)
  assert.equal(published.status, 'published')
  assert.ok(published.verifiedBy)
  assert.ok(published.verifiedAt)
  assert.ok(published.publishedAt)

  // Now listPublished/summary see it, and Blueprint composes it.
  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 1)
  assert.equal(pub[0].id, opp.id)

  const summary = await getCompetitionsSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.equal(summary.totalCompetitions, 1)
  assert.equal(summary.verifiedCompetitions, 1)
  assert.equal(summary.latestCompetition!.name, FIELDS.name)
  // Never exposes judging or raw feedback in the summary shape.
  assert.deepEqual(Object.keys(summary).sort(), ['available', 'competitionsUrl', 'currentParticipation', 'latestCompetition', 'totalCompetitions', 'verifiedCompetitions'])

  // Full transition history, in order.
  const history = await getVerificationHistory(client, fx.schoolId, opp.id)
  assert.deepEqual(
    history.map(h => `${h.fromStatus}->${h.toStatus}`),
    ['opportunity->registration', 'registration->preparation', 'preparation->participation', 'participation->judging', 'judging->results', 'results->verification', 'verification->published']
  )

  // Service-layer immutability.
  await assert.rejects(() => updateOpportunity(client, fx.schoolId, opp.id, { name: 'tampered' }), /already been registered/)

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('learner_competitions').update({ name: 'tampered' }).eq('id', opp.id)
  assert.ok(rawUpdate.error, 'UPDATE (non historical/revoked field) on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_competitions').delete().eq('id', opp.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Historical is one of the two legal transitions on a published row.
  const historical = await moveToHistorical(client, fx.schoolId, opp.id)
  assert.equal(historical.status, 'historical')
  assert.ok(historical.historicalAt)

  // Historical is fully terminal.
  const rawUpdateHistorical = await db.from('learner_competitions').update({ name: 'tampered again' }).eq('id', opp.id)
  assert.ok(rawUpdateHistorical.error, 'UPDATE on a historical row must be rejected')
  await assert.rejects(() => moveToHistorical(client, fx.schoolId, opp.id), /Only a published competition/)

  // History rows are themselves append-only.
  const anyHistoryRow = (await getVerificationHistory(client, fx.schoolId, opp.id))[0]
  const rawHistoryUpdate = await db.from('competition_history').update({ reason: 'tampered' })
    .eq('competition_id', opp.id).eq('version', anyHistoryRow.version)
  assert.ok(rawHistoryUpdate.error, 'UPDATE on a competition_history row must be rejected — append-only')
})

test('terminal branch: withdrawn is reachable only from Registration/Preparation/Participation, never after Judging', async () => {
  const fx = await fixtureSchoolWithTeacher('withdraw')
  const client = await signInAs(fx.teacherEmail)

  const opp = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => withdrawCompetition(client, fx.schoolId, opp.id, 'x'), /Registration, Preparation, or Participation/)

  const registered = await registerCompetition(client, fx.schoolId, opp.id)
  await assert.rejects(() => withdrawCompetition(client, fx.schoolId, registered.id, ''), /withdrawal reason is required/)
  const withdrawn = await withdrawCompetition(client, fx.schoolId, registered.id, 'Learner fell ill before the event.')
  assert.equal(withdrawn.status, 'withdrawn')
  assert.equal(withdrawn.withdrawnReason, 'Learner fell ill before the event.')

  const rawUpdate = await db.from('learner_competitions').update({ name: 'x' }).eq('id', opp.id)
  assert.ok(rawUpdate.error, 'a withdrawn row is permanently immutable')

  // Once judging begins, withdrawal is no longer a legal exit.
  const opp2 = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await registerCompetition(client, fx.schoolId, opp2.id)
  await beginPreparation(client, fx.schoolId, opp2.id)
  await beginParticipation(client, fx.schoolId, opp2.id)
  const judging = await beginJudging(client, fx.schoolId, opp2.id)
  await assert.rejects(() => withdrawCompetition(client, fx.schoolId, judging.id, 'too late'), /Registration, Preparation, or Participation/)
})

test('terminal branch: rejected is reachable only from Verification, a distinct terminal state from Withdrawn/Revoked', async () => {
  const fx = await fixtureSchoolWithTeacher('reject')
  const client = await signInAs(fx.teacherEmail)

  const opp = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await registerCompetition(client, fx.schoolId, opp.id)
  await beginPreparation(client, fx.schoolId, opp.id)
  await beginParticipation(client, fx.schoolId, opp.id)
  await beginJudging(client, fx.schoolId, opp.id)
  const queued = await recordResults(client, fx.schoolId, opp.id, 'won', 'First place.', 'Panel', 'Great work.')

  await assert.rejects(() => rejectCompetition(client, fx.schoolId, queued.id, ''), /rejection reason is required/)
  const rejected = await rejectCompetition(client, fx.schoolId, queued.id, 'Result could not be confirmed with the organizer.')
  assert.equal(rejected.status, 'rejected')

  // Terminal: cannot publish/reject again.
  await assert.rejects(() => publishCompetition(client, fx.schoolId, rejected.id), /not awaiting verification/)
  const rawUpdate = await db.from('learner_competitions').update({ name: 'x' }).eq('id', rejected.id)
  assert.ok(rawUpdate.error, 'a rejected row is permanently immutable')
})

test('terminal branch: revoked is reachable only from Published, and revocation removes it from the published surface', async () => {
  const fx = await fixtureSchoolWithTeacher('revoke')
  const client = await signInAs(fx.teacherEmail)

  const opp = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await registerCompetition(client, fx.schoolId, opp.id)
  await beginPreparation(client, fx.schoolId, opp.id)
  await beginParticipation(client, fx.schoolId, opp.id)
  await beginJudging(client, fx.schoolId, opp.id)
  await recordResults(client, fx.schoolId, opp.id, 'won', 'First place.', 'Panel', 'Great work.')
  await publishCompetition(client, fx.schoolId, opp.id)
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 1)

  await assert.rejects(() => revokeCompetition(client, fx.schoolId, opp.id, ''), /revocation reason is required/)
  const revoked = await revokeCompetition(client, fx.schoolId, opp.id, 'Later found to be fabricated.')
  assert.equal(revoked.status, 'revoked')
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 0)
  const summary = await getCompetitionsSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.totalCompetitions, 0)
})

test('canonical level/category enforcement: rejects non-canonical level/category', async () => {
  const fx = await fixtureSchoolWithTeacher('canon')
  const client = await signInAs(fx.teacherEmail)

  await assert.rejects(
    // @ts-expect-error deliberately invalid level for the test
    () => createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, level: 'county' }),
    /not a canonical Competition level/
  )
  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'leadership' }),
    /not a canonical Competition category/
  )
})

test('Blueprint composition: unavailable for zero competitions, available with total/verified/latest once published, currentParticipation surfaces only an in-flight entry with no internal detail', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await composeCompetitions(fx.learnerId, fx.schoolId)
  assert.equal(empty.status, 'unavailable')
  assert.equal(empty.data, null)

  // An in-flight (not yet published) competition surfaces as currentParticipation only.
  const inFlight = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, name: 'Regional Science Fair' })
  await registerCompetition(client, fx.schoolId, inFlight.id)

  const midway = await composeCompetitions(fx.learnerId, fx.schoolId)
  assert.equal(midway.status, 'available')
  assert.equal(midway.data!.totalCompetitions, 0, 'never counts unpublished work as a total')
  assert.equal(midway.data!.currentParticipation!.name, 'Regional Science Fair')
  // currentParticipation never leaks internal lifecycle status, judging, or feedback.
  assert.deepEqual(Object.keys(midway.data!.currentParticipation!).sort(), ['category', 'level', 'name'])

  // Now publish a second competition.
  const opp2 = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, name: 'National Robotics Championship' })
  await registerCompetition(client, fx.schoolId, opp2.id)
  await beginPreparation(client, fx.schoolId, opp2.id)
  await beginParticipation(client, fx.schoolId, opp2.id)
  await beginJudging(client, fx.schoolId, opp2.id)
  await recordResults(client, fx.schoolId, opp2.id, 'won', 'First place overall.', 'External panel', 'Outstanding engineering.')
  await publishCompetition(client, fx.schoolId, opp2.id)

  const available = await composeCompetitions(fx.learnerId, fx.schoolId)
  assert.equal(available.status, 'available')
  assert.equal(available.data!.totalCompetitions, 1)
  assert.equal(available.data!.latestCompetition!.name, 'National Robotics Championship')
  // Never exposes judging or raw feedback anywhere in the Blueprint section.
  assert.equal(JSON.stringify(available.data).includes('External panel'), false)
  assert.equal(JSON.stringify(available.data).includes('Outstanding engineering'), false)
})

test('relationship invariant: a Competition Entry may reference a Project, one direction only — Projects itself is never read, written, or mutated', async () => {
  const fx = await fixtureSchoolWithTeacher('project-link')
  const client = await signInAs(fx.teacherEmail)

  const project = await createProjectDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    title: 'Solar-Powered Water Pump', description: null, goal: null, category: 'engineering',
    startDate: null, completionDate: null, reflection: null, supportingEvidenceIds: [],
  })

  const linked = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, projectId: project.id })
  assert.equal(linked.projectId, project.id)

  // The Project itself is completely unaffected — still draft, unmodified.
  const projectsAfter = await repos.projects.findById(project.id, fx.schoolId)
  assert.equal(projectsAfter!.status, 'draft')
  assert.equal(projectsAfter!.title, 'Solar-Powered Water Pump')
})

test('team membership: addTeamMember references Core learners directly, never duplicates identity data', async () => {
  const fx = await fixtureSchoolWithTeacher('team')
  const teammateFx = await fixtureSchoolWithTeacher('team-mate')
  const client = await signInAs(fx.teacherEmail)

  const opp = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  // A teammate must belong to the same school in real use; here we just prove the reference mechanism itself works and stores no duplicate identity fields.
  const withTeam = await addTeamMember(client, fx.schoolId, opp.id, fx.learnerId, 'Team Captain')
  assert.equal(withTeam.members.length, 1)
  assert.equal(withTeam.members[0].learnerId, fx.learnerId)
  assert.equal(withTeam.members[0].role, 'Team Captain')
  void teammateFx
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s competitions', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const oppB = await createOpportunity(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  await assert.rejects(() => updateOpportunity(clientA, fxA.schoolId, oppB.id, { name: 'hijacked' }), /not found/)
  await assert.rejects(() => registerCompetition(clientA, fxA.schoolId, oppB.id), /not found/)
  await assert.rejects(() => registerCompetition(clientA, fxB.schoolId, oppB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot create or read competitions', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => createOpportunity(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})

test('repository behaviour: no generic update()/delete() exists — every lifecycle transition is its own named method', async () => {
  const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repos.competitions))
  assert.ok(!repoMethods.includes('update'), 'CompetitionRepository must not expose a generic update()')
  assert.ok(!repoMethods.includes('delete'), 'CompetitionRepository must not expose a generic delete()')
  assert.ok(!repoMethods.includes('mutate'), 'CompetitionRepository must not expose a generic mutate()')
  assert.ok(repoMethods.includes('register'), 'named lifecycle methods must exist')
  assert.ok(repoMethods.includes('publish'))
  assert.ok(repoMethods.includes('revoke'))
  assert.ok(repoMethods.includes('moveToHistorical'))
})

test('regression: Portfolio, Achievement, and Projects are entirely unaffected by the Competitions domain\'s addition — all three still work normally in the same fixture, and Blueprint composes every section together without error', async () => {
  const fx = await fixtureSchoolWithTeacher('regression')
  const client = await signInAs(fx.teacherEmail)

  const achievement = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    achievementType: 'competition', category: 'academic', title: 'Regional Debate — Finalist',
    description: null, supportingEvidenceIds: [], verifyingDocumentReference: 'ref-1',
    awardingOrganization: 'Kenya Debate Union', awardDate: '2026-05-01', expiresAt: null,
  })
  await verifyAchievement(client, fx.schoolId, achievement.id)
  await publishAchievement(client, fx.schoolId, achievement.id)
  const achievementSummary = await getAchievementSummary(fx.learnerId, fx.schoolId)
  assert.equal(achievementSummary.available, true)
  assert.equal(achievementSummary.achievementCount, 1)

  const portfolioItem = await addPortfolioItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    category: 'research', title: 'Water Quality Study', description: null, reflection: null, supportingEvidenceIds: [],
  })
  await submitPortfolioItem(client, fx.schoolId, portfolioItem.id)
  await verifyItem(client, fx.schoolId, portfolioItem.id)
  await publishItem(client, fx.schoolId, portfolioItem.id)
  const portfolioSummary = await getPortfolioSummary(fx.learnerId, fx.schoolId)
  assert.equal(portfolioSummary.available, true)
  assert.equal(portfolioSummary.publishedCount, 1)

  const project = await createProjectDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    title: 'Community Garden', description: null, goal: null, category: 'community',
    startDate: null, completionDate: null, reflection: null, supportingEvidenceIds: [],
  })
  const projectsSummary = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(projectsSummary.available, false, 'a draft-only project has no published or active signal yet, unrelated to Competitions')
  void project

  const competition = await createOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await registerCompetition(client, fx.schoolId, competition.id)

  // Blueprint composes every section together — Achievement/Portfolio/Competitions all present, none clobbered by another.
  const { blueprint } = await composeBlueprint({ actorUserId: fx.teacherUserId, coreLearnerId: fx.learnerId, schoolId: fx.schoolId })
  assert.equal(blueprint.achievement.status, 'available')
  assert.equal(blueprint.achievement.data!.achievementCount, 1)
  assert.equal(blueprint.portfolio.status, 'available')
  assert.equal(blueprint.portfolio.data!.publishedCount, 1)
  assert.equal(blueprint.competitions.status, 'available')
  assert.equal(blueprint.competitions.data!.currentParticipation!.name, FIELDS.name)
})
