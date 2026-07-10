// scripts/reference-school/cleanup.ts
//
// Tears down everything run-all.ts created: deletes the 48 throwaway
// Supabase Auth accounts first (not FK-cascaded), then deletes the
// `schools` row, which cascades to every other reference-school table
// (academic_years, terms, streams, school_users, classes, learners,
// learner_guardians, learner_enrollments, class_subjects, grade_subjects,
// learner_marks references class/assessment which cascade via class_id's
// own FK chain — class_assessments/learner_marks have no direct school_id
// FK, so they're cleaned up explicitly below too).
//
// Run: npx tsx scripts/reference-school/cleanup.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, SCHOOL_NAME } from './shared'

async function main() {
  const supabase = db()

  const { data: school } = await supabase
    .from('schools')
    .select('id')
    .eq('school_name', SCHOOL_NAME)
    .maybeSingle()

  if (!school) {
    console.log('[cleanup] no reference school found — nothing to do')
    return
  }
  const schoolId = school.id

  const { data: classes } = await supabase.from('classes').select('id').eq('school_id', schoolId)
  const classIds = (classes ?? []).map((c) => c.id)

  if (classIds.length > 0) {
    const { data: assessments } = await supabase.from('class_assessments').select('id').in('class_id', classIds)
    const assessmentIds = (assessments ?? []).map((a) => a.id)
    if (assessmentIds.length > 0) {
      await supabase.from('learner_marks').delete().in('assessment_id', assessmentIds)
      await supabase.from('class_assessments').delete().in('id', assessmentIds)
    }
  }
  console.log('[cleanup] class_assessments + learner_marks removed')

  const { data: schoolUsers } = await supabase.from('school_users').select('user_id').eq('school_id', schoolId)
  const userIds = (schoolUsers ?? []).map((u) => u.user_id)

  for (const userId of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) console.error(`[cleanup] failed to delete auth user ${userId}:`, error.message)
  }
  console.log(`[cleanup] ${userIds.length} auth accounts removed`)

  const { error: schoolErr } = await supabase.from('schools').delete().eq('id', schoolId)
  if (schoolErr) throw schoolErr
  console.log(`[cleanup] schools row ${schoolId} deleted (cascaded to all dependent tables)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
