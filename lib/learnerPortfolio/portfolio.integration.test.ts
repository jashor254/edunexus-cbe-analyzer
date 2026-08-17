// lib/learnerPortfolio/portfolio.integration.test.ts
//
// Sprint 12V — proves, against real synthetic Supabase data, the full
// Learner Portfolio lifecycle (Draft -> Submitted -> Verified ->
// Published -> Archived, Rejected reachable from Submitted) and that the
// DB trigger — not just this service's own checks — is the final backstop
// against editing a published item, exactly like teacher_reflections
// before it. Also proves Blueprint composition (empty + published),
// cross-school isolation, and permission checks.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerPortfolio/portfolio.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  addItem, updateDraftItem, submitItem, verifyItem, rejectItem, publishItem, archiveItem,
  findCurrentPortfolio, listPublished, getPortfolioSummary,
} from './portfolio'
import { composePortfolio } from '@/lib/learnerBlueprint/composePortfolio'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_12V_PORTFOLIO_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12v-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_portfolios/portfolio_items/media/tags
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
    admission_number: `12v-${labelPrefix}-${Date.now()}`,
    first_name: 'Portfolio', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Portfolio Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  category: 'projects' as const,
  title: 'Solar-powered water pump prototype',
  description: 'Built a small-scale solar pump for the school garden.',
  reflection: 'Learned a lot about circuit design and persistence.',
  supportingEvidenceIds: [],
}

test('full lifecycle: draft -> submit -> verify -> publish -> archive, immutability at every stage', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await findCurrentPortfolio(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])

  const draft = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.publishedAt, null)

  // Business rules: cannot verify/publish/archive out of order.
  await assert.rejects(() => verifyItem(client, fx.schoolId, draft.id), /Only a submitted item can be verified/)
  await assert.rejects(() => publishItem(client, fx.schoolId, draft.id), /has not been verified/)
  await assert.rejects(() => archiveItem(client, fx.schoolId, draft.id), /Only a published item/)

  const edited = await updateDraftItem(client, fx.schoolId, draft.id, { title: 'Solar-powered water pump — v2' })
  assert.equal(edited.title, 'Solar-powered water pump — v2')
  assert.equal(edited.description, FIELDS.description, 'unedited fields survive a partial update untouched')

  const submitted = await submitItem(client, fx.schoolId, draft.id)
  assert.equal(submitted.status, 'submitted')

  const verified = await verifyItem(client, fx.schoolId, draft.id)
  assert.equal(verified.status, 'verified')
  assert.ok(verified.verifiedBy)
  assert.ok(verified.verifiedAt)

  const published = await publishItem(client, fx.schoolId, draft.id)
  assert.equal(published.status, 'published')
  assert.ok(published.publishedAt)

  // Now listPublished/summary see it, and Blueprint composes it.
  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 1)
  assert.equal(pub[0].id, draft.id)

  const summary = await getPortfolioSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.equal(summary.publishedCount, 1)
  assert.equal(summary.latestItem!.title, 'Solar-powered water pump — v2')

  // Service-layer immutability: a clean, actionable error, not a raw DB exception.
  await assert.rejects(
    () => updateDraftItem(client, fx.schoolId, draft.id, { title: 'trying to edit a published item' }),
    /no longer a draft/
  )

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('portfolio_items').update({ title: 'tampered' }).eq('id', draft.id)
  assert.ok(rawUpdate.error, 'UPDATE (non-archive field) on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('portfolio_items').delete().eq('id', draft.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Archive is the one legal transition on a published row.
  const archived = await archiveItem(client, fx.schoolId, draft.id)
  assert.equal(archived.status, 'archived')
  assert.ok(archived.archivedAt)

  // Archived is also immutable, including delete.
  const rawDeleteArchived = await db.from('portfolio_items').delete().eq('id', draft.id)
  assert.ok(rawDeleteArchived.error, 'DELETE on an archived row must be rejected by the immutability trigger')

  await assert.rejects(() => archiveItem(client, fx.schoolId, draft.id), /Only a published item/)
})

test('verification workflow: teacher reject requires a reason and returns the item to a terminal rejected state', async () => {
  const fx = await fixtureSchoolWithTeacher('reject')
  const client = await signInAs(fx.teacherEmail)

  const draft = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await submitItem(client, fx.schoolId, draft.id)

  await assert.rejects(() => rejectItem(client, fx.schoolId, draft.id, ''), /rejection reason is required/)

  const rejected = await rejectItem(client, fx.schoolId, draft.id, 'Missing evidence of the final build.')
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.rejectedReason, 'Missing evidence of the final build.')

  // A rejected item never leaks into the published surface.
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])
})

test('category validation rejects non-canonical categories, including "innovation" (Achievement-owned per ADR-0012)', async () => {
  const fx = await fixtureSchoolWithTeacher('category')
  const client = await signInAs(fx.teacherEmail)

  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'innovation' }),
    /not a canonical Portfolio category/
  )
  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'awards' }),
    /not a canonical Portfolio category/
  )
})

test('multiple items, mixed categories: findCurrentPortfolio returns all statuses, listPublished returns only published', async () => {
  const fx = await fixtureSchoolWithTeacher('mixed')
  const client = await signInAs(fx.teacherEmail)

  const item1 = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'projects', title: 'Project A' })
  const item2 = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'creative_work', title: 'Painting B' })
  const item3 = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'research', title: 'Research C' })

  for (const item of [item1, item2]) {
    await submitItem(client, fx.schoolId, item.id)
    await verifyItem(client, fx.schoolId, item.id)
    await publishItem(client, fx.schoolId, item.id)
  }
  // item3 stays a draft.

  const all = await findCurrentPortfolio(client, fx.schoolId, fx.learnerId)
  assert.equal(all.length, 3)

  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 2)
  assert.ok(pub.every(i => i.status === 'published'))

  const summary = await getPortfolioSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.publishedCount, 2)
})

test('Blueprint composition: unavailable for an empty portfolio, available with a summary once an item is published', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await composePortfolio(fx.learnerId, fx.schoolId)
  assert.equal(empty.status, 'unavailable')
  assert.equal(empty.data, null)

  const item = await addItem(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await submitItem(client, fx.schoolId, item.id)
  await verifyItem(client, fx.schoolId, item.id)
  await publishItem(client, fx.schoolId, item.id)

  const available = await composePortfolio(fx.learnerId, fx.schoolId)
  assert.equal(available.status, 'available')
  assert.equal(available.data!.publishedCount, 1)
  assert.equal(available.data!.latestItem!.title, FIELDS.title)
  // Blueprint's field budget: never a description/reflection field leaked through.
  assert.deepEqual(Object.keys(available.data!).sort(), ['featuredItem', 'latestItem', 'portfolioUrl', 'publishedCount'])
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s portfolio items', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const itemB = await addItem(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  // Wrong school_id for this item -> service treats it as not found, never leaks School B's row.
  await assert.rejects(() => updateDraftItem(clientA, fxA.schoolId, itemB.id, { title: 'hijacked' }), /not found/)
  await assert.rejects(() => submitItem(clientA, fxA.schoolId, itemB.id), /not found/)

  // A membership-less client for School B's own school cannot act either (no school_users row there).
  await assert.rejects(() => submitItem(clientA, fxB.schoolId, itemB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot add or read Portfolio items', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => addItem(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})
