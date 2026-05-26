import { createServiceClient } from '@/utils/supabase/service'
import type { RecordOfWork, ROWEntry } from './pdfRenderer'

interface LessonPlanRow {
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  learning_outcomes: string[]
  key_inquiry_questions: string[]
  learning_resources: string[]
  step_1: string | null
  step_2: string | null
  step_3: string | null
  status: string
}

export async function buildRecordOfWork(
  sowId: string,
  weekNumber: number
): Promise<RecordOfWork> {
  const db = createServiceClient()

  const { data: plans, error: plansErr } = await db
    .from('lesson_plans')
    .select('week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, step_1, step_2, step_3, status')
    .eq('sow_id', sowId)
    .eq('week_number', weekNumber)
    .order('lesson_number', { ascending: true })

  if (plansErr) throw new Error(`Failed to fetch lesson plans: ${plansErr.message}`)
  if (!plans?.length) throw new Error(`No lesson plans for SOW ${sowId} week ${weekNumber}`)

  const { data: sow, error: sowErr } = await db
    .from('schemes_of_work')
    .select('teacher_id, school, grade_name, learning_area, term, year')
    .eq('id', sowId)
    .single()

  if (sowErr || !sow) throw new Error(`SOW not found: ${sowId}`)

  const { data: teacher } = await db
    .from('teachers')
    .select('full_name, tsc_number')
    .eq('id', sow.teacher_id)
    .maybeSingle()

  const entries: ROWEntry[] = (plans as LessonPlanRow[]).map(p => ({
    week_number: p.week_number,
    lesson_number: p.lesson_number,
    strand: p.strand,
    sub_strand: p.sub_strand,
    learning_outcomes: p.learning_outcomes ?? [],
    key_inquiry_questions: p.key_inquiry_questions ?? [],
    learning_resources: p.learning_resources ?? [],
    activities_summary: [p.step_1, p.step_2, p.step_3].filter((s): s is string => !!s),
    status: 'completed',
    remarks: '',
  }))

  return {
    teacher_name: teacher?.full_name ?? '',
    tsc_number: teacher?.tsc_number ?? '',
    school: sow.school,
    grade: sow.grade_name,
    learning_area: sow.learning_area,
    term: sow.term,
    year: sow.year,
    entries,
  }
}
