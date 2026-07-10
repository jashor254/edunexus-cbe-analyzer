// scripts/reference-school/03-seed-staff.ts
//
// Creates 48 teaching/administrative staff for Mwatate Ridge Senior School.
// Each requires a real (throwaway) Supabase Auth account — `school_users`
// enforces `user_id NOT NULL REFERENCES auth.users(id)`. Emails use the
// @mwatateridge.ac.ke.example domain (RFC 2606 .example TLD — guaranteed
// never to resolve), so nothing here can ever deliver to a real inbox.
//
// Role mapping onto the schema's fixed `school_users.role` CHECK constraint
// (school_admin | headteacher | deputy_headteacher | teacher | parent) —
// docs/reference-school/01-school-profile-and-structure.md's finer-grained
// role catalogue (Dean of Studies, HoD, Career Coordinator, etc.) doesn't
// have dedicated schema columns; this seed maps every such role onto the
// closest available bucket rather than extending the schema for titles that
// have no behavioral difference in the Core system yet.
//
// Run: npx tsx scripts/reference-school/03-seed-staff.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, AUTH_EMAIL_DOMAIN, randomFullName, randomPhone, rand } from './shared'
import { seedAcademics } from './02-seed-academics'

type StaffRole = 'headteacher' | 'deputy_headteacher' | 'school_admin' | 'teacher'

type StaffPlan = { title: string; role: StaffRole }

// 1 Principal + 2 DPs + 6 admin-support + 39 teaching staff = 48
const STAFF_PLAN: StaffPlan[] = [
  { title: 'Principal', role: 'headteacher' },
  { title: 'Deputy Principal - Academics', role: 'deputy_headteacher' },
  { title: 'Deputy Principal - Administration', role: 'deputy_headteacher' },
  { title: 'Dean of Studies', role: 'school_admin' },
  { title: 'Examinations Officer', role: 'school_admin' },
  { title: 'Finance Officer', role: 'school_admin' },
  { title: 'Admissions Officer', role: 'school_admin' },
  { title: 'ICT Administrator', role: 'school_admin' },
  { title: 'School Secretary', role: 'school_admin' },
  ...Array.from({ length: 39 }, () => ({ title: 'Subject Teacher', role: 'teacher' as StaffRole })),
]

export async function seedStaff() {
  const supabase = db()
  const academics = await seedAcademics()
  const { schoolId, classIds, subjects } = academics

  const { data: existingUsers } = await supabase
    .from('school_users')
    .select('id, role, user_id')
    .eq('school_id', schoolId)

  if (existingUsers && existingUsers.length >= STAFF_PLAN.length) {
    console.log(`[staff] already seeded: ${existingUsers.length} school_users`)
    const teacherPoolIds = existingUsers.filter((u) => u.role === 'teacher').map((u) => u.id).sort()
    const teacherBySubject: Record<string, string> = {}
    subjects.forEach((s, idx) => { teacherBySubject[s.id] = teacherPoolIds[idx % teacherPoolIds.length] })
    return { ...academics, teacherPoolIds, teacherBySubject }
  }

  const createdSchoolUsers: { id: string; role: StaffRole; title: string }[] = []

  for (let i = 0; i < STAFF_PLAN.length; i++) {
    const plan = STAFF_PLAN[i]
    const gender = i % 2 === 0 ? 'male' : 'female'
    const { first, last } = randomFullName(gender)
    const fullName = `${first} ${last}`
    const email = `staff${String(i + 1).padStart(3, '0')}@${AUTH_EMAIL_DOMAIN}`

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: `RefSchool!${Math.random().toString(36).slice(2, 10)}`,
      email_confirm: true,
      user_metadata: { full_name: fullName, reference_school: true, title: plan.title },
    })
    if (authErr) throw authErr

    const { data: schoolUser, error: suErr } = await supabase
      .from('school_users')
      .insert({
        school_id: schoolId,
        user_id: authUser.user.id,
        role: plan.role,
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (suErr) throw suErr

    createdSchoolUsers.push({ id: schoolUser.id, role: plan.role, title: plan.title })
  }
  console.log(`[staff] created: ${createdSchoolUsers.length} school_users (with auth accounts)`)

  const teacherPool = createdSchoolUsers.filter((s) => s.role === 'teacher')
  const teacherPoolIds = teacherPool.map((t) => t.id)

  // One primary teacher per subject (teaches that subject across all classes offering it)
  const teacherBySubject: Record<string, string> = {}
  subjects.forEach((s, idx) => {
    teacherBySubject[s.id] = teacherPool[idx % teacherPool.length].id
  })

  // Assign 9 of the subject teachers as Class Teachers (dual-hatted, per Module 4)
  const classIdList = Object.values(classIds)
  for (let i = 0; i < classIdList.length; i++) {
    const classTeacherId = teacherPool[i % teacherPool.length].id
    const { error } = await supabase
      .from('classes')
      .update({ class_teacher_id: classTeacherId })
      .eq('id', classIdList[i])
    if (error) throw error
  }
  console.log(`[classes] class_teacher_id assigned for ${classIdList.length} classes`)

  // class_subjects: every class offers every senior subject, taught by that subject's primary teacher
  const classSubjectRows = Object.values(classIds).flatMap((classId) =>
    subjects.map((s) => ({
      school_id: schoolId,
      class_id: classId,
      subject_id: s.id,
      teacher_id: teacherBySubject[s.id],
    }))
  )
  const { error: csErr } = await supabase
    .from('class_subjects')
    .upsert(classSubjectRows, { onConflict: 'class_id,subject_id', ignoreDuplicates: true })
  if (csErr) throw csErr
  console.log(`[class_subjects] ready: ${classSubjectRows.length} rows`)

  return { ...academics, teacherPoolIds, teacherBySubject }
}

if (require.main === module) {
  seedStaff().then((r) => console.log('[done]', { teachers: r.teacherPoolIds.length })).catch((e) => { console.error(e); process.exit(1) })
}
