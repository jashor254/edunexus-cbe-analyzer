// lib/teacherReflection/reflection.integration.test.ts
//
// Sprint 12O — proves, against real synthetic Supabase data, the full
// Teacher Reflection lifecycle (Phase 5: Draft -> Teacher Editing ->
// Published -> immutable forever) and that the DB trigger — not just this
// service's own checks — is the final backstop against editing a published
// row, exactly like `learner_evidence`/`blueprint_snapshots` before it.
//
// Run: npx tsx --env-file=.env.local --test lib/teacherReflection/reflection.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createDraft, updateDraft, publish, findCurrent, history } from './reflection'

const SYNTHETIC_MARKER = 'SYNTHETIC_12O_TEACHER_REFLECTION_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12o-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades teacher_reflections (learner_id -> learners, school_id -> schools, both ON DELETE CASCADE)
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
    admission_number: `12o-${labelPrefix}-${Date.now()}`,
    first_name: 'Reflection', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Reflection Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  strengths: 'Consistently helps classmates during group work and explains ideas clearly.',
  growthArea: 'Still building confidence presenting to the whole class.',
  learningHabits: 'Completes homework early and reviews notes the same evening.',
  recommendedSupport: 'More small-group speaking opportunities before whole-class presentations.',
  holidayFocus: 'Practice reading aloud for 10 minutes a day.',
}

test('full lifecycle: draft -> edit -> publish -> immutable, findCurrent/history correct at every stage', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  // No draft, no published reflection yet.
  assert.equal(await findCurrent(fx.learnerId, fx.schoolId), null)
  assert.deepEqual(await history(fx.learnerId, fx.schoolId), [])

  const draft = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.version, 1)
  assert.equal(draft.published_at, null)

  // A draft is never surfaced by findCurrent — Blueprint must never see it.
  assert.equal(await findCurrent(fx.learnerId, fx.schoolId), null)

  // A second createDraft for the same learner is refused — must edit the existing one.
  await assert.rejects(() => createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS), /already exists/)

  const edited = await updateDraft(client, fx.schoolId, draft.id, { growthArea: 'Now comfortable with small groups — next: pairs to whole class.' })
  assert.equal(edited.growth_area, 'Now comfortable with small groups — next: pairs to whole class.')
  assert.equal(edited.strengths, FIELDS.strengths, 'unedited fields survive a partial update untouched')

  const published = await publish(client, fx.schoolId, draft.id, fx.teacherUserId)
  assert.equal(published.status, 'published')
  assert.ok(published.published_at)
  assert.equal(published.teacher_signature, 'lifecycle Teacher')

  // Now findCurrent/history see it.
  const current = await findCurrent(fx.learnerId, fx.schoolId)
  assert.ok(current)
  assert.equal(current!.id, draft.id)
  const hist = await history(fx.learnerId, fx.schoolId)
  assert.equal(hist.length, 1)
  assert.equal(hist[0].id, draft.id)

  // Service-layer immutability: a clean, actionable error, not a raw DB exception.
  await assert.rejects(
    () => updateDraft(client, fx.schoolId, draft.id, { strengths: 'trying to edit a published reflection' }),
    /already published and can never be edited/
  )
  await assert.rejects(() => publish(client, fx.schoolId, draft.id, fx.teacherUserId), /already published/)

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('teacher_reflections').update({ strengths: 'tampered' }).eq('id', draft.id)
  assert.ok(rawUpdate.error, 'UPDATE on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('teacher_reflections').delete().eq('id', draft.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /immutable/i)

  const stillThere = await findCurrent(fx.learnerId, fx.schoolId)
  assert.equal(stillThere!.strengths, edited.strengths, 'unchanged — the attempted tamper never took effect')
})

test('a second reflection cycle is a new version, never an edit of the published one', async () => {
  const fx = await fixtureSchoolWithTeacher('version')
  const client = await signInAs(fx.teacherEmail)

  const first = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await publish(client, fx.schoolId, first.id, fx.teacherUserId)

  const second = await createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, growthArea: 'A completely new cycle of growth areas for next term.',
  })
  assert.equal(second.version, 2)
  await publish(client, fx.schoolId, second.id, fx.teacherUserId)

  const current = await findCurrent(fx.learnerId, fx.schoolId)
  assert.equal(current!.id, second.id, 'findCurrent returns the highest published version')

  const hist = await history(fx.learnerId, fx.schoolId)
  assert.equal(hist.length, 2)
  assert.equal(hist[0].id, second.id, 'newest first')
  assert.equal(hist[1].id, first.id)
})

test('required fields cannot be blank, and a draft cannot be created without them', async () => {
  const fx = await fixtureSchoolWithTeacher('validation')
  const client = await signInAs(fx.teacherEmail)

  await assert.rejects(
    () => createDraft(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, strengths: '   ' }),
    /"strengths" is required/
  )
})
