// lib/curriculum/seniorProgramme.integration.test.ts
//
// Real-DB integration tests against DISPOSABLE LOCAL DOCKER SUPABASE ONLY.
//
// lib/curriculum/seniorProgramme.ts calls createServiceClient() from
// utils/supabase/service.ts directly (per CLAUDE.md's server-side-DB rule),
// NOT createTestServiceClient() from utils/supabase/test-service.ts — so
// this file follows the same convention as
// lib/core/learnerIdentityConvergence.integration.test.ts: point
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at local Docker
// directly (NOT .env.local, which is production). The Phase 2C Step 0 guard
// inside createServiceClient() refuses to construct a client under
// `node --test` (NODE_TEST_CONTEXT) if the URL resolves to the known
// production project, so a mistaken .env.local load fails loudly rather
// than mutating production. The explicit check below is a second,
// independent guard that does not depend on that one.
//
// Run (example, local Supabase CLI default ports):
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   npx tsx --experimental-test-module-mocks --test lib/curriculum/seniorProgramme.integration.test.ts
//
// Proves the Phase 1 Senior School Programme Truth foundation: canonical
// learner_programmes/learner_programme_subjects, keyed to learners.id, never
// derived from learner_evidence, and the mandatory
// "Social Sciences + Core Mathematics" representability invariant that
// disproves "pathway mechanically decides Mathematics variant."

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { extractProjectRef, KNOWN_PRODUCTION_PROJECT_REF } from '@/utils/supabase/productionRef'
import { asLearnerId } from '@/lib/core/identityTypes'
import { getCurrentSeniorProgramme, createOrUpdateSeniorProgramme } from '@/lib/curriculum/seniorProgramme'

// Hard local-only assertion, independent of the guard inside
// createServiceClient() — this file must never even ATTEMPT to run against
// production, regardless of guard behavior.
const resolvedRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
if (resolvedRef === KNOWN_PRODUCTION_PROJECT_REF) {
  throw new Error('seniorProgramme.integration.test.ts: refusing to run against the known production project.')
}

const db = createServiceClient()
const SYNTHETIC_MARKER = 'SYNTHETIC_SENIOR_PROGRAMME_TEST'

const schoolIds: string[] = []
const learnerIds: string[] = []
const policyVersionIds: string[] = []
const extraSubjectIds: string[] = []

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  // learner_programmes cascades to learner_programme_subjects; learners cascades to learner_programmes.
  if (learnerIds.length) await safely(() => db.from('learners').delete().in('id', learnerIds))
  if (policyVersionIds.length) await safely(() => db.from('curriculum_policy_versions').delete().in('id', policyVersionIds))
  if (extraSubjectIds.length) await safely(() => db.from('subjects').delete().in('id', extraSubjectIds))
  if (schoolIds.length) await safely(() => db.from('schools').delete().in('id', schoolIds))
})

async function makeSchool(): Promise<string> {
  const { data, error } = await db.from('schools').insert({ school_name: `${SYNTHETIC_MARKER}-school-${Date.now()}-${Math.random()}` }).select('id').single()
  if (error) throw error
  schoolIds.push(data.id)
  return data.id
}

async function makeAcademicYear(schoolId: string): Promise<string> {
  const { data, error } = await db
    .from('academic_years')
    .insert({ school_id: schoolId, name: '2026', start_date: '2026-01-01', end_date: '2026-11-30', is_current: true })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function makeLearner(schoolId: string): Promise<string> {
  const { data, error } = await db
    .from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-${Date.now()}-${Math.random()}`, first_name: 'Test', last_name: 'Learner' })
    .select('id')
    .single()
  if (error) throw error
  learnerIds.push(data.id)
  return data.id
}

async function subjectIdByCode(code: string): Promise<string> {
  const { data, error } = await db.from('subjects').select('id').eq('code', code).single()
  if (error || !data) throw new Error(`fixture subject ${code} not found: ${error?.message}`)
  return data.id
}

test('a learner with no programme resolves to unresolved, never a fabricated default', async () => {
  const schoolId = await makeSchool()
  const learnerId = await makeLearner(schoolId)

  const result = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(result.status, 'unresolved')
})

test('programme keys to canonical learners.id and requires no legacy students row', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const csl = await subjectIdByCode('SS-CSL')
  const english = await subjectIdByCode('SS-ENG')

  // Deliberately no `students` row is created for this learner anywhere in
  // this test — programme existence must not depend on Evidence
  // infrastructure or the legacy bridge.
  const programme = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    source: 'admin_entry',
    subjects: [
      { subjectId: csl, role: 'compulsory' },
      { subjectId: english, role: 'compulsory' },
    ],
  })

  assert.equal(programme.learnerId, learnerId)

  const result = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(result.status, 'resolved')
  if (result.status !== 'resolved') return
  assert.equal(result.programme.id, programme.id)
})

test('CSL membership with zero evidence is a valid, meaningful state (not absence)', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const csl = await subjectIdByCode('SS-CSL')

  await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    source: 'admin_entry',
    subjects: [{ subjectId: csl, role: 'compulsory', reason: 'policy_compulsory' }],
  })

  const result = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(result.status, 'resolved')
  if (result.status !== 'resolved') return
  const cslMembership = result.subjects.find(s => s.subjectCode === 'SS-CSL')
  assert.ok(cslMembership, 'CSL must appear as a current programme subject even with zero learner_evidence rows')
  assert.equal(cslMembership?.role, 'compulsory')
})

test('mandatory regression: Social Sciences + Core Mathematics is structurally representable (pathway does not mechanically decide Mathematics variant)', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const coreMath = await subjectIdByCode('SS-MATH-CORE')

  const programme = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    pathway: 'Social Sciences',
    source: 'admin_entry',
    subjects: [{ subjectId: coreMath, role: 'exception', reason: 'approved_exception' }],
  })

  assert.equal(programme.pathway, 'Social Sciences')

  const result = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(result.status, 'resolved')
  if (result.status !== 'resolved') return
  const mathMembership = result.subjects.find(s => s.subjectCode === 'SS-MATH-CORE')
  assert.ok(mathMembership, 'Core Mathematics must be representable alongside a Social Sciences pathway — no schema violation')
  assert.equal(result.programme.pathway, 'Social Sciences')
})

test('duplicate canonical subject membership within one write is rejected', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const english = await subjectIdByCode('SS-ENG')

  await assert.rejects(
    () => createOrUpdateSeniorProgramme({
      learnerId: asLearnerId(learnerId),
      schoolId,
      academicYearId,
      source: 'admin_entry',
      subjects: [
        { subjectId: english, role: 'compulsory' },
        { subjectId: english, role: 'elective' },
      ],
    }),
    /duplicate subjectId/
  )
})

test('cross-school programme write is rejected — a learner cannot be attached to another school\'s academic year', async () => {
  const schoolA = await makeSchool()
  const schoolB = await makeSchool()
  const academicYearB = await makeAcademicYear(schoolB)
  const learnerA = await makeLearner(schoolA)
  const english = await subjectIdByCode('SS-ENG')

  await assert.rejects(
    () => createOrUpdateSeniorProgramme({
      learnerId: asLearnerId(learnerA),
      schoolId: schoolA,
      academicYearId: academicYearB, // belongs to school B, not school A
      source: 'admin_entry',
      subjects: [{ subjectId: english, role: 'compulsory' }],
    })
  )
})

test('a programme change preserves history — the old programme is superseded, not overwritten, and stays queryable', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const essential = await subjectIdByCode('SS-MATH-ESS')
  const core = await subjectIdByCode('SS-MATH-CORE')

  const first = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    pathway: 'Social Sciences',
    source: 'admin_entry',
    subjects: [{ subjectId: essential, role: 'compulsory' }],
  })

  const second = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    pathway: 'STEM',
    source: 'admin_entry',
    subjects: [{ subjectId: core, role: 'compulsory' }],
  })

  assert.notEqual(first.id, second.id)

  // Only one CURRENT programme — the new one.
  const current = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(current.status, 'resolved')
  if (current.status !== 'resolved') return
  assert.equal(current.programme.id, second.id)
  assert.equal(current.programme.pathway, 'STEM')

  // The old row is not deleted; it is superseded and re-linked.
  const { data: oldRow, error } = await db
    .from('learner_programmes')
    .select('id, superseded_at, superseded_by_programme_id, pathway')
    .eq('id', first.id)
    .single()
  assert.equal(error, null)
  assert.ok(oldRow?.superseded_at, 'old programme must be marked superseded, not deleted')
  assert.equal(oldRow?.superseded_by_programme_id, second.id)
  assert.equal(oldRow?.pathway, 'Social Sciences', 'old programme content must remain historically intact, never rewritten')
})

test('Version A and Version B curriculum policy coexist; a programme governed by A is unaffected by B existing', async () => {
  const { data: curriculumVersion, error: cvError } = await db.from('curriculum_versions').select('id').eq('code', 'ke-cbc-2017').single()
  assert.equal(cvError, null)

  const { data: versionA, error: aError } = await db
    .from('curriculum_policy_versions')
    .insert({
      curriculum_version_id: curriculumVersion!.id,
      code: `${SYNTHETIC_MARKER}-version-a-${Date.now()}`,
      label: 'Synthetic Version A',
      education_level: 'senior_secondary',
      status: 'draft',
      policy_notes: 'compulsory count = 4 (synthetic fixture)',
    })
    .select('id')
    .single()
  assert.equal(aError, null)
  policyVersionIds.push(versionA!.id)

  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const english = await subjectIdByCode('SS-ENG')

  const programme = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    curriculumPolicyVersionId: versionA!.id,
    source: 'admin_entry',
    subjects: [{ subjectId: english, role: 'compulsory' }],
  })
  assert.equal(programme.curriculumPolicyVersionId, versionA!.id)

  // Version B now comes into existence — a different compulsory rule
  // (synthetic, never marked active) — and must not touch Version A or any
  // programme governed by it.
  const { data: versionB, error: bError } = await db
    .from('curriculum_policy_versions')
    .insert({
      curriculum_version_id: curriculumVersion!.id,
      code: `${SYNTHETIC_MARKER}-version-b-${Date.now()}`,
      label: 'Synthetic Version B',
      education_level: 'senior_secondary',
      status: 'draft',
      policy_notes: 'compulsory count = 5 (synthetic fixture, deliberately different from A)',
    })
    .select('id')
    .single()
  assert.equal(bError, null)
  policyVersionIds.push(versionB!.id)

  const { data: versionARow, error: reReadError } = await db
    .from('curriculum_policy_versions')
    .select('id, policy_notes, status')
    .eq('id', versionA!.id)
    .single()
  assert.equal(reReadError, null)
  assert.equal(versionARow?.policy_notes, 'compulsory count = 4 (synthetic fixture)', 'Version A must not be reinterpreted by Version B existing')

  const stillCurrent = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(stillCurrent.status, 'resolved')
  if (stillCurrent.status !== 'resolved') return
  assert.equal(stillCurrent.programme.curriculumPolicyVersionId, versionA!.id, 'the programme must remain governed by Version A, not silently reinterpreted under B')
})

test('draft/unverified policy cannot enforce anything — creating a programme succeeds with no active policy at all', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const bio = await subjectIdByCode('SS-BIO')

  // No curriculumPolicyVersionId at all — this must succeed. Structural
  // validation only; the seeded 'ke-cbc-senior-2026-draft' policy stays
  // status='draft' and is never consulted for rejection.
  const programme = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    source: 'admin_entry',
    subjects: [{ subjectId: bio, role: 'elective' }],
  })
  assert.equal(programme.curriculumPolicyVersionId, null)
})

test('transaction atomicity: a failed replacement (invalid subject mid-write) leaves the prior current programme intact — not superseded, not partially replaced', async () => {
  const schoolId = await makeSchool()
  const academicYearId = await makeAcademicYear(schoolId)
  const learnerId = await makeLearner(schoolId)
  const english = await subjectIdByCode('SS-ENG')

  const programmeA = await createOrUpdateSeniorProgramme({
    learnerId: asLearnerId(learnerId),
    schoolId,
    academicYearId,
    pathway: 'STEM',
    source: 'admin_entry',
    subjects: [{ subjectId: english, role: 'compulsory' }],
  })

  const NONEXISTENT_SUBJECT_ID = '00000000-0000-0000-0000-000000000000'

  // This call bypasses the TS-level duplicate/empty checks in
  // createOrUpdateSeniorProgramme and calls the RPC directly, so the
  // failure happens *inside* the SQL function's subject-insert loop (after
  // it has already closed Programme A and inserted Programme B) — the exact
  // failure point the RPC's single-transaction design must protect against.
  const { error } = await db.rpc('create_or_update_senior_programme', {
    p_learner_id: learnerId,
    p_school_id: schoolId,
    p_academic_year_id: academicYearId,
    p_curriculum_policy_version_id: null,
    p_pathway: 'Social Sciences',
    p_track: null,
    p_combination_code: null,
    p_source: 'admin_entry',
    p_created_by: null,
    p_subject_memberships: [{ subject_id: NONEXISTENT_SUBJECT_ID, role: 'compulsory', reason: null }],
  })

  assert.ok(error, 'the RPC call must fail (FK violation on the nonexistent subject_id)')

  // Programme A must be untouched: still current, never marked superseded.
  const { data: programmeARow, error: readError } = await db
    .from('learner_programmes')
    .select('id, superseded_at, superseded_by_programme_id, pathway')
    .eq('id', programmeA.id)
    .single()
  assert.equal(readError, null)
  assert.equal(programmeARow?.superseded_at, null, 'Programme A must remain current after the failed replacement — the close-old step must have rolled back with everything else')
  assert.equal(programmeARow?.superseded_by_programme_id, null)
  assert.equal(programmeARow?.pathway, 'STEM')

  // No partial Programme B may exist at all.
  const { data: allProgrammes, error: listError } = await db
    .from('learner_programmes')
    .select('id')
    .eq('learner_id', learnerId)
  assert.equal(listError, null)
  assert.equal(allProgrammes?.length, 1, 'exactly one programme (A) must exist — no partially-created Programme B row')

  const current = await getCurrentSeniorProgramme(asLearnerId(learnerId))
  assert.equal(current.status, 'resolved')
  if (current.status !== 'resolved') return
  assert.equal(current.programme.id, programmeA.id, 'the current programme must still be A')
})
