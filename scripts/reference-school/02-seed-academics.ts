// scripts/reference-school/02-seed-academics.ts
//
// Creates the 9 Classes (Grade 10/11/12 x East/West/Central) and the
// grade_subjects catalogue (compulsory + elective) for each Senior grade,
// per docs/reference-school/02-academic-structure.md's frozen decision that
// every stream offers the full subject catalogue for its grade (streams are
// pathway-neutral — pathway is a per-student attribute, assigned later at
// enrollment, not modeled as a stream property).
//
// Run: npx tsx scripts/reference-school/02-seed-academics.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db } from './shared'
import { seedSchool } from './01-seed-school'

const CLASS_CAPACITY = 45
const SENIOR_GRADE_CODES = ['G10', 'G11', 'G12'] as const

export async function seedAcademics() {
  const supabase = db()
  const { schoolId, academicYearId, streamIds, termIds } = await seedSchool()

  const { data: grades, error: gradeErr } = await supabase
    .from('grades')
    .select('id, code, name')
    .in('code', SENIOR_GRADE_CODES as unknown as string[])
  if (gradeErr) throw gradeErr
  const gradeByCode = Object.fromEntries((grades ?? []).map((g) => [g.code, g]))

  const { data: subjects, error: subjErr } = await supabase
    .from('subjects')
    .select('id, code, is_core')
    .eq('category', 'senior_secondary')
  if (subjErr) throw subjErr
  if (!subjects || subjects.length === 0) throw new Error('No senior_secondary subjects found — run the senior_secondary_grades migration first')

  // ── Classes: one per (grade x stream) ──────────────────────────────────────
  const classIds: Record<string, string> = {} // key: "G10-East"
  for (const code of SENIOR_GRADE_CODES) {
    const grade = gradeByCode[code]
    for (const [streamName, streamId] of Object.entries(streamIds)) {
      const key = `${code}-${streamName}`
      const displayName = `${grade.name} ${streamName}`

      const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('grade_id', grade.id)
        .eq('stream_id', streamId)
        .eq('academic_year_id', academicYearId)
        .maybeSingle()

      if (existing) {
        classIds[key] = existing.id
        continue
      }
      const { data: cls, error } = await supabase
        .from('classes')
        .insert({
          school_id: schoolId,
          grade_id: grade.id,
          stream_id: streamId,
          academic_year_id: academicYearId,
          display_name: displayName,
          capacity: CLASS_CAPACITY,
        })
        .select('id')
        .single()
      if (error) throw error
      classIds[key] = cls.id
    }
  }
  console.log(`[classes] ready: ${Object.keys(classIds).length} classes`)

  // ── Grade subjects: every senior grade offers the full subject catalogue ──
  // (compulsory subjects mandatory for all; electives available, selection
  // itself is a per-student fact recorded at enrollment time, not here)
  let gradeSubjectCount = 0
  for (const code of SENIOR_GRADE_CODES) {
    const grade = gradeByCode[code]
    const rows = subjects.map((s) => ({
      school_id: schoolId,
      grade_id: grade.id,
      subject_id: s.id,
      is_compulsory: s.is_core,
    }))
    const { error } = await supabase
      .from('grade_subjects')
      .upsert(rows, { onConflict: 'school_id,grade_id,subject_id', ignoreDuplicates: true })
    if (error) throw error
    gradeSubjectCount += rows.length
  }
  console.log(`[grade_subjects] ready: ${gradeSubjectCount} rows (${subjects.length} subjects x ${SENIOR_GRADE_CODES.length} grades)`)

  return { schoolId, academicYearId, termIds, streamIds, gradeByCode, subjects, classIds }
}

if (require.main === module) {
  seedAcademics().then((r) => console.log('[done]', { classes: Object.keys(r.classIds).length })).catch((e) => { console.error(e); process.exit(1) })
}
