// scripts/reference-school/06-seed-legacy-bridge.ts
//
// ⚠️  TEMPORARY INFRASTRUCTURE. This bridge exists ONLY to unblock a
// pilot-readiness UX walkthrough while the legacy teacher-facing schema
// (teachers/teacher_classes/students/class_assessments/learner_marks/
// learner_profiles/strand_assessments/...) is migrated onto the newer Core
// schema (schools/learners/school_users/classes/...). Almost the entire
// teacher-facing product UI (dashboard, marks import, attention feed,
// Learner Blueprint, Career Intelligence) still reads legacy tables that the
// Core reference-school seed (01–05) never touches — this script writes
// placeholder legacy rows that reuse the SAME identities already created in
// Core (same auth accounts, same names), rather than inventing a second
// parallel data set. Production code must NEVER depend on this bridge or
// its markers — it is seed-only, disposable, and reversible via
// cleanup-legacy-bridge.ts. See docs/architecture/migration-ledger.md.
//
// Traceability (explicit markers only — cleanup keys off these):
//   - teachers.school = SCHOOL_NAME                        (primary marker)
//   - every bridged row's `external_id` column (where present) stores the
//     originating Core row's id — teacher_classes.external_id = Core class
//     id, students.external_id = Core learner id.
//   - the throwaway per-class `assessments` parent row (career/pathway
//     table, distinct from `class_assessments`) is tagged via
//     raw_marks.note = '<BRIDGE_MARKER>:<legacy class id>'.
//
// Identity spine: Core `learners.id` is the sole canonical identity. Every
// legacy `students` row traces back via `external_id` to exactly one Core
// learner — 1:1, never generated independently.
//
// Determinism: any sampled/random data (career-interest subset, alert
// subset, topical-check ratings, marks, capability scores) is derived from
// `keyedInt`/`keyedPick`/`keyedUnit` in shared.ts — a hash of a stable
// entity key (learner id, student id, topic node id), NOT Math.random() and
// NOT a shared mutable RNG stream. A shared stream (`createSeededRng`) was
// tried first and reverted: this script is idempotent and conditionally
// skips rows that already exist, which shifts a shared stream's position
// differently across runs and silently breaks determinism. Key-based
// sampling has no stream position to shift — same key always yields the
// same value, regardless of what else ran before it or on what machine.
//
// KNOWN PRE-EXISTING BUG (confirmed, NOT fixed here — out of scope for a
// seed script): the Principal Dashboard's `findVerifiedTeachers()` in
// lib/repositories/school.repository.ts queries `teachers.school_name` /
// `teachers.subjects`, columns that don't exist on `teachers` (only
// `school` and `subject` do). `/api/school/intelligence` will keep failing
// regardless of how well this bridge is seeded.
//
// Run: npx tsx scripts/reference-school/06-seed-legacy-bridge.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, SCHOOL_NAME, AUTH_EMAIL_DOMAIN, keyedInt, keyedPick, keyedUnit } from './shared'
import { AssessmentRepository } from '@/lib/repositories/assessment.repository'
import { LearnerModelRepository } from '@/lib/repositories/learner-model.repository'
import { CareerRepository } from '@/lib/repositories/career.repository'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import { resolveOrCreateAssessmentType } from '@/lib/assessments/mutations'
import type { CapabilityProfile, CapabilityScore, CapabilityLevel, CapabilityTrendDirection } from '@/lib/career/types'

const assessmentRepo = new AssessmentRepository()
const learnerModelRepo = new LearnerModelRepository()
const careerRepo = new CareerRepository()

export const BRIDGE_MARKER = 'reference_school_bridge'
const SEED = 20260708 // fixed — do not change; determinism depends on it
const TERM = 2
const YEAR = 2026
const KISWAHILI_SUBJECT = 'kiswahili_lugha'
const MATH_SUBJECT = 'mathematics'
const MATH_GRADES = [10, 11] // node_assessment_map has no grade-12 mathematics coverage

type CoreClass = {
  id: string
  display_name: string
  grade_id: string
  class_teacher_id: string | null
  stream_id: string | null
}
type CoreGrade = { id: string; code: string; name: string }
type CoreSchoolUser = { id: string; user_id: string; role: string }
type CoreLearner = { id: string; first_name: string; last_name: string; admission_number: string }
type CoreEnrollment = { learner_id: string; class_id: string }
type CoreGuardian = {
  learner_id: string
  full_name: string
  phone: string
  email: string | null
  is_primary: boolean
}
type TopicRow = { subject: string; strand: string; topic: string; node_id: string }

async function getCoreContext() {
  const supabase = db()

  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id')
    .eq('school_name', SCHOOL_NAME)
    .maybeSingle()
  if (schoolErr) throw schoolErr
  if (!school) throw new Error(`Core reference school not found — run scripts/reference-school/run-all.ts first`)
  const schoolId = school.id as string

  const { data: grades, error: gradeErr } = await supabase
    .from('grades')
    .select('id, code, name')
    .in('code', ['G10', 'G11', 'G12'])
  if (gradeErr) throw gradeErr
  const gradesByCode = new Map((grades ?? []).map((g) => [g.code as string, g as CoreGrade]))
  const gradeNumberById = new Map<string, number>()
  for (const g of grades ?? []) gradeNumberById.set(g.id as string, Number((g.code as string).replace('G', '')))

  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('id, display_name, grade_id, class_teacher_id, stream_id')
    .eq('school_id', schoolId)
    .order('display_name')
  if (classErr) throw classErr

  const { data: schoolUsers, error: suErr } = await supabase
    .from('school_users')
    .select('id, user_id, role')
    .eq('school_id', schoolId)
  if (suErr) throw suErr

  const { data: learners, error: learnerErr } = await supabase
    .from('learners')
    .select('id, first_name, last_name, admission_number')
    .eq('school_id', schoolId)
    .order('admission_number')
  if (learnerErr) throw learnerErr

  const { data: enrollments, error: enrollErr } = await supabase
    .from('learner_enrollments')
    .select('learner_id, class_id')
    .eq('school_id', schoolId)
    .eq('status', 'active')
  if (enrollErr) throw enrollErr

  const { data: guardians, error: guardianErr } = await supabase
    .from('learner_guardians')
    .select('learner_id, full_name, phone, email, is_primary')
    .eq('school_id', schoolId)
  if (guardianErr) throw guardianErr

  return {
    schoolId,
    gradesByCode,
    gradeNumberById,
    classes: (classes ?? []) as CoreClass[],
    schoolUsers: (schoolUsers ?? []) as CoreSchoolUser[],
    learners: (learners ?? []) as CoreLearner[],
    enrollments: (enrollments ?? []) as CoreEnrollment[],
    guardians: (guardians ?? []) as CoreGuardian[],
  }
}

// ── A — bridgeTeachers ──────────────────────────────────────────────────────

async function bridgeTeachers(schoolUsers: CoreSchoolUser[]) {
  const supabase = db()
  const coreTeachers = schoolUsers.filter((u) => u.role === 'teacher')

  // Bulk-list auth users, filter to this reference school's email domain.
  const authUsersById = new Map<string, { email: string; full_name: string }>()
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email?.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) {
        authUsersById.set(u.id, {
          email: u.email,
          full_name: (u.user_metadata?.full_name as string) ?? u.email,
        })
      }
    }
    if (data.users.length < 200) break
    page++
  }

  const { data: existingLegacy, error: existingErr } = await supabase
    .from('teachers')
    .select('id, user_id')
    .eq('school', SCHOOL_NAME)
  if (existingErr) throw existingErr
  const legacyByUserId = new Map((existingLegacy ?? []).map((t) => [t.user_id as string, t.id as string]))

  let created = 0
  for (const su of coreTeachers) {
    if (legacyByUserId.has(su.user_id)) continue
    const authUser = authUsersById.get(su.user_id)
    if (!authUser) {
      console.warn(`[bridgeTeachers] no auth user / wrong email domain for school_user ${su.id} — skipping`)
      continue
    }
    const { data, error } = await supabase
      .from('teachers')
      .insert({
        user_id: su.user_id,
        full_name: authUser.full_name,
        school: SCHOOL_NAME,
        role: 'teacher',
        is_verified: true,
      })
      .select('id')
      .single()
    if (error) throw error
    legacyByUserId.set(su.user_id, data.id as string)
    created++
  }
  console.log(`[A bridgeTeachers] ${created} created, ${legacyByUserId.size} total bridged teachers`)

  // ── profiles backfill: every bridged teacher needs a `profiles` row with
  // role='teacher', not just a `teachers` row. Without this, proxy.ts's
  // canonical role lookup (lib/auth/getRole.ts) falls back to the
  // hasTeacherRecord path correctly today, but a *missing* profiles row is
  // exactly the gap that caused the /dashboard <-> /teacher/dashboard
  // infinite redirect loop before that lookup was consolidated. Runs for
  // every bridged teacher (not just newly-created ones) so re-running this
  // script also self-heals any account seeded before this fix existed —
  // no manual SQL should ever be required again.
  const { data: existingProfiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id')
    .in('id', [...legacyByUserId.keys()])
  if (profilesErr) throw profilesErr
  const profileIds = new Set((existingProfiles ?? []).map((p) => p.id as string))

  let profilesCreated = 0
  for (const [userId] of legacyByUserId) {
    if (profileIds.has(userId)) continue
    const authUser = authUsersById.get(userId)
    const { error } = await supabase
      .from('profiles')
      .insert({ id: userId, role: 'teacher', full_name: authUser?.full_name ?? null })
    if (error) throw error
    profilesCreated++
  }
  console.log(`[A bridgeTeachers] ${profilesCreated} profiles rows backfilled`)

  // ── Seed-then-verify: query the SAME way app/teacher/dashboard/page.tsx does ──
  let verifyOk = true
  for (const [userId] of legacyByUserId) {
    const { data: viaDashboardPath } = await supabase
      .from('teachers')
      .select('id, full_name, school, subject, pioneer_number, is_verified')
      .eq('user_id', userId)
      .single()
    if (!viaDashboardPath) { verifyOk = false; break }
  }
  console.log(`[A verify] dashboard-path teacher lookup for all ${legacyByUserId.size} bridged teachers: ${verifyOk ? 'PASS' : 'FAIL'}`)
  if (!verifyOk) throw new Error('[A verify] FAILED — aborting')

  // ── Seed-then-verify: the canonical role resolver must resolve every
  // bridged teacher to primary='teacher' with no redirect-loop gap ──
  let rolesVerifyOk = true
  for (const [userId] of legacyByUserId) {
    const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    if (profileRow?.role !== 'teacher') { rolesVerifyOk = false; break }
  }
  console.log(`[A verify] profiles.role='teacher' for all ${legacyByUserId.size} bridged teachers: ${rolesVerifyOk ? 'PASS' : 'FAIL'}`)
  if (!rolesVerifyOk) throw new Error('[A verify] profiles backfill FAILED — aborting')

  return { schoolUserIdToLegacyTeacherId: new Map(coreTeachers.filter(su => legacyByUserId.has(su.user_id)).map(su => [su.id, legacyByUserId.get(su.user_id)!])), userIdToLegacyTeacherId: legacyByUserId }
}

// ── B — bridgeClasses ────────────────────────────────────────────────────────

async function bridgeClasses(
  coreClasses: CoreClass[],
  gradeNumberById: Map<string, number>,
  schoolUserIdToLegacyTeacherId: Map<string, string>,
) {
  const supabase = db()

  const { data: existing, error: existingErr } = await supabase
    .from('teacher_classes')
    .select('id, external_id')
    .in('external_id', coreClasses.map((c) => c.id))
  if (existingErr) throw existingErr
  const legacyByExternalId = new Map((existing ?? []).map((c) => [c.external_id as string, c.id as string]))

  let created = 0
  for (const cls of coreClasses) {
    if (legacyByExternalId.has(cls.id)) continue
    const gradeNum = gradeNumberById.get(cls.grade_id)
    if (gradeNum === undefined) throw new Error(`No grade number for class ${cls.id}`)
    const legacyTeacherId = cls.class_teacher_id ? schoolUserIdToLegacyTeacherId.get(cls.class_teacher_id) : undefined
    if (!legacyTeacherId) {
      console.warn(`[bridgeClasses] no bridged teacher for class ${cls.display_name} — skipping`)
      continue
    }
    const classCode = `MRSS-${cls.display_name.replace(/\s+/g, '')}-${YEAR}`
    const { data, error } = await supabase
      .from('teacher_classes')
      .insert({
        teacher_id: legacyTeacherId,
        name: cls.display_name,
        grade: gradeNum,
        subject: 'All Subjects',
        curriculum_level: 'Senior School',
        academic_year: String(YEAR),
        class_code: classCode,
        external_id: cls.id,
      })
      .select('id')
      .single()
    if (error) throw error
    legacyByExternalId.set(cls.id, data.id as string)
    created++
  }
  console.log(`[B bridgeClasses] ${created} created, ${legacyByExternalId.size} total bridged classes`)

  // ── Seed-then-verify: query teacher_classes count the way the dashboard does ──
  let verifyOk = true
  const legacyTeacherIdsWithClasses = new Set(
    coreClasses
      .filter((c) => c.class_teacher_id && legacyByExternalId.has(c.id))
      .map((c) => schoolUserIdToLegacyTeacherId.get(c.class_teacher_id!)!),
  )
  for (const teacherId of legacyTeacherIdsWithClasses) {
    const { count } = await supabase
      .from('teacher_classes')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
    if (!count || count < 1) { verifyOk = false; break }
  }
  console.log(`[B verify] dashboard-path teacher_classes count for ${legacyTeacherIdsWithClasses.size} class-teachers: ${verifyOk ? 'PASS' : 'FAIL'}`)
  if (!verifyOk) throw new Error('[B verify] FAILED — aborting')

  return { coreClassIdToLegacyClassId: legacyByExternalId }
}

// ── C — bridgeStudents ───────────────────────────────────────────────────────

async function bridgeStudents(
  learners: CoreLearner[],
  enrollments: CoreEnrollment[],
  guardians: CoreGuardian[],
  coreClasses: CoreClass[],
  gradeNumberById: Map<string, number>,
  coreClassIdToLegacyClassId: Map<string, string>,
  schoolUserIdToLegacyTeacherId: Map<string, string>,
) {
  const supabase = db()

  const enrollmentByLearnerId = new Map(enrollments.map((e) => [e.learner_id, e.class_id]))
  const primaryGuardianByLearnerId = new Map<string, CoreGuardian>()
  for (const g of guardians) {
    if (g.is_primary || !primaryGuardianByLearnerId.has(g.learner_id)) primaryGuardianByLearnerId.set(g.learner_id, g)
  }
  const classById = new Map(coreClasses.map((c) => [c.id, c]))

  // Query by the small set of bridged class-teacher ids rather than a
  // 405-element `.in('external_id', ...)` — that IN clause blows past
  // Supabase's HTTP header size limit (URL-encoded into the query string).
  const legacyTeacherIds = [...new Set(schoolUserIdToLegacyTeacherId.values())]
  const { data: existing, error: existingErr } = await supabase
    .from('students')
    .select('id, external_id')
    .in('teacher_id', legacyTeacherIds)
    .not('external_id', 'is', null)
  if (existingErr) throw existingErr
  const legacyByExternalId = new Map((existing ?? []).map((s) => [s.external_id as string, s.id as string]))

  let created = 0
  for (const learner of learners) {
    const coreClassId = enrollmentByLearnerId.get(learner.id)
    if (!coreClassId) { console.warn(`[bridgeStudents] no enrollment for learner ${learner.id} — skipping`); continue }
    const cls = classById.get(coreClassId)
    if (!cls) continue
    const legacyClassId = coreClassIdToLegacyClassId.get(coreClassId)
    const legacyTeacherId = cls.class_teacher_id ? schoolUserIdToLegacyTeacherId.get(cls.class_teacher_id) : undefined
    if (!legacyClassId || !legacyTeacherId) { console.warn(`[bridgeStudents] no bridged class/teacher for learner ${learner.id} — skipping`); continue }
    const gradeNum = gradeNumberById.get(cls.grade_id)
    if (gradeNum === undefined) continue

    let legacyStudentId = legacyByExternalId.get(learner.id)
    if (!legacyStudentId) {
      const guardian = primaryGuardianByLearnerId.get(learner.id)
      const [gFirst] = (guardian?.full_name ?? '').split(' ')
      const { data, error } = await supabase
        .from('students')
        .insert({
          name: `${learner.first_name} ${learner.last_name}`,
          grade: gradeNum,
          level: 'Senior School',
          curriculum_type: 'cbc',
          added_by: 'system',
          teacher_id: legacyTeacherId,
          external_id: learner.id,
          parent_email: guardian?.email ?? null,
          parent_first_name: gFirst || null,
          parent_phone: guardian?.phone ?? null,
          term: TERM,
          year: YEAR,
        })
        .select('id')
        .single()
      if (error) throw error
      legacyStudentId = data.id as string
      legacyByExternalId.set(learner.id, legacyStudentId)
      created++
    }

    const { data: existingLink } = await supabase
      .from('class_students')
      .select('id')
      .eq('class_id', legacyClassId)
      .eq('student_id', legacyStudentId)
      .maybeSingle()
    if (!existingLink) {
      const { error: linkErr } = await supabase
        .from('class_students')
        .insert({ class_id: legacyClassId, student_id: legacyStudentId, parent_id: null })
      if (linkErr) throw linkErr
    }
  }
  console.log(`[C bridgeStudents] ${created} created, ${legacyByExternalId.size} total bridged students`)

  // ── Seed-then-verify: resolve a student by teacher_id + name, like a Blueprint lookup ──
  // Sampled from enrolled learners only — a learner with no class enrollment
  // is already, correctly, skipped by the bridging loop above (logged, not
  // an error); sampling from the unfiltered `learners` array could draw one
  // of those and fail this check for a reason unrelated to bridging itself.
  const sample = learners.filter((l) => enrollmentByLearnerId.has(l.id)).slice(0, 5)
  let verifyOk = true
  for (const learner of sample) {
    const legacyStudentId = legacyByExternalId.get(learner.id)
    if (!legacyStudentId) { verifyOk = false; break }
    const coreClassId = enrollmentByLearnerId.get(learner.id)
    const cls = coreClassId ? classById.get(coreClassId) : undefined
    const legacyTeacherId = cls?.class_teacher_id ? schoolUserIdToLegacyTeacherId.get(cls.class_teacher_id) : undefined
    if (!legacyTeacherId) { verifyOk = false; break }
    // .limit() rather than .maybeSingle() — the random Kenyan name pool can
    // produce same-class name collisions, so disambiguate on external_id.
    const { data } = await supabase
      .from('students')
      .select('id, name, teacher_id, external_id')
      .eq('teacher_id', legacyTeacherId)
      .eq('name', `${learner.first_name} ${learner.last_name}`)
      .limit(5)
    const match = (data ?? []).find((row) => row.external_id === learner.id)
    if (!match) { verifyOk = false; break }
  }
  console.log(`[C verify] Blueprint-style (teacher_id + name) lookup for ${sample.length} sampled students: ${verifyOk ? 'PASS' : 'FAIL'}`)
  if (!verifyOk) throw new Error('[C verify] FAILED — aborting')

  return { coreLearnerIdToLegacyStudentId: legacyByExternalId }
}

// ── D — bridgeAssessmentsAndMarks ───────────────────────────────────────────

async function bridgeAssessmentsAndMarks(
  coreClasses: CoreClass[],
  coreClassIdToLegacyClassId: Map<string, string>,
  schoolUserIdToLegacyTeacherId: Map<string, string>,
  enrollments: CoreEnrollment[],
  learnersById: Map<string, CoreLearner>,
  coreLearnerIdToLegacyStudentId: Map<string, string>,
  legacyTeacherIdToUserId: Map<string, string>,
) {
  const supabase = db()
  const ASSESSMENT_TITLE = 'Kiswahili Term 2 CAT 1'

  const learnersByClass = new Map<string, CoreLearner[]>()
  for (const e of enrollments) {
    const learner = learnersById.get(e.learner_id)
    if (!learner) continue
    const arr = learnersByClass.get(e.class_id) ?? []
    arr.push(learner)
    learnersByClass.set(e.class_id, arr)
  }

  let assessmentsCreated = 0
  let marksCreated = 0
  const legacyAssessmentIdByLegacyClassId = new Map<string, string>()

  for (const cls of coreClasses) {
    const legacyClassId = coreClassIdToLegacyClassId.get(cls.id)
    const legacyTeacherId = cls.class_teacher_id ? schoolUserIdToLegacyTeacherId.get(cls.class_teacher_id) : undefined
    if (!legacyClassId || !legacyTeacherId) continue

    const { data: existingAssessment } = await supabase
      .from('class_assessments')
      .select('id')
      .eq('class_id', legacyClassId)
      .eq('title', ASSESSMENT_TITLE)
      .maybeSingle()

    let assessmentId: string
    if (existingAssessment) {
      assessmentId = existingAssessment.id as string
    } else {
      // Sprint 5E pre-implementation verification: legacyTeacherId is
      // already resolved above (line ~287) via the script's own
      // schoolUserIdToLegacyTeacherId map — no new lookup needed — so this
      // completes an already-available write with the same canonical
      // resolution the teacher-facing path uses, closing the same
      // assessment_type_id gap for this caller.
      const assessmentTypeId = await resolveOrCreateAssessmentType(legacyTeacherId, 'cat')
      const created = await assessmentRepo.createCoreAssessment({
        class_id: legacyClassId,
        teacher_id: legacyTeacherId,
        title: ASSESSMENT_TITLE,
        assessment_type: 'cat',
        assessment_type_id: assessmentTypeId,
        term: String(TERM),
        year: YEAR,
        max_score: 100,
        subjects: [KISWAHILI_SUBJECT],
        curriculum_type: 'cbc',
        weight_percent: 30,
        grading_type: 'both',
      })
      assessmentId = created.id as string
      await supabase.from('class_assessments').update({ external_id: legacyClassId, is_published: true }).eq('id', assessmentId)
      assessmentsCreated++
    }
    legacyAssessmentIdByLegacyClassId.set(legacyClassId, assessmentId)

    const classLearners = learnersByClass.get(cls.id) ?? []
    const { data: existingMarks } = await supabase
      .from('learner_marks')
      .select('id, student_name, student_id')
      .eq('assessment_id', assessmentId)
    const existingByName = new Map((existingMarks ?? []).map(m => [m.student_name as string, m as { id: string; student_id: string | null }]))

    // learner_marks has a UNIQUE (assessment_id, student_name) constraint —
    // the randomly-generated Kenyan name pool in 04-seed-students.ts produces
    // occasional same-class name collisions (birthday-paradox over 45
    // students), so disambiguate with the admission number suffix when
    // needed rather than letting the whole batch insert fail.
    const usedNames = new Set<string>()
    const newRows: Parameters<typeof assessmentRepo.insertMarks>[0] = []
    const backfills: { id: string; studentId: string }[] = []
    for (const learner of classLearners) {
      const score = keyedInt(`${SEED}:marks:${learner.id}`, 35, 98)
      const cbcLevel = score >= 80 ? 'EE' : score >= 60 ? 'ME' : score >= 40 ? 'AE' : 'BE'
      let studentName = `${learner.first_name} ${learner.last_name}`
      if (usedNames.has(studentName)) studentName = `${studentName} (${learner.admission_number})`
      usedNames.add(studentName)
      const legacyStudentId = coreLearnerIdToLegacyStudentId.get(learner.id) ?? null

      const existing = existingByName.get(studentName)
      if (existing) {
        // Self-healing: rows bridged before student_id was threaded through
        // here (student_id: null) can't be picked up by
        // recordAssessmentEvidence below — backfill them rather than leaving
        // pre-existing reference-school data permanently un-evidenced.
        if (!existing.student_id && legacyStudentId) backfills.push({ id: existing.id, studentId: legacyStudentId })
        continue
      }
      newRows.push({
        assessment_id: assessmentId,
        class_id: legacyClassId,
        teacher_id: legacyTeacherId,
        student_name: studentName,
        admission_number: learner.admission_number,
        subject_scores: { [KISWAHILI_SUBJECT]: score },
        total_marks: score,
        mean_score: score,
        mean_grade: cbcLevel,
        student_id: legacyStudentId,
      })
    }
    if (newRows.length > 0) {
      await assessmentRepo.insertMarks(newRows)
      marksCreated += newRows.length
    }
    for (const { id, studentId } of backfills) {
      await supabase.from('learner_marks').update({ student_id: studentId }).eq('id', id)
    }

    // Evidence Domain: same call the live upload/marks routes now make after
    // grading (lib/assessments/evidence.ts). Unconditional (not gated on
    // whether marks were freshly inserted this run) — self-healing, so
    // marks bridged before this wiring existed still get backfilled with
    // real evidence rather than being permanently stuck without it.
    const initiatingUserId = legacyTeacherIdToUserId.get(legacyTeacherId)
    if (initiatingUserId) await recordAssessmentEvidence(assessmentId, legacyTeacherId, initiatingUserId)
  }
  console.log(`[D bridgeAssessmentsAndMarks] ${assessmentsCreated} assessments created, ${marksCreated} marks created`)

  // ── Seed-then-verify: call AssessmentRepository's own read method ──
  let verifyOk = true
  for (const [, assessmentId] of legacyAssessmentIdByLegacyClassId) {
    const marks = await assessmentRepo.findMarksByAssessmentForScores(assessmentId)
    if (marks.length === 0) { verifyOk = false; break }
  }
  console.log(`[D verify] findMarksByAssessmentForScores readable for all ${legacyAssessmentIdByLegacyClassId.size} bridged assessments: ${verifyOk ? 'PASS' : 'FAIL'}`)
  if (!verifyOk) throw new Error('[D verify] FAILED — aborting')

  // ── Seed-then-verify: recordAssessmentEvidence actually reached learner_evidence ──
  const [, sampleLegacyAssessmentId] = [...legacyAssessmentIdByLegacyClassId.entries()][0] ?? []
  let evidenceVerifyOk = false
  if (sampleLegacyAssessmentId) {
    const { count } = await supabase
      .from('learner_evidence')
      .select('id', { count: 'exact', head: true })
      .like('raw_input_ref', `class_assessments:${sampleLegacyAssessmentId}:%`)
    evidenceVerifyOk = (count ?? 0) > 0
  }
  console.log(`[D verify] recordAssessmentEvidence reached learner_evidence for sampled assessment: ${evidenceVerifyOk ? 'PASS' : 'FAIL'}`)
  if (!evidenceVerifyOk) throw new Error('[D verify] evidence FAILED — aborting')

  return { legacyAssessmentIdByLegacyClassId }
}

// ── E — bridgeIntelligenceEvidence ──────────────────────────────────────────

async function bridgeIntelligenceEvidence(
  coreClasses: CoreClass[],
  coreClassIdToLegacyClassId: Map<string, string>,
  schoolUserIdToLegacyTeacherId: Map<string, string>,
  gradeNumberById: Map<string, number>,
  enrollments: CoreEnrollment[],
  learnersById: Map<string, CoreLearner>,
  coreLearnerIdToLegacyStudentId: Map<string, string>,
  careerSlugs: string[],
) {
  const supabase = db()

  const learnersByClass = new Map<string, CoreLearner[]>()
  for (const e of enrollments) {
    const learner = learnersById.get(e.learner_id)
    if (!learner) continue
    const arr = learnersByClass.get(e.class_id) ?? []
    arr.push(learner)
    learnersByClass.set(e.class_id, arr)
  }

  let profilesTouched = 0
  let topicalRowsCreated = 0
  let capabilityRowsCreated = 0
  let interestRowsCreated = 0
  let alertRowsCreated = 0

  // Deterministic global ordering — sorted by Core learner id — so the
  // alert-subset stepping below is stable across runs regardless of Map
  // iteration order. (interestSampleIds no longer needs a stable order — it
  // is keyed per-learner-id independent of iteration/array position.)
  const allLearners = [...learnersById.values()].sort((a, b) => a.id.localeCompare(b.id))
  const interestSampleIds = new Set(
    allLearners.filter((l) => keyedUnit(`${SEED}:interest-sample:${l.id}`) < 0.35).map((l) => l.id),
  )
  const alertPool = allLearners.slice() // consumed below for a fixed-size alert subset
  const ALERT_TARGET = 10
  const alertStep = Math.max(1, Math.floor(alertPool.length / ALERT_TARGET))
  const alertSampleIds = new Set(
    Array.from({ length: ALERT_TARGET }, (_, i) => alertPool[(i * alertStep) % alertPool.length]?.id).filter(Boolean),
  )
  const ALERT_TYPES = ['declining_scores', 'repeated_struggles'] as const

  for (const cls of coreClasses) {
    const legacyClassId = coreClassIdToLegacyClassId.get(cls.id)
    const legacyTeacherId = cls.class_teacher_id ? schoolUserIdToLegacyTeacherId.get(cls.class_teacher_id) : undefined
    const gradeNum = gradeNumberById.get(cls.grade_id)
    if (!legacyClassId || !legacyTeacherId || gradeNum === undefined) continue

    const classLearners = learnersByClass.get(cls.id) ?? []
    const legacyStudentIds = classLearners
      .map((l) => coreLearnerIdToLegacyStudentId.get(l.id))
      .filter((id): id is string => !!id)
    if (legacyStudentIds.length === 0) continue

    // ── learner_profiles (getOrCreateLearnerProfile is internally idempotent) ──
    for (const studentId of legacyStudentIds) {
      await learnerModelRepo.getOrCreateLearnerProfile(studentId)
      profilesTouched++
    }

    // ── shared per-class `assessments` (career/pathway parent) row ──
    const bridgeNote = `${BRIDGE_MARKER}:${legacyClassId}`
    const { data: existingSharedAssessment } = await supabase
      .from('assessments')
      .select('id')
      .eq('student_id', legacyStudentIds[0])
      .contains('raw_marks', { note: bridgeNote })
      .maybeSingle()
    if (!existingSharedAssessment) {
      const { error } = await supabase.from('assessments').insert({
        student_id: legacyStudentIds[0],
        term: TERM,
        year: YEAR,
        grade: gradeNum,
        curriculum_type: 'cbc',
        assessment_style: 'formative',
        source: 'teacher',
        subject_scores: {},
        raw_marks: { note: bridgeNote },
      })
      if (error) throw error
    }

    // ── strand_assessments topical checks — real node_assessment_map topics only ──
    const { data: mapRows, error: mapErr } = await supabase
      .from('node_assessment_map')
      .select('subject, strand, topic, node_id')
      .eq('grade', gradeNum)
      .in('subject', MATH_GRADES.includes(gradeNum) ? [KISWAHILI_SUBJECT, MATH_SUBJECT] : [KISWAHILI_SUBJECT])
    if (mapErr) throw mapErr
    const topics = (mapRows ?? []) as TopicRow[]

    const expectedTopicalRows = legacyStudentIds.length * topics.length * 2
    const { count: existingTopicalCount } = await supabase
      .from('strand_assessments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', legacyClassId)
      .eq('source', 'topical_check')

    if ((existingTopicalCount ?? 0) < expectedTopicalRows && topics.length > 0) {
      const t1Rows: Parameters<typeof assessmentRepo.insertTopicalAssessments>[0] = []
      const t2Rows: Parameters<typeof assessmentRepo.insertTopicalAssessments>[0] = []
      for (const studentId of legacyStudentIds) {
        for (const t of topics) {
          const r1 = keyedInt(`${SEED}:topical-r1:${studentId}:${t.node_id}`, 1, 3)
          const r2 = Math.min(4, r1 + keyedInt(`${SEED}:topical-r2:${studentId}:${t.node_id}`, 0, 1))
          t1Rows.push({
            class_id: legacyClassId, teacher_id: legacyTeacherId, student_id: studentId,
            subject: t.subject, strand: t.strand, topic: t.topic,
            rating: r1, marks: r1 * 25, term: TERM, year: YEAR,
          })
          t2Rows.push({
            class_id: legacyClassId, teacher_id: legacyTeacherId, student_id: studentId,
            subject: t.subject, strand: t.strand, topic: t.topic,
            rating: r2, marks: r2 * 25, term: TERM, year: YEAR,
          })
        }
      }
      await assessmentRepo.insertTopicalAssessments(t1Rows)
      await assessmentRepo.insertTopicalAssessments(t2Rows)
      topicalRowsCreated += t1Rows.length + t2Rows.length
    }

    // ── capability_history — one row per student ──
    const { count: existingCapabilityCount } = await supabase
      .from('capability_history')
      .select('id', { count: 'exact', head: true })
      .in('student_id', legacyStudentIds)
    if ((existingCapabilityCount ?? 0) < legacyStudentIds.length) {
      for (const studentId of legacyStudentIds) {
        const { count: has } = await supabase
          .from('capability_history')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', studentId)
        if ((has ?? 0) > 0) continue

        const levels: readonly CapabilityLevel[] = ['emerging', 'developing', 'capable', 'strong', 'exceptional']
        const trends: readonly CapabilityTrendDirection[] = ['declining', 'stable', 'growing', 'accelerating']

        function seededScore(dimension: string): CapabilityScore {
          const rawScore = Math.round(keyedUnit(`${SEED}:capability-score:${studentId}:${dimension}`) * 100) / 100
          return {
            level: levels[Math.min(4, Math.floor(rawScore * 5))],
            raw_score: rawScore,
            trend: keyedPick(`${SEED}:capability-trend:${studentId}:${dimension}`, trends),
            evidence: [`${BRIDGE_MARKER} placeholder evidence`],
            confidence: Math.round(keyedUnit(`${SEED}:capability-confidence:${studentId}:${dimension}`) * 100) / 100,
          }
        }

        const profile: CapabilityProfile = {
          analytical_reasoning: seededScore('analytical_reasoning'),
          communication: seededScore('communication'),
          creative_thinking: seededScore('creative_thinking'),
          technical_aptitude: seededScore('technical_aptitude'),
          social_intelligence: seededScore('social_intelligence'),
          resilience: seededScore('resilience'),
          dominant_cluster: [],
          emerging_cluster: [],
          computed_at: new Date().toISOString(),
          assessment_count: topics.length,
          disclaimer: `${BRIDGE_MARKER}: placeholder data for pilot-readiness walkthrough — not a real assessment.`,
        }

        await careerRepo.insertCapabilityHistory({
          student_id: studentId,
          capability_profile: profile,
          assessment_count: topics.length,
          computed_at: new Date().toISOString(),
        })
        capabilityRowsCreated++
      }
    }

    // ── student_career_interests — deterministic ~35% sample ──
    for (const learner of classLearners) {
      if (!interestSampleIds.has(learner.id)) continue
      const studentId = coreLearnerIdToLegacyStudentId.get(learner.id)
      if (!studentId) continue
      const slug = keyedPick(`${SEED}:interest-slug:${learner.id}`, careerSlugs)
      const { data: existingInterest } = await supabase
        .from('student_career_interests')
        .select('id')
        .eq('student_id', studentId)
        .eq('career_slug', slug)
        .maybeSingle()
      if (existingInterest) continue
      const careerRow = await careerRepo.findCareerIdBySlug(slug)
      await careerRepo.insertCareerInterest({
        student_id: studentId,
        career_id: careerRow?.id ?? null,
        career_slug: slug,
        interest_level: keyedInt(`${SEED}:interest-level:${learner.id}`, 3, 5),
        notes: `${BRIDGE_MARKER} placeholder interest`,
        explored_at: new Date().toISOString(),
      })
      interestRowsCreated++
    }

    // ── student_alerts — deterministic fixed subset (~8–12 total) ──
    for (const learner of classLearners) {
      if (!alertSampleIds.has(learner.id)) continue
      const studentId = coreLearnerIdToLegacyStudentId.get(learner.id)
      if (!studentId) continue
      const alertType = keyedPick(`${SEED}:alert-type:${learner.id}`, ALERT_TYPES)
      const { data: existingAlert } = await supabase
        .from('student_alerts')
        .select('id')
        .eq('student_id', studentId)
        .eq('teacher_id', legacyTeacherId)
        .eq('alert_type', alertType)
        .maybeSingle()
      if (existingAlert) continue
      const { error } = await supabase.from('student_alerts').insert({
        student_id: studentId,
        teacher_id: legacyTeacherId,
        alert_type: alertType,
        message: `${BRIDGE_MARKER}: placeholder alert for pilot-readiness walkthrough (${alertType.replace(/_/g, ' ')}).`,
        is_resolved: false,
      })
      if (error) throw error
      alertRowsCreated++
    }
  }

  console.log(`[E bridgeIntelligenceEvidence] profiles touched=${profilesTouched}, topical rows created=${topicalRowsCreated}, capability rows created=${capabilityRowsCreated}, interest rows created=${interestRowsCreated}, alert rows created=${alertRowsCreated}`)

  // ── Seed-then-verify: getOrCreateLearnerProfile again must return the SEEDED profile ──
  const sampleStudentId = [...coreLearnerIdToLegacyStudentId.values()][0]
  let verifyOk = false
  if (sampleStudentId) {
    const before = await learnerModelRepo.getLearnerProfile(sampleStudentId)
    const again = await learnerModelRepo.getOrCreateLearnerProfile(sampleStudentId)
    verifyOk = !!before && again.student_id === before.student_id && again.id === before.id
  }
  console.log(`[E verify] getOrCreateLearnerProfile returns the already-seeded profile (not a fresh blank one): ${verifyOk ? 'PASS' : 'FAIL'}`)
  if (!verifyOk) throw new Error('[E verify] FAILED — aborting')
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function seedLegacyBridge() {
  const supabase = db()

  const ctx = await getCoreContext()
  const learnersById = new Map(ctx.learners.map((l) => [l.id, l]))

  console.log(`Bridging legacy schema for ${SCHOOL_NAME} (core school_id=${ctx.schoolId})`)

  const { schoolUserIdToLegacyTeacherId, userIdToLegacyTeacherId } = await bridgeTeachers(ctx.schoolUsers)
  const legacyTeacherIdToUserId = new Map([...userIdToLegacyTeacherId.entries()].map(([userId, teacherId]) => [teacherId, userId]))
  const { coreClassIdToLegacyClassId } = await bridgeClasses(ctx.classes, ctx.gradeNumberById, schoolUserIdToLegacyTeacherId)
  const { coreLearnerIdToLegacyStudentId } = await bridgeStudents(
    ctx.learners, ctx.enrollments, ctx.guardians, ctx.classes, ctx.gradeNumberById,
    coreClassIdToLegacyClassId, schoolUserIdToLegacyTeacherId,
  )
  await bridgeAssessmentsAndMarks(
    ctx.classes, coreClassIdToLegacyClassId, schoolUserIdToLegacyTeacherId,
    ctx.enrollments, learnersById, coreLearnerIdToLegacyStudentId, legacyTeacherIdToUserId,
  )

  const { data: careers, error: careersErr } = await supabase.from('careers').select('slug')
  if (careersErr) throw careersErr
  const careerSlugs = (careers ?? []).map((c) => c.slug as string)
  if (careerSlugs.length === 0) throw new Error('No careers found — cannot seed student_career_interests')

  await bridgeIntelligenceEvidence(
    ctx.classes, coreClassIdToLegacyClassId, schoolUserIdToLegacyTeacherId, ctx.gradeNumberById,
    ctx.enrollments, learnersById, coreLearnerIdToLegacyStudentId, careerSlugs,
  )

  return {
    schoolUserIdToLegacyTeacherId,
    coreClassIdToLegacyClassId,
    coreLearnerIdToLegacyStudentId,
  }
}

if (require.main === module) {
  seedLegacyBridge()
    .then((r) => {
      console.log('\n[done] bridged teachers:', r.schoolUserIdToLegacyTeacherId.size)
      console.log('[done] bridged classes:', r.coreClassIdToLegacyClassId.size)
      console.log('[done] bridged students:', r.coreLearnerIdToLegacyStudentId.size)
    })
    .catch((e) => { console.error(e); process.exit(1) })
}
