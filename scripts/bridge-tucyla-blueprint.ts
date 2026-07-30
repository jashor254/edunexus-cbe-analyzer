// scripts/bridge-tucyla-blueprint.ts
//
// ONE-OFF, DISPOSABLE. Not a general migration. Founder's own pilot account
// ("kangai  school", teacher Dennis Kariuki Njeru) has real legacy `students`
// rows but was never onboarded onto the Core schema (no `schools` row at
// all), so the canonical Learner Blueprint (which requires a Core
// `learners.id`) cannot compose for any of them. This script hand-builds the
// minimum Core skeleton (school, school_users, academic_year, term, class,
// grade reuse) needed to bridge exactly one real student — TUCYLA NYAWIRA —
// so her Blueprint can actually be composed and inspected for rendering
// issues. Idempotent: safe to re-run.
//
// Run: npx tsx scripts/bridge-tucyla-blueprint.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const LEGACY_STUDENT_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb' // TUCYLA NYAWIRA
const LEGACY_TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801' // Dennis Kariuki Njeru
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'
const SCHOOL_NAME = 'kangai  school'
const GRADE_9_ID = '67d851e3-6f17-4c28-be36-4bbce7cdca7a' // grades.code = 'G9'

async function main() {
  console.log('▸ schools')
  let { data: school } = await db.from('schools').select('id').eq('school_name', SCHOOL_NAME).maybeSingle()
  if (!school) {
    const { data, error } = await db.from('schools').insert({ school_name: SCHOOL_NAME }).select('id').single()
    if (error) throw error
    school = data
  }
  const schoolId = school!.id as string
  console.log(`  school_id=${schoolId}`)

  console.log('▸ school_users')
  let { data: schoolUser } = await db
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_id', TEACHER_USER_ID)
    .maybeSingle()
  if (!schoolUser) {
    const { data, error } = await db
      .from('school_users')
      .insert({ school_id: schoolId, user_id: TEACHER_USER_ID, role: 'teacher', is_active: true })
      .select('id')
      .single()
    if (error) throw error
    schoolUser = data
  }
  const schoolUserId = schoolUser!.id as string
  console.log(`  school_user_id=${schoolUserId}`)

  console.log('▸ academic_years')
  let { data: year } = await db.from('academic_years').select('id').eq('school_id', schoolId).eq('name', '2026').maybeSingle()
  if (!year) {
    const { data, error } = await db
      .from('academic_years')
      .insert({ school_id: schoolId, name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', is_current: true })
      .select('id')
      .single()
    if (error) throw error
    year = data
  }
  const academicYearId = year!.id as string
  console.log(`  academic_year_id=${academicYearId}`)

  console.log('▸ terms')
  let { data: term } = await db
    .from('terms')
    .select('id')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .eq('term_number', 2)
    .maybeSingle()
  if (!term) {
    const { data, error } = await db
      .from('terms')
      .insert({
        school_id: schoolId,
        academic_year_id: academicYearId,
        term_number: 2,
        name: 'Term 2',
        start_date: '2026-05-04',
        end_date: '2026-08-07',
        is_current: true,
      })
      .select('id')
      .single()
    if (error) throw error
    term = data
  }
  const termId = term!.id as string
  console.log(`  term_id=${termId}`)

  console.log('▸ classes')
  let { data: cls } = await db
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('display_name', 'Grade 9Y')
    .maybeSingle()
  if (!cls) {
    const { data, error } = await db
      .from('classes')
      .insert({
        school_id: schoolId,
        grade_id: GRADE_9_ID,
        grade: 9,
        display_name: 'Grade 9Y',
        class_name: 'Grade 9Y',
        class_teacher_id: schoolUserId,
        academic_year: 2026,
        academic_year_id: academicYearId,
      })
      .select('id')
      .single()
    if (error) throw error
    cls = data
  }
  const classId = cls!.id as string
  console.log(`  class_id=${classId}`)

  console.log('▸ learners')
  let { data: learner } = await db
    .from('learners')
    .select('id')
    .eq('school_id', schoolId)
    .eq('admission_number', 'BRIDGE-TUCYLA-01')
    .maybeSingle()
  if (!learner) {
    const { data, error } = await db
      .from('learners')
      .insert({
        school_id: schoolId,
        admission_number: 'BRIDGE-TUCYLA-01',
        first_name: 'TUCYLA',
        last_name: 'NYAWIRA',
        nationality: 'Kenyan',
        special_needs: [],
        status: 'active',
        admission_date: '2026-05-28',
      })
      .select('id')
      .single()
    if (error) throw error
    learner = data
  }
  const learnerId = learner!.id as string
  console.log(`  learner_id=${learnerId}`)

  console.log('▸ learner_enrollments')
  const { data: enrollment } = await db
    .from('learner_enrollments')
    .select('id')
    .eq('learner_id', learnerId)
    .eq('class_id', classId)
    .maybeSingle()
  if (!enrollment) {
    const { error } = await db.from('learner_enrollments').insert({
      school_id: schoolId,
      learner_id: learnerId,
      class_id: classId,
      term_id: termId,
      academic_year_id: academicYearId,
      enrollment_date: '2026-05-28',
      status: 'active',
    })
    if (error) throw error
  }
  console.log('  ✅ enrolled')

  console.log('▸ bridging students.external_id')
  const { error: bridgeErr } = await db.from('students').update({ external_id: learnerId }).eq('id', LEGACY_STUDENT_ID)
  if (bridgeErr) throw bridgeErr
  console.log('  ✅ bridged')

  console.log(`\n━━━ Bridged: legacy student ${LEGACY_STUDENT_ID} ↔ Core learner ${learnerId} ━━━`)
  console.log(`Blueprint URL: /student/blueprint/${learnerId}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
