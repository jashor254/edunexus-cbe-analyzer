import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import BookletClient from './BookletClient'
import type { BookletLesson, BookletScheme, BreakItem } from './BookletClient'

export default async function BookletPage({
  params,
}: {
  params: Promise<{ scheme_id: string }>
}) {
  const { scheme_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!teacher) notFound()

  // Auth + scheme
  const { data: scheme } = await db
    .from('schemes_of_work')
    .select('id, school, learning_area, grade, term, year, teacher_name, tsc_number, textbook, breaks')
    .eq('id', scheme_id)
    .eq('teacher_id', teacher.id)
    .single()
  if (!scheme) notFound()

  // Lesson plans for this SOW
  const { data: lessonPlans } = await db
    .from('lesson_plans')
    .select('id, week_number, lesson_number, strand, sub_strand, step_1')
    .eq('sow_id', scheme_id)
    .order('week_number', { ascending: true })
    .order('lesson_number', { ascending: true })

  // Row entries — one ROW document per scheme, entries per lesson
  const { data: rowRecord } = await db
    .from('records_of_work')
    .select('id')
    .eq('scheme_id', scheme_id)
    .maybeSingle()

  type EntryRow = { week: number; lesson: number; date_taught: string | null; activities_summary: string[] | null; reflection: string | null }
  const entryMap = new Map<string, EntryRow>()

  if (rowRecord?.id) {
    const { data: entries } = await db
      .from('row_entries')
      .select('week, lesson, date_taught, activities_summary, reflection')
      .eq('row_id', rowRecord.id)

    for (const e of (entries ?? []) as EntryRow[]) {
      entryMap.set(`${e.week}:${e.lesson}`, e)
    }
  }

  const lessons: BookletLesson[] = (lessonPlans ?? []).map(lp => {
    const entry = entryMap.get(`${lp.week_number}:${lp.lesson_number}`) ?? null
    return {
      id:                 lp.id,
      week_number:        lp.week_number,
      lesson_number:      lp.lesson_number,
      strand:             lp.strand,
      sub_strand:         lp.sub_strand,
      step_1:             lp.step_1,
      date_taught:        entry?.date_taught ?? null,
      activities_summary: Array.isArray(entry?.activities_summary) ? entry.activities_summary : null,
      reflection:         entry?.reflection ?? null,
      is_taught:          !!entry,
    }
  })

  const breaks: BreakItem[] = Array.isArray(scheme.breaks)
    ? (scheme.breaks as BreakItem[])
    : []

  const bookletScheme: BookletScheme = {
    id:            scheme.id,
    school:        scheme.school ?? '',
    learning_area: scheme.learning_area,
    grade:         scheme.grade,
    term:          scheme.term,
    year:          scheme.year,
    teacher_name:  scheme.teacher_name ?? '',
    tsc_number:    scheme.tsc_number ?? '',
    textbook:      scheme.textbook ?? '',
  }

  const totalLessons  = lessons.length
  const taughtLessons = lessons.filter(l => l.is_taught).length

  return (
    <BookletClient
      scheme={bookletScheme}
      lessons={lessons}
      breaks={breaks}
      totalLessons={totalLessons}
      taughtLessons={taughtLessons}
    />
  )
}
