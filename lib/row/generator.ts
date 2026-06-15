import { createServiceClient } from '@/utils/supabase/service'
import type { RecordOfWork, ROWEntry } from './pdfRenderer'

interface LessonPlanRow {
  week_number:   number
  lesson_number: number
  strand:        string
  sub_strand:    string
}

export async function buildRecordOfWork(
  sowId: string,
  weekNumber: number
): Promise<RecordOfWork> {
  const db = createServiceClient()

  const { data: plans, error: plansErr } = await db
    .from('lesson_plans')
    .select('week_number, lesson_number, strand, sub_strand')
    .eq('sow_id', sowId)
    .eq('week_number', weekNumber)
    .order('lesson_number', { ascending: true })

  if (plansErr) throw new Error(`Failed to fetch lesson plans: ${plansErr.message}`)
  if (!plans?.length) throw new Error(`No lesson plans for SOW ${sowId} week ${weekNumber}`)

  const { data: sow, error: sowErr } = await db
    .from('schemes_of_work')
    .select('teacher_id, school, grade, learning_area, term, year')
    .eq('id', sowId)
    .single()

  if (sowErr || !sow) throw new Error(`SOW not found: ${sowId}`)

  const { data: teacher } = await db
    .from('teachers')
    .select('full_name')
    .eq('id', sow.teacher_id)
    .maybeSingle()

  const entries: ROWEntry[] = (plans as LessonPlanRow[]).map(p => ({
    week_number:   p.week_number,
    lesson_number: p.lesson_number,
    strand:        p.strand,
    sub_strand:    p.sub_strand,
    work_done:     `${p.strand} — ${p.sub_strand}`,
    reflection:    '',
  }))

  return {
    teacher_name:  teacher?.full_name ?? '',
    school:        sow.school,
    grade:         sow.grade,
    learning_area: sow.learning_area,
    term:          sow.term,
    year:          sow.year,
    entries,
  }
}
