// scripts/reference-school/cleanup-legacy-bridge.ts
//
// ⚠️  TEMPORARY INFRASTRUCTURE. Tears down everything
// 06-seed-legacy-bridge.ts created. This bridge exists only to unblock a
// pilot-readiness UX walkthrough while legacy consumers are migrated to
// Core — production code must never depend on it. See the header comment
// in 06-seed-legacy-bridge.ts and docs/architecture/migration-ledger.md for
// full context.
//
// FK-safe deletion order, keyed off explicit markers ONLY
// (teachers.school = SCHOOL_NAME as the primary marker, external_id on
// every table that has one):
//   student_alerts
//   → strand_assessments / capability_history / student_career_interests
//     + their throwaway `assessments` parent rows (tagged via
//       raw_marks->>'note' LIKE '<BRIDGE_MARKER>:%')
//   → learner_profiles
//   → learner_marks
//   → class_assessments
//   → class_students
//   → students
//   → teacher_classes
//   → teachers
//
// This script NEVER calls auth.admin.deleteUser and NEVER touches
// school_users — those belong solely to Core's own cleanup.ts. The auth
// accounts and school_users rows are Core's, not this bridge's.
//
// Run: npx tsx --env-file=.env.local scripts/reference-school/cleanup-legacy-bridge.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, SCHOOL_NAME, chunk } from './shared'
import { BRIDGE_MARKER } from './06-seed-legacy-bridge'

// 405 bridged students means some `.in(...)` filters would otherwise
// URL-encode past Supabase's ~16KB HTTP header limit — chunk every large
// IN-list operation (student_ids in particular) into batches.
const CHUNK_SIZE = 100

type DB = ReturnType<typeof db>

async function deleteInChunks(
  supabase: DB,
  table: string,
  column: string,
  ids: string[],
): Promise<void> {
  for (const batch of chunk(ids, CHUNK_SIZE)) {
    const { error } = await supabase.from(table).delete().in(column, batch)
    if (error) throw new Error(`delete ${table} by ${column}: ${error.message}`)
  }
}

async function main() {
  const supabase = db()

  const { data: teachers, error: teacherErr } = await supabase
    .from('teachers')
    .select('id, user_id')
    .eq('school', SCHOOL_NAME)
  if (teacherErr) throw teacherErr
  const teacherIds = (teachers ?? []).map((t) => t.id as string)

  if (teacherIds.length === 0) {
    console.log('[cleanup-legacy-bridge] no bridged teachers found — nothing to do')
    return
  }

  const { data: classes, error: classErr } = await supabase
    .from('teacher_classes')
    .select('id')
    .in('teacher_id', teacherIds)
  if (classErr) throw classErr
  const classIds = (classes ?? []).map((c) => c.id as string)

  const studentIds: string[] = []
  for (const batch of chunk(teacherIds, CHUNK_SIZE)) {
    const { data: students, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .in('teacher_id', batch)
    if (studentErr) throw studentErr
    studentIds.push(...(students ?? []).map((s) => s.id as string))
  }

  // ── student_alerts ──────────────────────────────────────────────────────
  if (studentIds.length > 0) await deleteInChunks(supabase, 'student_alerts', 'student_id', studentIds)
  console.log('[cleanup-legacy-bridge] student_alerts removed')

  // ── strand_assessments / capability_history / student_career_interests ──
  if (studentIds.length > 0) {
    await deleteInChunks(supabase, 'strand_assessments', 'student_id', studentIds)
    await deleteInChunks(supabase, 'capability_history', 'student_id', studentIds)
    await deleteInChunks(supabase, 'student_career_interests', 'student_id', studentIds)
  }
  console.log('[cleanup-legacy-bridge] strand_assessments / capability_history / student_career_interests removed')

  // Throwaway `assessments` parent rows tagged with the bridge marker.
  let bridgeAssessmentCount = 0
  if (studentIds.length > 0) {
    const bridgeAssessmentIds: string[] = []
    for (const batch of chunk(studentIds, CHUNK_SIZE)) {
      const { data: taggedAssessments } = await supabase
        .from('assessments')
        .select('id, raw_marks')
        .in('student_id', batch)
      for (const a of taggedAssessments ?? []) {
        const note = (a.raw_marks as { note?: string } | null)?.note
        if (typeof note === 'string' && note.startsWith(`${BRIDGE_MARKER}:`)) bridgeAssessmentIds.push(a.id as string)
      }
    }
    if (bridgeAssessmentIds.length > 0) {
      await deleteInChunks(supabase, 'assessments', 'id', bridgeAssessmentIds)
    }
    bridgeAssessmentCount = bridgeAssessmentIds.length
  }
  console.log(`[cleanup-legacy-bridge] ${bridgeAssessmentCount} tagged 'assessments' parent rows removed`)

  // ── learner_profiles ─────────────────────────────────────────────────────
  if (studentIds.length > 0) await deleteInChunks(supabase, 'learner_profiles', 'student_id', studentIds)
  console.log('[cleanup-legacy-bridge] learner_profiles removed')

  // ── learner_marks + class_assessments ───────────────────────────────────
  if (classIds.length > 0) {
    const { data: assessments } = await supabase.from('class_assessments').select('id').in('class_id', classIds)
    const assessmentIds = (assessments ?? []).map((a) => a.id as string)
    if (assessmentIds.length > 0) {
      await deleteInChunks(supabase, 'learner_marks', 'assessment_id', assessmentIds)
      await deleteInChunks(supabase, 'class_assessments', 'id', assessmentIds)
    }
  }
  console.log('[cleanup-legacy-bridge] learner_marks + class_assessments removed')

  // ── class_students ───────────────────────────────────────────────────────
  if (classIds.length > 0) await deleteInChunks(supabase, 'class_students', 'class_id', classIds)
  console.log('[cleanup-legacy-bridge] class_students removed')

  // ── students ──────────────────────────────────────────────────────────────
  if (studentIds.length > 0) await deleteInChunks(supabase, 'students', 'id', studentIds)
  console.log(`[cleanup-legacy-bridge] ${studentIds.length} students removed`)

  // ── teacher_classes ───────────────────────────────────────────────────────
  if (classIds.length > 0) await deleteInChunks(supabase, 'teacher_classes', 'id', classIds)
  console.log(`[cleanup-legacy-bridge] ${classIds.length} teacher_classes removed`)

  // ── teachers ──────────────────────────────────────────────────────────────
  const { error: teacherDeleteErr } = await supabase.from('teachers').delete().eq('school', SCHOOL_NAME)
  if (teacherDeleteErr) throw teacherDeleteErr
  console.log(`[cleanup-legacy-bridge] ${teacherIds.length} teachers removed`)

  console.log('\n[cleanup-legacy-bridge] done — auth accounts and school_users untouched (Core-owned)')
}

main().catch((e) => { console.error(e); process.exit(1) })
