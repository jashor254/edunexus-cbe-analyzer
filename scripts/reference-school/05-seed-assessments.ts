// scripts/reference-school/05-seed-assessments.ts
//
// Seeds one Term 2 Mathematics CAT per class, with marks for every enrolled
// learner — a small, realistic sample (not the full Assessment module from
// docs/reference-school/07-assessment.md) proving the real assessment
// pipeline (class_assessments + learner_marks) works end-to-end against the
// Reference School's data, ready for the intelligence layer to read.
//
// KNOWN GAP (found while building this seed, not fixed here): `class_assessments
// .class_id` has a live FK constraint pointing at the legacy `teacher_classes`
// table, not Core's `classes` table — even though `lib/core/assessments.ts`
// is written as if it targets Core classes. The Core assessment pipeline
// isn't actually wired to the Core schema yet. This script detects that FK
// violation and skips assessment seeding rather than patching the
// constraint as a side effect of a seed script — that's a platform decision,
// not something to make unilaterally here.
//
// Run: npx tsx scripts/reference-school/05-seed-assessments.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, randInt } from './shared'
import { seedStudents } from './04-seed-students'

const MATH_SUBJECT_CODE = 'SS-MATH'
const MAX_SCORE = 100

export async function seedAssessments() {
  const supabase = db()
  const ctx = await seedStudents()
  const { classIds, teacherBySubject, subjects, termIds } = ctx

  const mathSubject = subjects.find((s) => s.code === MATH_SUBJECT_CODE)
  if (!mathSubject) throw new Error('Mathematics subject not found')
  const mathTeacherId = teacherBySubject[mathSubject.id]

  const { count: existingAssessments } = await supabase
    .from('class_assessments')
    .select('id', { count: 'exact', head: true })
    .in('class_id', Object.values(classIds))

  if ((existingAssessments ?? 0) >= Object.keys(classIds).length) {
    console.log(`[assessments] already seeded: ${existingAssessments} class_assessments`)
    return ctx
  }

  let totalMarks = 0
  for (const [classKey, classId] of Object.entries(classIds)) {
    const { data: assessment, error: assessErr } = await supabase
      .from('class_assessments')
      .insert({
        class_id: classId,
        teacher_id: mathTeacherId,
        title: 'Mathematics Term 2 CAT 1',
        assessment_type: 'cat',
        term: '2',
        year: 2026,
        max_score: MAX_SCORE,
        subjects: [MATH_SUBJECT_CODE],
        curriculum_type: 'cbc',
        weight_percent: 30,
        grading_type: 'both',
        is_published: true,
      })
      .select('id')
      .single()
    if (assessErr) {
      if (assessErr.code === '23503' && assessErr.message.includes('class_assessments_class_id_fkey')) {
        console.warn(
          '[assessments] SKIPPED: class_assessments.class_id FKs to legacy teacher_classes, not Core classes. ' +
          'This is a platform gap (Core assessment pipeline not wired up), not something this seed script fixes. ' +
          'School/academics/staff/students are still fully seeded.'
        )
        return ctx
      }
      throw assessErr
    }

    const { data: enrolled, error: enrollErr } = await supabase
      .from('learner_enrollments')
      .select('learner_id, learners(id, first_name, last_name, admission_number)')
      .eq('class_id', classId)
      .eq('term_id', termIds[2])
    if (enrollErr) throw enrollErr

    const markRows = (enrolled ?? []).map((e) => {
      const learner = e.learners as unknown as { id: string; first_name: string; last_name: string; admission_number: string }
      const score = randInt(35, 98)
      const cbcLevel = score >= 80 ? 'EE' : score >= 60 ? 'ME' : score >= 40 ? 'AE' : 'BE'
      return {
        assessment_id: assessment.id,
        class_id: classId,
        teacher_id: mathTeacherId,
        student_id: learner.id,
        student_name: `${learner.first_name} ${learner.last_name}`,
        admission_number: learner.admission_number,
        subject_scores: { [MATH_SUBJECT_CODE]: score },
        total_marks: score,
        mean_score: score,
        mean_grade: cbcLevel,
      }
    })
    const { error: marksErr } = await supabase.from('learner_marks').insert(markRows)
    if (marksErr) throw marksErr
    totalMarks += markRows.length
    console.log(`[${classKey}] assessment + ${markRows.length} marks`)
  }

  console.log(`[assessments] total: ${Object.keys(classIds).length} assessments, ${totalMarks} marks`)
  return ctx
}

if (require.main === module) {
  seedAssessments().then(() => console.log('[done]')).catch((e) => { console.error(e); process.exit(1) })
}
