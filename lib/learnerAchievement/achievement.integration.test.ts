// lib/learnerAchievement/achievement.integration.test.ts
//
// Sprint 12W — proves, against real synthetic Supabase data, the full
// Learner Achievement lifecycle (Draft -> Verified -> Published ->
// Archived, Rejected reachable from Draft, Revoked reachable from
// Published) and that the DB trigger — not just this service's own
// checks — is the final backstop against editing a terminal-state or
// published row. Also proves the mandatory Evidence-requirement rule,
// versioning + verification history, Blueprint composition, cross-school
// isolation, and permission checks.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerAchievement/achievement.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import {
  createAchievement, updateDraft, verifyAchievement, rejectAchievement, publishAchievement,
  revokeAchievement, archiveAchievement, listForLearner, listPublished, getAchievementSummary,
  getVerificationHistory,
} from './achievement'
import { composeAchievement } from '@/lib/learnerBlueprint/composeAchievement'

const SYNTHETIC_MARKER = 'SYNTHETIC_12W_ACHIEVEMENT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12w-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id) // cascades learner_achievements/media/tags/history
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
    admission_number: `12w-${labelPrefix}-${Date.now()}`,
    first_name: 'Achievement', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Achievement Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
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
  achievementType: 'competition' as const,
  category: 'academic' as const,
  title: 'National Mathematics Olympiad — Regional Finalist',
  description: 'Placed among the top 10 in the regional round.',
  supportingEvidenceIds: [],
  verifyingDocumentReference: 'certificate-scan-ref-001',
  awardingOrganization: 'Kenya Mathematics Olympiad Board',
  awardDate: '2026-05-01',
  expiresAt: null,
}

test('full lifecycle: draft -> verify -> publish -> archive, immutability at every stage, versioning + history', async () => {
  const fx = await fixtureSchoolWithTeacher('lifecycle')
  const client = await signInAs(fx.teacherEmail)

  assert.deepEqual(await listForLearner(client, fx.schoolId, fx.learnerId), [])
  assert.deepEqual(await listPublished(fx.learnerId, fx.schoolId), [])

  const draft = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  assert.equal(draft.status, 'draft')
  assert.equal(draft.version, 1)

  // Business rules: cannot publish/revoke/archive out of order.
  await assert.rejects(() => publishAchievement(client, fx.schoolId, draft.id), /has not been verified/)
  await assert.rejects(() => revokeAchievement(client, fx.schoolId, draft.id, 'x'), /Only a published achievement/)
  await assert.rejects(() => archiveAchievement(client, fx.schoolId, draft.id), /Only a published achievement/)

  const edited = await updateDraft(client, fx.schoolId, draft.id, { title: 'National Mathematics Olympiad — Regional Finalist (2026)' })
  assert.equal(edited.title, 'National Mathematics Olympiad — Regional Finalist (2026)')
  assert.equal(edited.description, FIELDS.description, 'unedited fields survive a partial update untouched')

  const verified = await verifyAchievement(client, fx.schoolId, draft.id)
  assert.equal(verified.status, 'verified')
  assert.equal(verified.version, 2)
  assert.ok(verified.verifiedBy)
  assert.ok(verified.verifiedAt)

  const published = await publishAchievement(client, fx.schoolId, draft.id)
  assert.equal(published.status, 'published')
  assert.equal(published.version, 3)
  assert.ok(published.publishedAt)

  // Now listPublished/summary see it, and Blueprint composes it.
  const pub = await listPublished(fx.learnerId, fx.schoolId)
  assert.equal(pub.length, 1)
  assert.equal(pub[0].id, draft.id)

  const summary = await getAchievementSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.available, true)
  assert.equal(summary.achievementCount, 1)
  assert.equal(summary.latestVerifiedAchievement!.title, 'National Mathematics Olympiad — Regional Finalist (2026)')

  // Version history: draft->verified->published, in order.
  const history = await getVerificationHistory(client, fx.schoolId, draft.id)
  assert.deepEqual(history.map(h => `${h.fromStatus}->${h.toStatus}`), ['draft->verified', 'verified->published'])
  assert.deepEqual(history.map(h => h.version), [2, 3])

  // Service-layer immutability.
  await assert.rejects(
    () => updateDraft(client, fx.schoolId, draft.id, { title: 'trying to edit a published achievement' }),
    /no longer a draft/
  )

  // DB-level immutability: the final backstop, even bypassing the service entirely.
  const rawUpdate = await db.from('learner_achievements').update({ title: 'tampered' }).eq('id', draft.id)
  assert.ok(rawUpdate.error, 'UPDATE (non archive/revoke field) on a published row must be rejected by the immutability trigger')
  assert.match(rawUpdate.error!.message, /immutable/i)

  const rawDelete = await db.from('learner_achievements').delete().eq('id', draft.id)
  assert.ok(rawDelete.error, 'DELETE on a published row must be rejected by the immutability trigger')
  assert.match(rawDelete.error!.message, /can never be deleted/i)

  // Archive is one of the two legal transitions on a published row.
  const archived = await archiveAchievement(client, fx.schoolId, draft.id)
  assert.equal(archived.status, 'archived')
  assert.equal(archived.version, 4)

  // Archived is fully terminal.
  const rawUpdateArchived = await db.from('learner_achievements').update({ title: 'tampered again' }).eq('id', draft.id)
  assert.ok(rawUpdateArchived.error, 'UPDATE on an archived row must be rejected')
  await assert.rejects(() => archiveAchievement(client, fx.schoolId, draft.id), /Only a published achievement/)

  // Verification history rows are themselves append-only.
  const anyHistoryRow = (await getVerificationHistory(client, fx.schoolId, draft.id))[0]
  const rawHistoryUpdate = await db.from('achievement_verification_history').update({ reason: 'tampered' })
    .eq('achievement_id', draft.id).eq('version', anyHistoryRow.version)
  assert.ok(rawHistoryUpdate.error, 'UPDATE on a verification_history row must be rejected — append-only')
})

test('the central Phase 5 rule: cannot verify without Evidence or a verifying document reference', async () => {
  const fx = await fixtureSchoolWithTeacher('evidence')
  const client = await signInAs(fx.teacherEmail)

  const noEvidence = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, supportingEvidenceIds: [], verifyingDocumentReference: null,
  })
  await assert.rejects(() => verifyAchievement(client, fx.schoolId, noEvidence.id), /no supporting Evidence reference/)

  // A verifying document reference alone is sufficient (external certificate case, Phase 5).
  const withDocRef = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, supportingEvidenceIds: [], verifyingDocumentReference: 'external-cert-ref',
  })
  const verified = await verifyAchievement(client, fx.schoolId, withDocRef.id)
  assert.equal(verified.status, 'verified')
})

test('verification workflow: reject is a distinct terminal state from revoke, and revocation prevents further external visibility', async () => {
  const fx = await fixtureSchoolWithTeacher('reject-revoke')
  const client = await signInAs(fx.teacherEmail)

  const rejectedDraft = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await assert.rejects(() => rejectAchievement(client, fx.schoolId, rejectedDraft.id, ''), /rejection reason is required/)
  const rejected = await rejectAchievement(client, fx.schoolId, rejectedDraft.id, 'Certificate could not be verified with the issuing body.')
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.rejectedReason, 'Certificate could not be verified with the issuing body.')
  // Terminal: cannot verify/reject again.
  await assert.rejects(() => verifyAchievement(client, fx.schoolId, rejectedDraft.id), /Only a draft achievement/)
  const rawUpdate = await db.from('learner_achievements').update({ title: 'x' }).eq('id', rejectedDraft.id)
  assert.ok(rawUpdate.error, 'a rejected row is permanently immutable')

  const revokedItem = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, FIELDS)
  await verifyAchievement(client, fx.schoolId, revokedItem.id)
  await publishAchievement(client, fx.schoolId, revokedItem.id)
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 1)

  const revoked = await revokeAchievement(client, fx.schoolId, revokedItem.id, 'Later found to be fabricated.')
  assert.equal(revoked.status, 'revoked')
  // A revoked achievement is never shown in the published surface again, even though it once was.
  assert.equal((await listPublished(fx.learnerId, fx.schoolId)).length, 0)
  const summary = await getAchievementSummary(fx.learnerId, fx.schoolId)
  assert.equal(summary.achievementCount, 0)
})

test('canonical type/category enforcement: rejects non-canonical achievement_type/category, and rejects Portfolio-owned raw-artefact vocabulary', async () => {
  const fx = await fixtureSchoolWithTeacher('canon')
  const client = await signInAs(fx.teacherEmail)

  await assert.rejects(
    // @ts-expect-error deliberately invalid type for the test
    () => createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, achievementType: 'projects' }),
    /not a canonical achievement type/
  )
  await assert.rejects(
    // @ts-expect-error deliberately invalid category for the test
    () => createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, { ...FIELDS, category: 'writing' }),
    /not a canonical achievement category/
  )
})

test('Blueprint composition: unavailable for zero achievements, available with count/latest/highest-level once published', async () => {
  const fx = await fixtureSchoolWithTeacher('blueprint')
  const client = await signInAs(fx.teacherEmail)

  const empty = await composeAchievement(fx.learnerId, fx.schoolId)
  assert.equal(empty.status, 'unavailable')
  assert.equal(empty.data, null)

  // A "sports" achievement (lower-ranked) published first...
  const sports = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, category: 'sports', title: 'Regional Athletics — 2nd Place', verifyingDocumentReference: 'ref-1',
  })
  await verifyAchievement(client, fx.schoolId, sports.id)
  await publishAchievement(client, fx.schoolId, sports.id)

  // ...then an "academic" achievement (higher-ranked) published second.
  const academic = await createAchievement(client, fx.schoolId, fx.learnerId, fx.teacherUserId, {
    ...FIELDS, category: 'academic', title: 'Mathematics Olympiad Finalist', verifyingDocumentReference: 'ref-2',
  })
  await verifyAchievement(client, fx.schoolId, academic.id)
  await publishAchievement(client, fx.schoolId, academic.id)

  const available = await composeAchievement(fx.learnerId, fx.schoolId)
  assert.equal(available.status, 'available')
  assert.equal(available.data!.achievementCount, 2)
  assert.equal(available.data!.latestVerifiedAchievement!.title, 'Mathematics Olympiad Finalist', 'most recently published')
  assert.equal(available.data!.highestLevelAchievement!.title, 'Mathematics Olympiad Finalist', 'academic outranks sports')
  // Blueprint's field budget: never a raw evidence/description field leaked through.
  assert.deepEqual(Object.keys(available.data!).sort(), ['achievementCount', 'highestLevelAchievement', 'latestVerifiedAchievement', 'profileUrl'])
})

test('cross-school isolation: a teacher at School A cannot read or act on School B\'s achievements', async () => {
  const fxA = await fixtureSchoolWithTeacher('isoA')
  const fxB = await fixtureSchoolWithTeacher('isoB')
  const clientA = await signInAs(fxA.teacherEmail)
  const clientB = await signInAs(fxB.teacherEmail)

  const itemB = await createAchievement(clientB, fxB.schoolId, fxB.learnerId, fxB.teacherUserId, FIELDS)

  await assert.rejects(() => updateDraft(clientA, fxA.schoolId, itemB.id, { title: 'hijacked' }), /not found/)
  await assert.rejects(() => verifyAchievement(clientA, fxA.schoolId, itemB.id), /not found/)
  await assert.rejects(() => verifyAchievement(clientA, fxB.schoolId, itemB.id), /require|membership/i)
})

test('permission checks: an unauthenticated/non-member client cannot create or read achievements', async () => {
  const fx = await fixtureSchoolWithTeacher('perm')
  const outsider = await mkAuthUser('perm-outsider')
  const outsiderClient = await signInAs(outsider.email)

  await assert.rejects(
    () => createAchievement(outsiderClient, fx.schoolId, fx.learnerId, outsider.id, FIELDS),
    /require|membership/i
  )
})
