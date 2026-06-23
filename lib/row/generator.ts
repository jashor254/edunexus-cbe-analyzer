import { createServiceClient } from '@/utils/supabase/service'
import type { RecordOfWork, ROWEntry } from './pdfRenderer'
import { toTitleCase, firstSentence } from '@/lib/utils/formatters'

interface LessonPlanRow {
  week_number:             number
  lesson_number:           number
  taught_date:             string | null
  strand:                  string
  sub_strand:              string
  step_1:                  string | null
  teacher_self_evaluation: string | null
}

export async function buildRecordOfWork(
  sowId: string,
  weekNumber: number
): Promise<RecordOfWork> {
  const db = createServiceClient()

  const { data: plans, error: plansErr } = await db
    .from('lesson_plans')
    .select('week_number, lesson_number, taught_date, strand, sub_strand, step_1, teacher_self_evaluation')
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

  // Pull weekly_intelligence.teacher_note as fallback reflection for lessons
  // without a personal teacher_self_evaluation
  const { data: weeklyIntel } = await db
    .from('weekly_intelligence')
    .select('teacher_note')
    .eq('sow_id', sowId)
    .eq('week_number', weekNumber)
    .maybeSingle()

  const weekFallback = weeklyIntel?.teacher_note ?? ''

  const entries: ROWEntry[] = (plans as LessonPlanRow[]).map(p => ({
    week_number:   p.week_number,
    lesson_number: p.lesson_number,
    date_taught:   p.taught_date,
    strand:        p.strand,
    sub_strand:    p.sub_strand,
    work_done:     firstSentence(p.step_1) || p.sub_strand,
    reflection:    p.teacher_self_evaluation ?? weekFallback,
  }))

  return {
    teacher_name:  toTitleCase(teacher?.full_name ?? ''),
    school:        toTitleCase(sow.school),
    grade:         sow.grade,
    learning_area: sow.learning_area,
    term:          sow.term,
    year:          sow.year,
    entries,
  }
}
