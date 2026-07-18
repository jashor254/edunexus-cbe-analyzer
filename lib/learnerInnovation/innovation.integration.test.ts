// lib/learnerInnovation/innovation.integration.test.ts
//
// Sprint 13I — proves, against real synthetic Supabase data, the full
// Learner Innovation lifecycle (Idea -> Exploration -> Prototype ->
// Testing -> Refinement -> Validation -> Implementation -> Archived, Not
// Validated reachable from Refinement, Discontinued reachable from Idea
// through Refinement, Revoked reachable from Implementation) strictly
// forward-only, with append-only iteration logging, and that the DB
// trigger — not just this service's own checks — is the final backstop
// against editing a terminal-state or implemented record. Also proves
// Blueprint composition, unavailable/archived states, validation-required
// gating, iteration ordering, cross-school isolation, authorization, and
// — per the mission's explicit Phase 10 instruction — that every sibling
// domain and Blueprint's other sections are entirely unaffected.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerInnovation/innovation.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  createIdea, updateIdea, beginExploration, createPrototype, moveToTesting, moveToRefinement,
  validateInnovation, markNotValidated, implementInnovation, archiveInnovation, revokeInnovation,
  discontinueInnovation, addIteration, listIterations, listForLearner, listImplemented,
  getInnovationsSummary, getVerificationHistory,
} from './innovation'
import { composeInnovation } from '@/lib/learnerBlueprint/composeInnovation'
import { createAchievement, verifyAchievement, publishAchievement, getAchievementSummary } from '@/lib/learnerAchievement/achievement'
import { addItem as addPortfolioItem, submitItem as submitPortfolioItem, verifyItem, publishItem, getPortfolioSummary } from '@/lib/learnerPortfolio/portfolio'
import { createDraft as createProjectDraft, getProjectsSummary } from '@/lib/learnerProjects/project'
import { createOpportunity as createCompetitionOpportunity, registerCompetition, getCompetitionsSummary } from '@/lib/learnerCompetitions/competition'
import { createNomination, selectForLeadership, getLeadershipSummary } from '@/lib/learnerLeadership/leadership'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'

const SYNTHETIC_MARKER = 'SYNTHETIC_13I_INNOVATION_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint13i-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_innovations/iterations/artifacts/review_history
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
    admission_number: `13i-${labelPrefix}-${Date.now()}`,
    first_name: 'Innovation', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Innovation Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  problemAddressed: 'Learners in rural areas struggle to access clean drinking water at school during dry seasons.',
  ideaSummary: 'A low-cost, gravity-fed sand-and-charcoal filtration system built from recycled containers.',
  supportingEvidenceIds: [],
}

const ITER = {
  problem: 'Initial filter clogs within two days of use.',
  hypothesis: 'A coarser first layer of gravel will reduce clogging.',
  changeIntroduced: 'Added a 3cm gravel pre-filter layer before the sand layer.',
  evidence: 'Flow rate measured before/after: 40ml/min -> 180ml/min after five days of continuous use.',
  outcome: 'Clogging reduced significantly; water still required a full day to filter a 5L batch.',
}

test('full lifecycle: idea -> exploration -> prototype -> testing -> refinement -> validation -> implementation -> archived, strictly forward-only, immutability at every stage, versioning + review history', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await listForLearner(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listImplemented(fx.learnerId, fx.schoolId), [])

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(idea.status, 'idea')
  assert.equal(idea.version, 1)

  // Illegal transitions from idea.
  await assert.rejects(() => moveToTesting(client, fx.schoolId, idea.id), /Only an innovation in prototype/)
  await assert.rejects(() => implementInnovation(client, fx.schoolId, idea.id, null, null), /has not been validated/)

  const edited = await updateIdea(client, fx.schoolId, idea.id, { ideaSummary: 'Revised: uses only locally-sourced materials.' })
  assert.match(edited.ideaSummary, /locally-sourced/)

  const exploring = await beginExploration(client, fx.schoolId, idea.id)
  assert.equal(exploring.status, 'exploration')

  // Once past idea, idea-only editing is closed (DB trigger backstop).
  await assert.rejects(() => updateIdea(client, fx.schoolId, idea.id, { ideaSummary: 'x' }), /moved past idea/)

  const prototype = await createPrototype(client, fx.schoolId, idea.id)
  assert.equal(prototype.status, 'prototype')

  const testing = await moveToTesting(client, fx.schoolId, idea.id)
  assert.equal(testing.status, 'testing')

  // Iteration logging is legal at Testing — repeated cycles never move status backward.
  const iter1 = await addIteration(client, fx.schoolId, idea.id, ITER.problem, ITER.hypothesis, ITER.changeIntroduced, ITER.evidence, ITER.outcome, 'Good first fix.')
  assert.equal(iter1.problem, ITER.problem)
  const iter2 = await addIteration(client, fx.schoolId, idea.id, 'Still too slow.', 'A wider filter body will increase flow.', 'Doubled the filter diameter.', 'Flow rate: 180ml/min -> 410ml/min.', 'Batch time reduced to 4 hours.', null)
  const afterTwoIterations = await listIterations(client, fx.schoolId, idea.id)
  assert.equal(afterTwoIterations.length, 2)
  assert.deepEqual(afterTwoIterations.map(i => i.id), [iter1.id, iter2.id], 'iterations are returned in creation order')

  const refined = await moveToRefinement(client, fx.schoolId, idea.id)
  assert.equal(refined.status, 'refinement')

  const validated = await validateInnovation(client, fx.schoolId, idea.id)
  assert.equal(validated.status, 'validation')
  assert.ok(validated.validatedBy)
  assert.ok(validated.validatedAt)

  const implemented = await implementInnovation(client, fx.schoolId, idea.id, 'Deployed at two classrooms; both report daily use.', 'Access to filtered water within 4 hours per 5L batch, verified by class teacher.')
  assert.equal(implemented.status, 'implementation')
  assert.ok(implemented.publishedAt, 'published_at is set at Implementation — this domain\'s credential-worthy moment')

  // Now listImplemented/summary see it, and Blueprint composes it.
  const impl = await listImplemented(fx.learnerId, fx.schoolId)
  assert.equal(impl.length, 1)
  assert.equal(impl[0].id, idea.id)

  const summary = await getInnovationsSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.ok(summary.latestImplementationDate)
  assert.match(summary.latestMilestone ?? '', /Implementation reached/)
  // Never exposes iteration history, teacher notes, internal review, artifacts, or testing data.
  assert.deepEqual(Object.keys(summary).sort(), ['available', 'currentStage', 'innovationsUrl', 'iterationCount', 'latestImplementationDate', 'latestMilestone'])
  assert.equal(JSON.stringify(summary).includes('gravel'), false)

  // Full transition history, in order.
  const history = await getVerificationHistory(client, fx.schoolId, idea.id)
  assert.deepEqual(
    history.map(h => `${h.fromStatus}->${h.toStatus}`),
    ['idea->exploration', 'exploration->prototype', 'prototype->testing', 'testing->refinement', 'refinement->validation', 'validation->implementation']
  )

  // Service-layer immutability.
  await assert.rejects(() => updateIdea(client, fx.schoolId, idea.id, { ideaSummary: 'tampered' }), /moved past idea/)

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('learner_innovations').update({ idea_summary: 'tampered' }).eq('id', idea.id)
  assert.ok(rawUpdate.error, 'UPDATE (non archive/revoke field) on an implemented row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_innovations').delete().eq('id', idea.id)
  assert.ok(rawDelete.error, 'DELETE on an implemented row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Archive is one of the two legal transitions on an implemented row.
  const archived = await archiveInnovation(client, fx.schoolId, idea.id)
  assert.equal(archived.status, 'archived')
  assert.ok(archived.archivedAt)

  // Archived cannot reopen — fully terminal.
  const rawUpdateArchived = await db.from('learner_innovations').update({ idea_summary: 'tampered again' }).eq('id', idea.id)
  assert.ok(rawUpdateArchived.error, 'UPDATE on an archived row must be rejected')
  await assert.rejects(() => archiveInnovation(client, fx.schoolId, idea.id), /Only an innovation in implementation/)

  // Iterations remain append-only forever — proven again post-archival.
  const rawIterationUpdate = await db.from('innovation_iterations').update({ outcome: 'tampered' }).eq('id', iter1.id)
  assert.ok(rawIterationUpdate.error, 'UPDATE on an innovation_iterations row must be rejected — append-only')
  const rawIterationDelete = await db.from('innovation_iterations').delete().eq('id', iter1.id)
  assert.ok(rawIterationDelete.error, 'DELETE on an innovation_iterations row must be rejected — append-only')

  // Review history rows are themselves append-only.
  const anyHistoryRow = (await getVerificationHistory(client, fx.schoolId, idea.id))[0]
  const rawHistoryUpdate = await db.from('innovation_review_history').update({ reason: 'tampered' })
    .eq('innovation_id', idea.id).eq('version', anyHistoryRow.version)
  assert.ok(rawHistoryUpdate.error, 'UPDATE on an innovation_review_history row must be rejected — append-only')
})

test('validation required: implementation without validation is rejected', async () => {
  const fx = await fixtureSchoolWithTeacher('validation-required')
  const client = await signInAs(fx.teacherEmail)

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await beginExploration(client, fx.schoolId, idea.id)
  await createPrototype(client, fx.schoolId, idea.id)
  await moveToTesting(client, fx.schoolId, idea.id)
  const refined = await moveToRefinement(client, fx.schoolId, idea.id)

  // Cannot implement directly from refinement — validation is mandatory.
  await assert.rejects(() => implementInnovation(client, fx.schoolId, refined.id, null, null), /has not been validated/)
})

test('terminal branch: Not Validated is reachable only from Refinement, a sibling outcome of the same gate validateInnovation() passes', async () => {
  const fx = await fixtureSchoolWithTeacher('not-validated')
  const client = await signInAs(fx.teacherEmail)

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => markNotValidated(client, fx.schoolId, idea.id, 'x'), /Only an innovation in refinement/)

  await beginExploration(client, fx.schoolId, idea.id)
  await createPrototype(client, fx.schoolId, idea.id)
  await moveToTesting(client, fx.schoolId, idea.id)
  const refined = await moveToRefinement(client, fx.schoolId, idea.id)

  await assert.rejects(() => markNotValidated(client, fx.schoolId, refined.id, ''), /reason is required/)
  const notValidated = await markNotValidated(client, fx.schoolId, refined.id, 'The filtration rate does not meet the minimum standard for potable water.')
  assert.equal(notValidated.status, 'not_validated')

  const rawUpdate = await db.from('learner_innovations').update({ idea_summary: 'x' }).eq('id', idea.id)
  assert.ok(rawUpdate.error, 'a not_validated row is permanently immutable')
})

test('terminal branch: Discontinued is reachable from Idea through Refinement, requires both a reason and a lessons-learned field — failure is educational evidence, never a silent drop', async () => {
  const fx = await fixtureSchoolWithTeacher('discontinue')
  const client = await signInAs(fx.teacherEmail)

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => discontinueInnovation(client, fx.schoolId, idea.id, 'x', ''), /lessons-learned note is required/)
  const discontinued = await discontinueInnovation(client, fx.schoolId, idea.id, 'Materials became unavailable.', 'Learned that sourcing plans need a backup supplier identified up front.')
  assert.equal(discontinued.status, 'discontinued')
  assert.equal(discontinued.lessonsLearned, 'Learned that sourcing plans need a backup supplier identified up front.')

  const rawUpdate = await db.from('learner_innovations').update({ idea_summary: 'x' }).eq('id', idea.id)
  assert.ok(rawUpdate.error, 'a discontinued row is permanently immutable')

  // Once Validation is reached, Discontinued is no longer a legal exit (only Not Validated/Implementation/Revoked apply from there on).
  const idea2 = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await beginExploration(client, fx.schoolId, idea2.id)
  await createPrototype(client, fx.schoolId, idea2.id)
  await moveToTesting(client, fx.schoolId, idea2.id)
  await moveToRefinement(client, fx.schoolId, idea2.id)
  const validated2 = await validateInnovation(client, fx.schoolId, idea2.id)
  await assert.rejects(() => discontinueInnovation(client, fx.schoolId, validated2.id, 'x', 'y'), /Only an innovation in Idea, Exploration, Prototype, Testing, or Refinement/)
})

test('terminal branch: Revoked is reachable only from Implementation, and revocation removes it from the implemented surface', async () => {
  const fx = await fixtureSchoolWithTeacher('revoke')
  const client = await signInAs(fx.teacherEmail)

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await beginExploration(client, fx.schoolId, idea.id)
  await createPrototype(client, fx.schoolId, idea.id)
  await moveToTesting(client, fx.schoolId, idea.id)
  await moveToRefinement(client, fx.schoolId, idea.id)
  await validateInnovation(client, fx.schoolId, idea.id)
  await implementInnovation(client, fx.schoolId, idea.id, null, null)
  assert.equal((await listImplemented(fx.learnerId, fx.schoolId)).length, 1)

  await assert.rejects(() => revokeInnovation(client, fx.schoolId, idea.id, ''), /revocation reason is required/)
  const revoked = await revokeInnovation(client, fx.schoolId, idea.id, 'Later found the testing evidence was fabricated.')
  assert.equal(revoked.status, 'revoked')
  assert.equal((await listImplemented(fx.learnerId, fx.schoolId)).length, 0)
  const summary = await getInnovationsSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.latestImplementationDate, null)
})

test('Blueprint composition: unavailable for zero innovations, available once implemented, currentStage surfaces only an in-flight entry with no internal detail', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await composeInnovation(fx.learnerId, fx.schoolId)
  assert.equal(empty.status, 'unavailable')
  assert.equal(empty.data, null)

  // An in-flight (not yet implemented) innovation surfaces as currentStage only.
  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await beginExploration(client, fx.schoolId, idea.id)

  const midway = await composeInnovation(fx.learnerId, fx.schoolId)
  assert.equal(midway.status, 'available')
  assert.equal(midway.data!.currentStage!.status, 'exploration')
  assert.equal(midway.data!.latestImplementationDate, null, 'never counts unimplemented work as a milestone date')
  // currentStage never leaks internal lifecycle detail beyond problem/status.
  assert.deepEqual(Object.keys(midway.data!.currentStage!).sort(), ['problemAddressed', 'status'])
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s innovations', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const ideaB = await createIdea(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  await assert.rejects(() => updateIdea(clientA, fxA.schoolId, ideaB.id, { ideaSummary: 'hijacked' }), /not found/)
  await assert.rejects(() => beginExploration(clientA, fxA.schoolId, ideaB.id), /not found/)
  await assert.rejects(() => beginExploration(clientA, fxB.schoolId, ideaB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot create or read innovations', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => createIdea(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})

test('repository behaviour: no generic update()/delete()/mutate()/save() exists — every lifecycle transition is its own named method', async () => {
  const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repos.innovations))
  assert.ok(!repoMethods.includes('update'), 'InnovationRepository must not expose a generic update()')
  assert.ok(!repoMethods.includes('delete'), 'InnovationRepository must not expose a generic delete()')
  assert.ok(!repoMethods.includes('mutate'), 'InnovationRepository must not expose a generic mutate()')
  assert.ok(!repoMethods.includes('save'), 'InnovationRepository must not expose a generic save()')
  assert.ok(repoMethods.includes('createIdea'))
  assert.ok(repoMethods.includes('implementInnovation'))
  assert.ok(repoMethods.includes('archiveInnovation'))
})

test('regression: Portfolio, Achievement, Projects, Competitions, and Leadership are entirely unaffected by the Innovation domain\'s addition — all five still work normally in the same fixture, and Blueprint composes every section together without error', async () => {
  const fx = await fixtureSchoolWithTeacher('regression')
  const client = await signInAs(fx.teacherEmail)

  const achievement = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    achievementType: 'innovation', category: 'innovation', title: 'Regional Science Fair — Innovation Prize',
    description: null, supportingEvidenceIds: [], verifyingDocumentReference: 'ref-1',
    awardingOrganization: 'Mwatate Ridge Senior School', awardDate: '2026-05-01', expiresAt: null,
  })
  await verifyAchievement(client, fx.schoolId, achievement.id)
  await publishAchievement(client, fx.schoolId, achievement.id)
  const achievementSummary = await getAchievementSummary(fx.learnerId, fx.schoolId)
  assert.equal(achievementSummary.available, true)
  assert.equal(achievementSummary.achievementCount, 1)

  const portfolioItem = await addPortfolioItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    category: 'research', title: 'Water Filtration Design Notes', description: null, reflection: null, supportingEvidenceIds: [],
  })
  await submitPortfolioItem(client, fx.schoolId, portfolioItem.id)
  await verifyItem(client, fx.schoolId, portfolioItem.id)
  await publishItem(client, fx.schoolId, portfolioItem.id)
  const portfolioSummary = await getPortfolioSummary(fx.learnerId, fx.schoolId)
  assert.equal(portfolioSummary.available, true)
  assert.equal(portfolioSummary.publishedCount, 1)

  const project = await createProjectDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    title: 'Water Filtration Build', description: null, goal: null, category: 'innovation',
    startDate: null, completionDate: null, reflection: null, supportingEvidenceIds: [],
  })
  const projectsSummary = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(projectsSummary.available, false, 'a draft-only project has no published or active signal yet, unrelated to Innovation')
  void project

  const competition = await createCompetitionOpportunity(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    name: 'National Innovation Challenge', organizingBody: 'Kenya Innovation Board', level: 'national', category: 'innovation',
    eventDate: '2026-09-01', venue: null, projectId: null, supportingEvidenceIds: [],
  })
  await registerCompetition(client, fx.schoolId, competition.id)
  const competitionsSummary = await getCompetitionsSummary(fx.learnerId, fx.schoolId)
  assert.equal(competitionsSummary.available, true)
  assert.equal(competitionsSummary.currentParticipation!.name, 'National Innovation Challenge')

  const leadershipEntry = await createNomination(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    positionTitle: 'Science Club President', scope: 'Whole School', body: 'Science Club',
    responsibilities: 'Leads weekly science club sessions.', isActing: false, supportingEvidenceIds: [],
  })
  await selectForLeadership(client, fx.schoolId, leadershipEntry.id)
  const leadershipSummary = await getLeadershipSummary(fx.learnerId, fx.schoolId)
  assert.equal(leadershipSummary.available, true)
  assert.equal(leadershipSummary.currentRole!.title, 'Science Club President')

  const idea = await createIdea(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await beginExploration(client, fx.schoolId, idea.id)

  // Blueprint composes every section together — Achievement/Portfolio/Competitions/Leadership/Innovation all present, none clobbered by another.
  const { blueprint } = await composeBlueprint({ actorUserId: fx.teacherUserId, coreLearnerId: fx.learnerId, schoolId: fx.schoolId })
  assert.equal(blueprint.achievement.status, 'available')
  assert.equal(blueprint.achievement.data!.achievementCount, 1)
  assert.equal(blueprint.portfolio.status, 'available')
  assert.equal(blueprint.portfolio.data!.publishedCount, 1)
  assert.equal(blueprint.competitions.status, 'available')
  assert.equal(blueprint.competitions.data!.currentParticipation!.name, 'National Innovation Challenge')
  assert.equal(blueprint.leadership.status, 'available')
  assert.equal(blueprint.leadership.data!.currentRole!.title, 'Science Club President')
  assert.equal(blueprint.innovations.status, 'available')
  assert.equal(blueprint.innovations.data!.currentStage!.status, 'exploration')
})
