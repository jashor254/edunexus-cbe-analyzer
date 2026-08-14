// lib/learnerBlueprint/snapshot.test.ts
//
// Sprint 12K — proves, against real synthetic data, that Blueprint
// Snapshots (1) are created correctly with the real composed payload,
// (2) are immutable at the database level (UPDATE/DELETE both rejected,
// even via the service-role client), and (3) the two real trigger sites
// (report card publication, graduation) actually produce a snapshot.
// End-of-term is not separately tested — it calls the same
// publishReportCards() code path already proven here, only with a
// different snapshot_type argument (lib/core/report-cards.ts).
//
// Run: npx tsx --env-file=.env.local --test lib/learnerBlueprint/snapshot.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { publishReportCards, getReportCard } from '@/lib/core/report-cards'
import { runAnnualPromotion } from '@/lib/core/promotions'
import { getSchoolUser } from '@/lib/core/school-users'
import { createBlueprintSnapshot, getBlueprintSnapshot, listBlueprintSnapshots, getLatestBlueprintSnapshot } from './snapshot'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_12K_BLUEPRINT_SNAPSHOT_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string }> {
  const email = `sprint12k-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id }
}

after(async () => {
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades blueprint_snapshots (learner_id -> learners ON DELETE CASCADE, school_id -> schools ON DELETE CASCADE)
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fixtureSchool(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  return {
    adminId: admin.id,
    schoolId: school.id,
    classId: classes![0].id,
    academicYearId: classes![0].academic_year_id,
    termId: terms![0].id,
  }
}

test('createBlueprintSnapshot stores the real composed payload, retrievable by getBlueprintSnapshot and listBlueprintSnapshots', async () => {
  const fx = await fixtureSchool('create')
  const enroll = await onboardLearner(fx.schoolId, {
    admission_number: `12k-create-${Date.now()}`,
    first_name: 'Snap', last_name: 'Shot',
    class_id: fx.classId, term_id: fx.termId, academic_year_id: fx.academicYearId,
    guardian: { full_name: 'Snap Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  const row = await createBlueprintSnapshot({
    coreLearnerId: asLearnerId(learnerId),
    schoolId: fx.schoolId,
    academicYearId: fx.academicYearId,
    termId: fx.termId,
    snapshotType: 'end_of_term',
    sourceRecordId: null,
    actorUserId: fx.adminId,
  })

  assert.equal(row.learner_id, learnerId)
  assert.equal(row.snapshot_type, 'end_of_term')
  assert.equal(row.blueprint_payload.identity.data?.learnerName, 'Snap Shot')
  assert.equal(row.blueprint_payload.metadata.snapshotState, 'current', 'stored payload keeps its own composition-time metadata — the ROW carries the historical fact, not the payload')
  assert.equal(row.provenance.trigger, 'end_of_term')
  assert.equal(row.provenance.actorUserId, fx.adminId)
  assert.ok(row.schema_version)

  const fetched = await getBlueprintSnapshot(row.id, fx.schoolId)
  assert.ok(fetched)
  assert.equal(fetched!.id, row.id)

  const listed = await listBlueprintSnapshots(asLearnerId(learnerId), fx.schoolId)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, row.id)
})

test('getLatestBlueprintSnapshot returns the most recently created snapshot, and null when none exist (Sprint 12L-R)', async () => {
  const fx = await fixtureSchool('latest')
  const enroll = await onboardLearner(fx.schoolId, {
    admission_number: `12l-latest-${Date.now()}`,
    first_name: 'Latest', last_name: 'Snapshot',
    class_id: fx.classId, term_id: fx.termId, academic_year_id: fx.academicYearId,
    guardian: { full_name: 'Latest Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  assert.equal(await getLatestBlueprintSnapshot(asLearnerId(learnerId), fx.schoolId), null, 'no snapshots yet')

  const first = await createBlueprintSnapshot({
    coreLearnerId: asLearnerId(learnerId), schoolId: fx.schoolId,
    academicYearId: fx.academicYearId, termId: fx.termId,
    snapshotType: 'end_of_term', sourceRecordId: null, actorUserId: fx.adminId,
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  const second = await createBlueprintSnapshot({
    coreLearnerId: asLearnerId(learnerId), schoolId: fx.schoolId,
    academicYearId: fx.academicYearId, termId: fx.termId,
    snapshotType: 'graduation', sourceRecordId: null, actorUserId: fx.adminId,
  })

  const latest = await getLatestBlueprintSnapshot(asLearnerId(learnerId), fx.schoolId)
  assert.ok(latest)
  assert.equal(latest!.id, second.id, 'the more recently created row wins, not just insertion order')
  assert.notEqual(latest!.id, first.id)
})

test('blueprint_snapshots rows are immutable — UPDATE and DELETE are both rejected at the database level, even via the service-role client', async () => {
  const fx = await fixtureSchool('immutable')
  const enroll = await onboardLearner(fx.schoolId, {
    admission_number: `12k-immutable-${Date.now()}`,
    first_name: 'Frozen', last_name: 'Record',
    class_id: fx.classId, term_id: fx.termId, academic_year_id: fx.academicYearId,
    guardian: { full_name: 'Frozen Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  const row = await createBlueprintSnapshot({
    coreLearnerId: asLearnerId(learnerId),
    schoolId: fx.schoolId,
    academicYearId: fx.academicYearId,
    termId: fx.termId,
    snapshotType: 'graduation',
    sourceRecordId: null,
    actorUserId: fx.adminId,
  })

  const updateResult = await db.from('blueprint_snapshots').update({ schema_version: 'tampered' }).eq('id', row.id)
  assert.ok(updateResult.error, 'UPDATE must be rejected by the immutability trigger')
  assert.match(updateResult.error!.message, /immutable/i)

  const deleteResult = await db.from('blueprint_snapshots').delete().eq('id', row.id)
  assert.ok(deleteResult.error, 'DELETE must be rejected by the immutability trigger')
  assert.match(deleteResult.error!.message, /immutable/i)

  const stillThere = await getBlueprintSnapshot(row.id, fx.schoolId)
  assert.ok(stillThere)
  assert.equal(stillThere!.schema_version, row.schema_version, 'unchanged — the attempted update never took effect')
})

test('publishReportCards creates a report_card_publication snapshot for each published learner (real trigger site)', async () => {
  const fx = await fixtureSchool('publish')
  const enroll = await onboardLearner(fx.schoolId, {
    admission_number: `12k-publish-${Date.now()}`,
    first_name: 'Published', last_name: 'Learner',
    class_id: fx.classId, term_id: fx.termId, academic_year_id: fx.academicYearId,
    guardian: { full_name: 'Published Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  // A report card row must exist (unpublished) before publish can touch it.
  await db.from('school_report_cards').insert({
    school_id: fx.schoolId, learner_id: learnerId, term_id: fx.termId, class_id: fx.classId, is_published: false,
  })

  const { published } = await publishReportCards(fx.adminId, fx.schoolId, fx.termId, fx.classId)
  assert.equal(published, 1)

  const card = await getReportCard(learnerId, fx.termId, fx.schoolId)
  assert.ok(card?.is_published)

  const snapshots = await listBlueprintSnapshots(asLearnerId(learnerId), fx.schoolId)
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].snapshot_type, 'report_card_publication')
  assert.equal(snapshots[0].provenance.sourceRecordId, card!.id)
})

test('runAnnualPromotion creates a graduation snapshot when a learner graduates (real trigger site)', async () => {
  const fx = await fixtureSchool('graduate')
  const enroll = await onboardLearner(fx.schoolId, {
    admission_number: `12k-graduate-${Date.now()}`,
    first_name: 'Graduating', last_name: 'Learner',
    class_id: fx.classId, term_id: fx.termId, academic_year_id: fx.academicYearId,
    guardian: { full_name: 'Graduating Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  // runAnnualPromotion's processedBy is learner_promotions.processed_by,
  // which FKs to school_users(id) — the auth user id alone (fx.adminId)
  // isn't valid here, matching this table's own existing constraint.
  const adminSchoolUser = await getSchoolUser(fx.adminId, fx.schoolId)
  const { processed, errors } = await runAnnualPromotion(fx.schoolId, adminSchoolUser!.id, {
    academic_year_id: fx.academicYearId,
    decisions: [{ learner_id: learnerId, promotion_type: 'graduated' }],
  })
  assert.deepEqual(errors, [])
  assert.equal(processed, 1)

  const snapshots = await listBlueprintSnapshots(asLearnerId(learnerId), fx.schoolId)
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].snapshot_type, 'graduation')
})
