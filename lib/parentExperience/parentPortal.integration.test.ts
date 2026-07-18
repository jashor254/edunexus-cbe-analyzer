// lib/parentExperience/parentPortal.integration.test.ts
//
// Sprint 12Q — proves, against real synthetic Supabase data, the full data
// path every Parent Portal page relies on: the exact same permission gate
// every other Blueprint-adjacent surface uses (`requireParent`, no new
// permission system per mission Phase 7), and that `composeBlueprint()` /
// `listBlueprintSnapshots()` / `getLatestBlueprintSnapshot()` — the only
// three functions any Parent Portal route calls — work correctly for a
// real linked guardian, and correctly reject an unlinked user.
//
// Run: npx tsx --env-file=.env.local --test lib/parentExperience/parentPortal.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { requireParent } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import { listBlueprintSnapshots, getLatestBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'

const SYNTHETIC_MARKER = 'SYNTHETIC_12Q_PARENT_PORTAL_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12q-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id)
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fixtureSchoolWithLearner(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  const enroll = await onboardLearner(school.id, {
    admission_number: `12q-${labelPrefix}-${Date.now()}`,
    first_name: 'Portal', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: `${labelPrefix} Guardian`, phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('fixture enrollment failed')
  const learnerId = enroll.learnerId!

  return { schoolId: school.id, adminId: admin.id, learnerId }
}

test('a real linked guardian passes requireParent and can compose the exact same Blueprint any Parent Portal page would render', async () => {
  const fx = await fixtureSchoolWithLearner('linked')

  const parentUser = await mkAuthUser('parent')
  const { data: guardianRow } = await db.from('learner_guardians').select('id').eq('learner_id', fx.learnerId).limit(1).maybeSingle()
  assert.ok(guardianRow, 'onboardLearner must have created a guardian row')
  await db.from('learner_guardians').update({ user_id: parentUser.id }).eq('id', guardianRow!.id)

  const client = await signInAs(parentUser.email)

  const user = await requireParent(client, fx.learnerId)
  assert.equal(user.id, parentUser.id)

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: parentUser.id,
    coreLearnerId: fx.learnerId,
    schoolId: fx.schoolId,
  })
  assert.equal(blueprint.identity.status, 'available')
  assert.equal(validation.valid, true, JSON.stringify(validation.errors))

  // The other two functions every Parent Portal history route calls.
  const history = await listBlueprintSnapshots(fx.learnerId, fx.schoolId)
  assert.deepEqual(history, [], 'no snapshot has been taken for this fresh learner yet — an empty array, not an error')
  const latest = await getLatestBlueprintSnapshot(fx.learnerId, fx.schoolId)
  assert.equal(latest, null)
})

test('an unlinked user is rejected by requireParent — the same gate every Parent Portal route relies on', async () => {
  const fx = await fixtureSchoolWithLearner('unlinked')
  const stranger = await mkAuthUser('stranger')
  const client = await signInAs(stranger.email)

  await assert.rejects(() => requireParent(client, fx.learnerId), ResourceOwnershipError)
})

test('a guardian of one learner cannot access a different, unrelated learner\'s Blueprint data', async () => {
  const fxA = await fixtureSchoolWithLearner('crossA')
  const fxB = await fixtureSchoolWithLearner('crossB')

  const parentA = await mkAuthUser('crossParentA')
  const { data: guardianRowA } = await db.from('learner_guardians').select('id').eq('learner_id', fxA.learnerId).limit(1).maybeSingle()
  await db.from('learner_guardians').update({ user_id: parentA.id }).eq('id', guardianRowA!.id)

  const client = await signInAs(parentA.email)

  await requireParent(client, fxA.learnerId) // sanity: still works for their own child
  await assert.rejects(() => requireParent(client, fxB.learnerId), ResourceOwnershipError)
})
