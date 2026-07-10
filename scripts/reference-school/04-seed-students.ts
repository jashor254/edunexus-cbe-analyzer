// scripts/reference-school/04-seed-students.ts
//
// Creates learners (students) + their guardians + class enrollments.
//
// Reconciles a discrepancy in the frozen Module 1 doc: it named an
// illustrative population of "960 students," but Module 2's frozen class
// capacity rule caps each class at 45, and this school has 9 classes
// (3 grades x 3 streams) — 9 x 45 = 405 is the actual capacity-respecting
// full-enrollment ceiling. Rather than seed every class at ~2x its stated
// capacity (which would make "flagged exception" the universal case
// instead of the occasional one Module 2 describes), this seed fills the
// school to its real full capacity: 405 students. No frozen doc is edited
// to reflect this — this is an implementation-time reconciliation, noted
// here for anyone reading the seed later.
//
// No auth accounts needed — `learners` has no user_id column at all.
//
// Run: npx tsx scripts/reference-school/04-seed-students.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, randomFullName, randomPhone, randomDob, rand, chunk } from './shared'
import { seedStaff } from './03-seed-staff'

const STUDENTS_PER_CLASS = 45
const GUARDIAN_RELATIONSHIPS = ['father', 'mother', 'guardian', 'grandparent'] as const
const GRADE_AGE_RANGE: Record<string, [number, number]> = {
  G10: [15, 16],
  G11: [16, 17],
  G12: [17, 18],
}

export async function seedStudents() {
  const supabase = db()
  const ctx = await seedStaff()
  const { schoolId, classIds, termIds, academicYearId } = ctx

  const { count: existingCount } = await supabase
    .from('learners')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if ((existingCount ?? 0) >= Object.keys(classIds).length * STUDENTS_PER_CLASS) {
    console.log(`[learners] already seeded: ${existingCount} learners`)
    return ctx
  }

  const currentTermId = termIds[2] // Term 2 2026 is_current per seed-school.ts
  let admissionSeq = 1
  let totalLearners = 0
  let totalGuardians = 0
  let totalEnrollments = 0

  for (const [classKey, classId] of Object.entries(classIds)) {
    const gradeCode = classKey.split('-')[0]
    const [minAge, maxAge] = GRADE_AGE_RANGE[gradeCode]

    const learnerRows = Array.from({ length: STUDENTS_PER_CLASS }, (_, i) => {
      const gender: 'male' | 'female' = i % 2 === 0 ? 'male' : 'female'
      const { first, last } = randomFullName(gender)
      const admissionNumber = `MR2026-${String(admissionSeq++).padStart(4, '0')}`
      return {
        school_id: schoolId,
        admission_number: admissionNumber,
        first_name: first,
        last_name: last,
        date_of_birth: randomDob(minAge, maxAge),
        gender,
        nationality: 'Kenyan',
        status: 'active' as const,
        admission_date: '2026-01-06',
      }
    })

    const { data: insertedLearners, error: learnerErr } = await supabase
      .from('learners')
      .insert(learnerRows)
      .select('id, admission_number, first_name, last_name')
    if (learnerErr) throw learnerErr
    totalLearners += insertedLearners.length

    const guardianRows = insertedLearners.map((l) => {
      const relationship = rand(GUARDIAN_RELATIONSHIPS)
      const guardianGender: 'male' | 'female' = relationship === 'father' ? 'male' : relationship === 'mother' ? 'female' : rand(['male', 'female'] as const)
      const { first, last } = randomFullName(guardianGender)
      return {
        school_id: schoolId,
        learner_id: l.id,
        user_id: null,
        relationship,
        full_name: `${first} ${last}`,
        phone: randomPhone(),
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        is_primary: true,
        can_receive_reports: true,
      }
    })
    const { error: guardianErr } = await supabase.from('learner_guardians').insert(guardianRows)
    if (guardianErr) throw guardianErr
    totalGuardians += guardianRows.length

    const enrollmentRows = insertedLearners.map((l) => ({
      school_id: schoolId,
      learner_id: l.id,
      class_id: classId,
      term_id: currentTermId,
      academic_year_id: academicYearId,
      enrollment_date: '2026-01-06',
      status: 'active' as const,
    }))
    const { error: enrollErr } = await supabase.from('learner_enrollments').insert(enrollmentRows)
    if (enrollErr) throw enrollErr
    totalEnrollments += enrollmentRows.length

    console.log(`[${classKey}] ${insertedLearners.length} learners, ${guardianRows.length} guardians, ${enrollmentRows.length} enrollments`)
  }

  console.log(`[students] total: ${totalLearners} learners, ${totalGuardians} guardians, ${totalEnrollments} enrollments`)
  return ctx
}

if (require.main === module) {
  seedStudents().then(() => console.log('[done]')).catch((e) => { console.error(e); process.exit(1) })
}
