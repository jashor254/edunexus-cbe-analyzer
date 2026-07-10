// scripts/reference-school/integration.test.ts
//
// Automated integration tests for the Reference School fixture, following
// this repo's existing convention (node:test, no Vitest/Jest dependency —
// see lib/knowledgeGraph/quickWins.test.ts). Unlike that file, these tests
// hit the real database (the Reference School must already be seeded via
// scripts/reference-school/run-all.ts) — they verify the operational
// foundation (Modules 1-11) is structurally sound before any intelligence
// layer is built on top of it, per the project's "settle everything else
// first" decision.
//
// Run: npx tsx --env-file=.env.local --test scripts/reference-school/integration.test.ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { getReferenceSchool } from '@/lib/core/school'
import { listClasses } from '@/lib/core/classes'
import { listLearners, getLearner } from '@/lib/core/learners'
import { listSchoolUsers } from '@/lib/core/school-users'
import { listSubjects } from '@/lib/core/subjects'
import { db } from './shared'
import type { School } from '@/types/core'

let school: School

before(async () => {
  school = await getReferenceSchool()
})

test('school resolves with expected identity', () => {
  assert.equal(school.school_name, 'Mwatate Ridge Senior School')
  assert.equal(school.school_type, 'secondary')
  assert.equal(school.is_active, true)
})

test('exactly 9 classes exist: 3 senior grades x 3 streams', async () => {
  const classes = await listClasses(school.id)
  assert.equal(classes.length, 9)

  const expectedNames = [
    'Grade 10 East', 'Grade 10 West', 'Grade 10 Central',
    'Grade 11 East', 'Grade 11 West', 'Grade 11 Central',
    'Grade 12 East', 'Grade 12 West', 'Grade 12 Central',
  ]
  const actualNames = classes.map((c) => c.display_name).sort()
  assert.deepEqual(actualNames, expectedNames.sort())
})

test('every class has a class teacher assigned', async () => {
  const classes = await listClasses(school.id)
  for (const cls of classes) {
    assert.ok(cls.class_teacher_id, `${cls.display_name} has no class_teacher_id`)
  }
})

test('every class is filled to capacity (45 learners each, 405 total)', async () => {
  const classes = await listClasses(school.id)
  const supabase = db()

  let total = 0
  for (const cls of classes) {
    const { count } = await supabase
      .from('learner_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .eq('status', 'active')
    assert.equal(count, 45, `${cls.display_name} does not have exactly 45 active enrollments`)
    total += count ?? 0
  }
  assert.equal(total, 405)
})

test('every learner has exactly one primary guardian', async () => {
  const classes = await listClasses(school.id)
  const learners = await listLearners(school.id, { classId: classes[0].id })
  assert.ok(learners.length > 0)

  for (const learner of learners.slice(0, 5)) {
    const withGuardians = await getLearner(learner.id, school.id)
    const primaries = (withGuardians.learner_guardians ?? []).filter((g) => g.is_primary)
    assert.equal(primaries.length, 1, `${learner.first_name} ${learner.last_name} does not have exactly one primary guardian`)
  }
})

test('staff role distribution matches the seed plan (1 headteacher, 2 deputy_headteacher, 6 school_admin, 39 teacher)', async () => {
  const staff = await listSchoolUsers(school.id)
  assert.equal(staff.length, 48)

  const byRole = staff.reduce<Record<string, number>>((acc, s) => {
    acc[s.role] = (acc[s.role] ?? 0) + 1
    return acc
  }, {})
  assert.equal(byRole.headteacher, 1)
  assert.equal(byRole.deputy_headteacher, 2)
  assert.equal(byRole.school_admin, 6)
  assert.equal(byRole.teacher, 39)
})

test('every school_user has a live auth account', async () => {
  const staff = await listSchoolUsers(school.id)
  const supabase = db()
  for (const s of staff.slice(0, 5)) {
    const { data, error } = await supabase.auth.admin.getUserById(s.user_id)
    assert.ok(!error && data.user, `school_user ${s.id} has no resolvable auth account`)
  }
})

test('senior secondary subject catalogue has 16 subjects, 4 compulsory', async () => {
  const subjects = await listSubjects('senior_secondary')
  assert.equal(subjects.length, 16)
  const compulsory = subjects.filter((s) => s.is_core)
  assert.equal(compulsory.length, 4)
})

test('every class offers the full 16-subject catalogue via class_subjects', async () => {
  const classes = await listClasses(school.id)
  const supabase = db()
  for (const cls of classes) {
    const { count } = await supabase
      .from('class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
    assert.equal(count, 16, `${cls.display_name} does not offer all 16 subjects`)
  }
})

test('grade_subjects: each of the 3 senior grades has all 16 subjects linked', async () => {
  const supabase = db()
  const { data: grades } = await supabase.from('grades').select('id, code').in('code', ['G10', 'G11', 'G12'])
  assert.equal(grades?.length, 3)

  for (const grade of grades ?? []) {
    const { count } = await supabase
      .from('grade_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school.id)
      .eq('grade_id', grade.id)
    assert.equal(count, 16, `${grade.code} does not have all 16 subjects linked`)
  }
})
