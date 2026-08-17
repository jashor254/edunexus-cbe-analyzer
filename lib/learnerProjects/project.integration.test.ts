// lib/learnerProjects/project.integration.test.ts
//
// Sprint 12Z — proves, against real synthetic Supabase data, the full
// Learner Projects lifecycle (Draft -> Planning -> In Progress ->
// Submitted -> Reviewed -> Verified -> Published -> Archived, Rejected
// reachable from Submitted/Reviewed, Cancelled reachable only from
// Draft/Planning/In Progress) and that the DB trigger — not just this
// service's own checks — is the final backstop against editing a
// terminal-state or published row. Also proves: Evidence is optional at
// verify() (a real difference from Achievement's non-negotiable rule),
// team/mentor/progress/artifact helpers, Blueprint composition, the
// Portfolio-references-Projects relationship (linked/reserved/
// not_applicable, never fabricated), cross-school isolation, and
// permission checks.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerProjects/project.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  createDraft, updateDraft, moveToPlanning, startInProgress, submitProject, reviewProject,
  verifyProject, rejectProject, publishProject, archiveProject, cancelProject,
  addTeamMember, addMentor, addProgressUpdate, addArtifactLink,
  listForLearner, listPublished, getProjectsSummary,
} from './project'
import { addItem, linkItemToProject } from '@/lib/learnerPortfolio/portfolio'
import { resolveProjectReference } from '@/lib/learnerPortfolio/portfolioProjectLink'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_12Z_PROJECT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12z-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_projects/members/mentors/updates/artifacts + portfolio_items.project_id SET NULL
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
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
    admission_number: `12z-${labelPrefix}-${Date.now()}`,
    first_name: 'Project', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Project Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  title: 'Solar-Powered Irrigation System',
  description: 'A drip-irrigation prototype for the school garden, powered by a small solar panel.',
  goal: 'Reduce manual watering time by half while keeping the garden bed consistently moist.',
  category: 'innovation' as const,
  startDate: null,
  completionDate: null,
  reflection: null,
  supportingEvidenceIds: [],
}

test('full lifecycle: draft -> planning -> in_progress -> submitted -> reviewed -> verified -> published -> archived, immutability at every stage', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await listForLearner(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])

  const draft = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.version, 1)

  // Business rules: cannot skip stages.
  await assert.rejects(() => startInProgress(client, fx.schoolId, draft.id), /Only a project in planning/)
  await assert.rejects(() => submitProject(client, fx.schoolId, draft.id), /Only a project in progress/)
  await assert.rejects(() => publishProject(client, fx.schoolId, draft.id), /has not been verified/)
  await assert.rejects(() => archiveProject(client, fx.schoolId, draft.id), /Only a published project/)

  const edited = await updateDraft(client, fx.schoolId, draft.id, { title: 'Solar-Powered Irrigation System v2' })
  assert.equal(edited.title, 'Solar-Powered Irrigation System v2')
  assert.equal(edited.description, FIELDS.description, 'unedited fields survive a partial update untouched')

  const planning = await moveToPlanning(client, fx.schoolId, draft.id)
  assert.equal(planning.status, 'planning')
  assert.equal(planning.version, 2)

  const inProgress = await startInProgress(client, fx.schoolId, draft.id)
  assert.equal(inProgress.status, 'in_progress')
  assert.ok(inProgress.startDate, 'start_date is set on entry to In Progress')

  await addTeamMember(client, fx.schoolId, draft.id, fx.learnerId, 'Lead builder')
  await addMentor(client, fx.schoolId, draft.id, 'Mr. Otieno', null, 'Science teacher mentor')
  await addProgressUpdate(client, fx.schoolId, draft.id, 'Prototype wiring complete, testing pump flow rate next.')
  await addArtifactLink(client, fx.schoolId, draft.id, 'https://example.com/project-photo.jpg', 'Prototype photo')

  const submitted = await submitProject(client, fx.schoolId, draft.id)
  assert.equal(submitted.status, 'submitted')

  const reviewed = await reviewProject(client, fx.schoolId, draft.id, 'Good progress — clarify the water-saving measurement before verification.')
  assert.equal(reviewed.status, 'reviewed')
  assert.ok(reviewed.reviewedBy)
  assert.equal(reviewed.reviewNotes, 'Good progress — clarify the water-saving measurement before verification.')

  // Evidence is optional at verify() — a real, deliberate difference from Achievement's non-negotiable rule.
  const verified = await verifyProject(client, fx.schoolId, draft.id, 'teacher_verified', null)
  assert.equal(verified.status, 'verified')
  assert.equal(verified.verificationType, 'teacher_verified')
  assert.ok(verified.verifiedBy)

  const published = await publishProject(client, fx.schoolId, draft.id)
  assert.equal(published.status, 'published')
  assert.ok(published.publishedAt)

  // Now listPublished/summary see it, and Blueprint composes it, with full team/mentor/update/artifact data attached.
  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 1)
  assert.equal(pub[0].members.length, 1)
  assert.equal(pub[0].mentors.length, 1)
  assert.equal(pub[0].updates.length, 1)
  assert.equal(pub[0].artifacts.length, 1)

  const summary = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.equal(summary.projectCount, 1)
  assert.equal(summary.latestPublishedProject!.title, 'Solar-Powered Irrigation System v2')

  // Service-layer immutability.
  await assert.rejects(
    () => updateDraft(client, fx.schoolId, draft.id, { title: 'trying to edit a published project' }),
    /no longer a draft/
  )

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('learner_projects').update({ title: 'tampered' }).eq('id', draft.id)
  assert.ok(rawUpdate.error, 'UPDATE (non-archive field) on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_projects').delete().eq('id', draft.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Archive is the one legal transition on a published row.
  const archived = await archiveProject(client, fx.schoolId, draft.id)
  assert.equal(archived.status, 'archived')
  assert.ok(archived.archivedAt)

  const rawDeleteArchived = await db.from('learner_projects').delete().eq('id', draft.id)
  assert.ok(rawDeleteArchived.error, 'DELETE on an archived row must be rejected')
  await assert.rejects(() => archiveProject(client, fx.schoolId, draft.id), /Only a published project/)
})

test('reject is reachable from Submitted or Reviewed and is a distinct terminal state', async () => {
  const fx = await fixtureSchoolWithTeacher('reject')
  const client = await signInAs(fx.teacherEmail)

  const draft = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await moveToPlanning(client, fx.schoolId, draft.id)
  await startInProgress(client, fx.schoolId, draft.id)
  await submitProject(client, fx.schoolId, draft.id)

  await assert.rejects(() => rejectProject(client, fx.schoolId, draft.id, ''), /rejection reason is required/)
  const rejected = await rejectProject(client, fx.schoolId, draft.id, 'Could not confirm the described work took place.')
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.rejectedReason, 'Could not confirm the described work took place.')

  // Terminal — cannot review/verify/cancel a rejected project.
  await assert.rejects(() => reviewProject(client, fx.schoolId, draft.id, null), /Only a submitted project/)
  const rawUpdate = await db.from('learner_projects').update({ title: 'x' }).eq('id', draft.id)
  assert.ok(rawUpdate.error, 'a rejected row is permanently immutable')
})

test('cancel is reachable only from Draft/Planning/In Progress, never after Submitted', async () => {
  const fx = await fixtureSchoolWithTeacher('cancel')
  const client = await signInAs(fx.teacherEmail)

  const draftOnly = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  const cancelled = await cancelProject(client, fx.schoolId, draftOnly.id)
  assert.equal(cancelled.status, 'cancelled')
  assert.ok(cancelled.cancelledAt)

  const submittedOne = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await moveToPlanning(client, fx.schoolId, submittedOne.id)
  await startInProgress(client, fx.schoolId, submittedOne.id)
  await submitProject(client, fx.schoolId, submittedOne.id)
  await assert.rejects(() => cancelProject(client, fx.schoolId, submittedOne.id), /Only a Draft, Planning, or In Progress project/)
})

test('canonical category enforcement rejects non-canonical values', async () => {
  const fx = await fixtureSchoolWithTeacher('category')
  const client = await signInAs(fx.teacherEmail)

  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'competitions' }),
    /not a canonical Project category/
  )
})

test('Canonical summary: unavailable when no published/active projects, available with count/latest/current-active/featured once one exists', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(empty.available, false)

  const active = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, title: 'Active Research Project', category: 'research' })
  await moveToPlanning(client, fx.schoolId, active.id)
  await startInProgress(client, fx.schoolId, active.id)

  const withActive = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(withActive.available, true)
  assert.equal(withActive.currentActiveProject!.title, 'Active Research Project')
  assert.equal(withActive.projectCount, 0, 'not yet published, so publishedCount stays 0')

  const published = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, title: 'Published CBC Project', category: 'cbc' })
  await moveToPlanning(client, fx.schoolId, published.id)
  await startInProgress(client, fx.schoolId, published.id)
  await submitProject(client, fx.schoolId, published.id)
  await reviewProject(client, fx.schoolId, published.id, null)
  await verifyProject(client, fx.schoolId, published.id, 'teacher_verified', null)
  await publishProject(client, fx.schoolId, published.id)

  const full = await getProjectsSummary(fx.learnerId, fx.schoolId)
  assert.equal(full.projectCount, 1)
  assert.equal(full.latestPublishedProject!.title, 'Published CBC Project')
  assert.equal(full.featuredProject!.title, 'Published CBC Project')
  // Blueprint's field budget: never internal lifecycle state (status/verification/etc) leaked through.
  assert.deepEqual(
    Object.keys(full).sort(),
    ['available', 'currentActiveProject', 'featuredProject', 'latestPublishedProject', 'projectCount', 'projectsUrl']
  )
})

test('Portfolio-references-Projects: linked/reserved/not_applicable, never fabricated', async () => {
  const fx = await fixtureSchoolWithTeacher('portfolioref')
  const client = await signInAs(fx.teacherEmail)

  // A non-"projects" category is not_applicable.
  const creativeItem = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    category: 'creative_work', title: 'A painting', description: null, reflection: null, supportingEvidenceIds: [],
  })
  assert.deepEqual(await resolveProjectReference(creativeItem, fx.schoolId), { status: 'not_applicable' })

  // A "projects"-category item with no link is reserved, never fabricated.
  const projectItem = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    category: 'projects', title: 'My science project', description: null, reflection: null, supportingEvidenceIds: [],
  })
  assert.deepEqual(await resolveProjectReference(projectItem, fx.schoolId), { status: 'reserved' })

  // Linking to a real Project resolves it.
  const project = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, title: 'Linked Science Fair Project', category: 'academic' })
  const linkedItem = await linkItemToProject(client, fx.schoolId, projectItem.id, project.id)
  assert.equal(linkedItem.projectId, project.id)

  const resolved = await resolveProjectReference(linkedItem, fx.schoolId)
  assert.equal(resolved.status, 'linked')
  assert.equal((resolved as { status: 'linked'; project: { title: string } }).project.title, 'Linked Science Fair Project')

  // Cannot link a non-"projects"-category item.
  await assert.rejects(() => linkItemToProject(client, fx.schoolId, creativeItem.id, project.id), /Only a "projects"-category item/)
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s projects', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const projectB = await createDraft(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  await assert.rejects(() => updateDraft(clientA, fxA.schoolId, projectB.id, { title: 'hijacked' }), /not found/)
  await assert.rejects(() => moveToPlanning(clientA, fxB.schoolId, projectB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot create or read projects', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => createDraft(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})
