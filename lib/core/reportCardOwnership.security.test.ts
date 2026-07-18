// lib/core/reportCardOwnership.security.test.ts
//
// Security Hotfix SH-001 (docs/engineering/sprint-5c-service-role-authorization-audit.md,
// docs/engineering/implementation-log.md): validates the IDOR fix in
// lib/core/report-cards.ts::getReportCard/listClassReportCards against
// real, throwaway Supabase data — two separate schools, proving a
// cross-school learnerId/classId is refused even when the caller's own
// schoolId is valid.
//
// Scope note: this suite tests the ownership-scoping fix itself (same
// school vs. different school), not role-based authorization
// (teacher vs. admin) — that check (requireSchoolMembership/
// requireSchoolAdmin in app/api/core/reports/route.ts) is unchanged by
// this hotfix and already covered by prior sprints' authorization-layer
// tests. Since getReportCard/listClassReportCards don't themselves
// distinguish caller role, "same-school teacher" and "same-school admin"
// exercise the identical code path here; the meaningful axis for this fix
// is which school the resource belongs to relative to the caller's
// schoolId, tested exhaustively below.
//
// ⚠️ Creates two real (throwaway) schools, academic years, terms, classes,
// grades lookup, and learners — all deleted in `after()`, including on
// failure.
//
// Run: npx tsx --env-file=.env.local --test lib/core/reportCardOwnership.security.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { getReportCard, listClassReportCards, generateReportCards } from '@/lib/core/report-cards'

const SYNTHETIC_MARKER = 'SYNTHETIC_SH001_OWNERSHIP_TEST'
const db = createServiceClient()

type SchoolFixture = {
  schoolId: string
  authUserId: string
  academicYearId: string
  termId: string
  classId: string
  publishedLearnerId: string
  draftLearnerId: string
}

let gradeId: string
let schoolA: SchoolFixture
let schoolB: SchoolFixture

async function buildSchoolFixture(label: string): Promise<SchoolFixture> {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `sh001-${label}-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  const authUserId = auth.user.id

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-${label}` }, authUserId)
  const schoolId = school.id
  // Sprint 12B: generateReportCards now calls the Attendance service, which
  // requires an authorized actor (admin-tier or the class's own teacher) —
  // this fixture's authUserId needs a real school_admin membership for
  // that check to pass, matching how the real /api/core/reports route
  // already requires requireSchoolAdmin before ever calling
  // generateReportCards in production.
  await repos.schools.addSchoolUser(schoolId, authUserId, 'school_admin')

  const year = await repos.schools.insertAcademicYear(schoolId, {
    name: `${SYNTHETIC_MARKER}-${label}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id,
    term_number: 1,
    name: `${SYNTHETIC_MARKER}-${label}`,
    start_date: '2026-01-01',
    end_date: '2026-04-01',
  })
  const cls = await repos.teachers.insertClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: year.id,
    display_name: `${SYNTHETIC_MARKER}-${label}`,
  })

  const publishedLearner = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-${label}-pub-${Math.random().toString(36).slice(2, 8)}`,
    first_name: SYNTHETIC_MARKER,
    last_name: `${label}Published`,
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000000', relationship: 'guardian' },
  })
  const draftLearner = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-${label}-draft-${Math.random().toString(36).slice(2, 8)}`,
    first_name: SYNTHETIC_MARKER,
    last_name: `${label}Draft`,
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000000', relationship: 'guardian' },
  })

  await repos.schools.upsertReportCards([
    {
      school_id: schoolId,
      learner_id: publishedLearner.id,
      term_id: term.id,
      class_id: cls.id,
      overall_score: 85,
      overall_cbc_level: 'EE',
      position_in_class: 1,
      total_learners: 2,
      is_published: true,
      generated_at: new Date().toISOString(),
    },
    {
      school_id: schoolId,
      learner_id: draftLearner.id,
      term_id: term.id,
      class_id: cls.id,
      overall_score: 45,
      overall_cbc_level: 'AE',
      position_in_class: 2,
      total_learners: 2,
      is_published: false,
      generated_at: new Date().toISOString(),
    },
  ])

  return {
    schoolId,
    authUserId,
    academicYearId: year.id,
    termId: term.id,
    classId: cls.id,
    publishedLearnerId: publishedLearner.id,
    draftLearnerId: draftLearner.id,
  }
}

async function cleanupSchoolFixture(f: SchoolFixture) {
  await db.from('school_report_cards').delete().eq('school_id', f.schoolId)
  await db.from('classes').delete().eq('school_id', f.schoolId)
  await db.from('terms').delete().eq('school_id', f.schoolId)
  await db.from('learners').delete().eq('school_id', f.schoolId)
  await db.from('academic_years').delete().eq('school_id', f.schoolId)
  await db.from('schools').delete().eq('id', f.schoolId)
  await db.auth.admin.deleteUser(f.authUserId)
}

before(async () => {
  const grades = await repos.teachers.findGrades()
  if (!grades.length) throw new Error('no grades reference data found — cannot run this test')
  gradeId = grades[0].id

  schoolA = await buildSchoolFixture('A')
  schoolB = await buildSchoolFixture('B')
})

after(async () => {
  if (schoolA) await cleanupSchoolFixture(schoolA)
  if (schoolB) await cleanupSchoolFixture(schoolB)
})

// ── Same-school access (role-independent — see file header) ────────────────
//
// NOTE: these tests assert on the returned report's contents (not just
// `doesNotReject`). They previously only asserted non-rejection because of
// a PRE-EXISTING, UNRELATED bug (TD-014, docs/engineering/implementation-log.md):
// findReportCardWithSubjects (school.repository.ts) embedded a
// `term_subject_summaries` join with no actual foreign-key relationship
// between the two tables, which Postgres rejects (PGRST200) on every call,
// silently swallowed because the function never checked `error` — so this
// query always returned null regardless of input, independent of
// school/learner ownership. That bug has since been fixed (split into two
// queries, joined in application code — see school.repository.ts) with
// dedicated coverage in lib/core/reportCardWithSubjects.test.ts. This
// ownership check runs strictly BEFORE that query either way, so these
// tests were, and remain, provably unaffected by that bug — proven by the
// EXPLOIT BLOCKED tests below, which throw at the ownership check and never
// reach the report query at all.

test('SAME SCHOOL: getReportCard for a published report card is not blocked by the ownership check', async () => {
  const report = await getReportCard(schoolA.publishedLearnerId, schoolA.termId, schoolA.schoolId)
  assert.ok(report, 'expected a report card, got null')
  assert.equal(report!.learner_id, schoolA.publishedLearnerId)
})

test('SAME SCHOOL: getReportCard for a draft (unpublished) report card is not blocked by the ownership check — unchanged existing behaviour, this endpoint does not filter by is_published', async () => {
  const report = await getReportCard(schoolA.draftLearnerId, schoolA.termId, schoolA.schoolId)
  assert.ok(report, 'expected a report card, got null')
  assert.equal(report!.is_published, false)
})

test('SAME SCHOOL: listClassReportCards succeeds and returns both learners', async () => {
  const rows = await listClassReportCards(schoolA.classId, schoolA.termId, schoolA.schoolId)
  assert.equal(rows.length, 2)
})

// ── THE EXPLOIT: cross-school access must fail ──────────────────────────────

test('EXPLOIT BLOCKED: School B cannot read School A\'s report card via getReportCard, despite a valid schoolId', async () => {
  await assert.rejects(
    getReportCard(schoolA.publishedLearnerId, schoolA.termId, schoolB.schoolId)
  )
})

test('EXPLOIT BLOCKED: School B cannot list School A\'s class report cards, despite a valid schoolId', async () => {
  await assert.rejects(
    listClassReportCards(schoolA.classId, schoolA.termId, schoolB.schoolId)
  )
})

test('EXPLOIT BLOCKED: cross-school access fails identically for a draft report (not just published)', async () => {
  await assert.rejects(
    getReportCard(schoolA.draftLearnerId, schoolA.termId, schoolB.schoolId)
  )
})

// ── Nonexistent / malformed IDs ──────────────────────────────────────────────

test('NONEXISTENT: a well-formed but nonexistent learnerId is refused, same as cross-school', async () => {
  await assert.rejects(
    getReportCard('00000000-0000-0000-0000-000000000000', schoolA.termId, schoolA.schoolId)
  )
})

test('NONEXISTENT: a well-formed but nonexistent classId is refused, same as cross-school', async () => {
  await assert.rejects(
    listClassReportCards('00000000-0000-0000-0000-000000000000', schoolA.termId, schoolA.schoolId)
  )
})

test('INVALID UUID: a malformed learnerId is refused, not a crash', async () => {
  await assert.rejects(
    getReportCard('not-a-valid-uuid', schoolA.termId, schoolA.schoolId)
  )
})

test('INVALID UUID: a malformed classId is refused, not a crash', async () => {
  await assert.rejects(
    listClassReportCards('not-a-valid-uuid', schoolA.termId, schoolA.schoolId)
  )
})

// ── Parent-facing caller path (schoolId omitted) still works unchanged ─────

test('PARENT PATH UNCHANGED: getReportCard without a schoolId (as app/api/reports/report-card/route.ts calls it) still skips the ownership check without erroring', async () => {
  await assert.doesNotReject(getReportCard(schoolA.publishedLearnerId, schoolA.termId))
})

// ── No regression to report generation (untouched by this hotfix) ─────────

test('NO REGRESSION: generateReportCards still succeeds normally for an all-draft class', async () => {
  // A fresh class/term with no report cards yet, same school.
  const year = await repos.schools.insertAcademicYear(schoolA.schoolId, {
    name: `${SYNTHETIC_MARKER}-A-regen`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(schoolA.schoolId, {
    academic_year_id: year.id,
    term_number: 1,
    name: `${SYNTHETIC_MARKER}-A-regen`,
    start_date: '2026-01-01',
    end_date: '2026-04-01',
  })
  const cls = await repos.teachers.insertClass(schoolA.schoolId, {
    grade_id: gradeId,
    academic_year_id: year.id,
    display_name: `${SYNTHETIC_MARKER}-A-regen`,
  })

  await assert.doesNotReject(generateReportCards(schoolA.authUserId, schoolA.schoolId, cls.id, term.id, {}))

  await db.from('classes').delete().eq('id', cls.id)
  await db.from('terms').delete().eq('id', term.id)
  await db.from('academic_years').delete().eq('id', year.id)
})
