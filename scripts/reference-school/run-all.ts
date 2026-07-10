// scripts/reference-school/run-all.ts
//
// Runs the full Reference School seed end to end: school -> academics ->
// staff (+ auth accounts) -> students (+ guardians + enrollments) ->
// sample assessments. Each step is idempotent (safe to re-run).
//
// Run: npx tsx scripts/reference-school/run-all.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, SCHOOL_NAME } from './shared'
import { seedAssessments } from './05-seed-assessments'

async function main() {
  console.log(`Seeding Reference School: ${SCHOOL_NAME}`)
  const ctx = await seedAssessments()

  const supabase = db()
  const [{ count: learnerCount }, { count: guardianCount }, { count: schoolUserCount }, { count: classCount }, { count: markCount }] = await Promise.all([
    supabase.from('learners').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
    supabase.from('learner_guardians').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
    supabase.from('school_users').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', ctx.schoolId),
    supabase.from('learner_marks').select('id', { count: 'exact', head: true }).in('class_id', Object.values(ctx.classIds)),
  ])

  console.log('\n=== Reference School Seed Complete ===')
  console.log(`school_id:      ${ctx.schoolId}`)
  console.log(`classes:        ${classCount}`)
  console.log(`school_users:   ${schoolUserCount}`)
  console.log(`learners:       ${learnerCount}`)
  console.log(`guardians:      ${guardianCount}`)
  console.log(`marks:          ${markCount}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
