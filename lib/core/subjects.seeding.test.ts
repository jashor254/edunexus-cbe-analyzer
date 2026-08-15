// lib/core/subjects.seeding.test.ts
//
// Phase 1 self-serve onboarding, Task 6 — reproduces the Phase 0 audit's
// subject-seeding finding against the real, live catalogue before trusting
// it: seedGradeSubjectsForSchool()'s grade-range mapping (lib/core/
// subjects.ts) special-cased only 'pre_primary' and 'primary', and used
// ['G7','G8','G9'] as the catch-all for everything else — which silently
// swallowed BOTH 'junior_secondary' (correct: G7-G9) AND 'senior_secondary'
// (should be G10-G12, got G7-G9 instead). A Senior School (gradeCodes:
// ['G10','G11','G12']) that ran the one-click "set up default subjects"
// therefore got junk subjects seeded onto grades it doesn't teach, and
// G10-G12 — the grades it DOES teach — received none, so its readiness
// "Subjects" check could never turn green.
//
// Run: npx tsx --env-file=.env.local --test lib/core/subjects.seeding.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { seedGradeSubjectsForSchool } from '@/lib/core/subjects'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE1_SUBJECT_SEEDING_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

let juniorSchoolId: string   // gradeCodes G7-G9, the 'primary' school_type shape
let seniorSchoolId: string   // gradeCodes G10-G12, the 'secondary' school_type shape
let gradeIdByCode: Record<string, string> = {}

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  const adminId = data!.user.id
  createdAuthUserIds.push(adminId)

  const { data: grades } = await db.from('grades').select('id, code')
  gradeIdByCode = Object.fromEntries((grades ?? []).map(g => [g.code, g.id]))

  const junior = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-junior` }, adminId)
  juniorSchoolId = junior.id
  createdSchoolIds.push(juniorSchoolId)
  await repos.schools.addSchoolUser(juniorSchoolId, adminId, 'school_admin')
  const juniorActivation = await activateSchool(juniorSchoolId, { gradeCodes: ['G7', 'G8', 'G9'] })
  if (juniorActivation.status !== 'complete') throw new Error(`junior fixture activation failed: ${juniorActivation.error}`)

  const senior = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-senior` }, adminId)
  seniorSchoolId = senior.id
  createdSchoolIds.push(seniorSchoolId)
  await repos.schools.addSchoolUser(seniorSchoolId, adminId, 'school_admin')
  const seniorActivation = await activateSchool(seniorSchoolId, { gradeCodes: ['G10', 'G11', 'G12'] })
  if (seniorActivation.status !== 'complete') throw new Error(`senior fixture activation failed: ${seniorActivation.error}`)
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('grade_subjects').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) await db.auth.admin.deleteUser(id)
})

async function gradeSubjectCountsByGrade(schoolId: string): Promise<Record<string, number>> {
  const { data } = await db.from('grade_subjects').select('grade_id').eq('school_id', schoolId)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.grade_id] = (counts[row.grade_id] ?? 0) + 1
  return counts
}

test('Junior School (G7-G9): seeding assigns subjects to G7/G8/G9', async () => {
  await seedGradeSubjectsForSchool(juniorSchoolId)
  const counts = await gradeSubjectCountsByGrade(juniorSchoolId)
  for (const code of ['G7', 'G8', 'G9']) {
    assert.ok((counts[gradeIdByCode[code]] ?? 0) > 0, `expected ${code} to have subjects seeded`)
  }
})

// seedGradeSubjectsForSchool seeds by the GLOBAL category->grade mapping
// (every grade code that category applies to, from the shared 14-row
// `grades` catalogue), not scoped to which grades this particular school
// actually has classes for — that's a separate, pre-existing design choice
// this task doesn't redesign (Task 6's scope is the category->grade range
// mapping itself, not making seeding grade-selection-aware). So a
// junior-only school legitimately still gets senior_secondary rows
// attached to G10-G12 even though it has no G10-G12 classes — harmless
// (nothing references a grade_subjects row for a grade with no class), and
// not what this task is about. What Task 6's fix actually guarantees is
// tested directly below: each category lands on its OWN grade range and no
// other.
test('the fix: no senior_secondary subject is seeded onto G7/G8/G9 for the Junior School (previously the entire bug)', async () => {
  const { data: seniorSubjects } = await db.from('subjects').select('id').eq('category', 'senior_secondary')
  const { data: rows } = await db
    .from('grade_subjects')
    .select('subject_id, grade_id')
    .eq('school_id', juniorSchoolId)
    .in('subject_id', (seniorSubjects ?? []).map(s => s.id))
  const juniorGradeIds = new Set([gradeIdByCode['G7'], gradeIdByCode['G8'], gradeIdByCode['G9']])
  for (const row of rows ?? []) {
    assert.ok(!juniorGradeIds.has(row.grade_id), `a senior_secondary subject (${row.subject_id}) leaked onto a junior grade (${row.grade_id}) — this was the exact reported bug`)
  }
})

test('Senior School (G10-G12): seeding assigns senior_secondary subjects to G10/G11/G12 — the bug this test proves and the fix closes', async () => {
  await seedGradeSubjectsForSchool(seniorSchoolId)
  const counts = await gradeSubjectCountsByGrade(seniorSchoolId)
  for (const code of ['G10', 'G11', 'G12']) {
    assert.ok((counts[gradeIdByCode[code]] ?? 0) > 0, `expected ${code} to have subjects seeded — this is exactly what a Senior School's readiness checklist depends on`)
  }
})

test('senior_secondary subjects never land on G7/G8/G9 for a Senior School (no such grades exist there, but proves no accidental cross-level seeding)', async () => {
  const { data: seniorSubjects } = await db.from('subjects').select('id').eq('category', 'senior_secondary')
  assert.ok((seniorSubjects ?? []).length > 0, 'fixture assumption: the live catalogue has senior_secondary subjects')

  const { data: rows } = await db
    .from('grade_subjects')
    .select('subject_id, grade_id')
    .eq('school_id', seniorSchoolId)
    .in('subject_id', (seniorSubjects ?? []).map(s => s.id))

  const seniorGradeIds = new Set([gradeIdByCode['G10'], gradeIdByCode['G11'], gradeIdByCode['G12']])
  for (const row of rows ?? []) {
    assert.ok(seniorGradeIds.has(row.grade_id), `a senior_secondary subject (${row.subject_id}) was seeded onto a non-senior grade (${row.grade_id})`)
  }
})
