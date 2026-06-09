// POST: Return printable HTML for a single document type (SOW / LP / ROW)
// Body: { type: 'sow' | 'lp' | 'row', schemeId: string, fromWeek?: number }
// Returns: { html, marker: { lastWeek, totalWeeks, downloadedAt } }

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateSOWHtml } from '@/lib/sow/pdfGenerator'
import { generateLessonPlanHTML } from '@/lib/lessonPlan/pdfRenderer'
import { generateROWHTML } from '@/lib/row/pdfRenderer'
import type { SOWPreviewData, CurriculumMode } from '@/lib/sow/types'
import type { LessonPlanRecord } from '@/lib/lessonPlan/types'
import type { RecordOfWork, ROWEntry } from '@/lib/row/pdfRenderer'
import { z } from 'zod'

const BodySchema = z.object({
  type:      z.enum(['sow', 'lp', 'row']),
  schemeId:  z.string().uuid(),
  fromWeek:  z.number().int().positive().optional(),
})

type SOWRow = {
  id: string; school: string; grade: string; learning_area: string; term: number; year: number;
  curriculum_mode: string; total_lessons: number; total_weeks: number; lessons_per_week: number;
  teacher_name: string | null; tsc_number: string | null; textbook: string | null;
  average_confidence: number | null; lessons: unknown; breaks: unknown;
}

type PlanRow = {
  id: string; sow_id: string; teacher_id: string;
  week_number: number; lesson_number: number; strand: string; sub_strand: string;
  learning_outcomes: string[] | null; key_inquiry_questions: string[] | null;
  learning_resources: string[] | null; step_1: string | null; step_2: string | null;
  step_3: string | null; status: string; taught_date: string | null;
  organisation_of_learning: string | null; introduction: string | null;
  conclusion: string | null; extended_activities: string | null;
  reflection: string | null; generated_at: string; created_at: string;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest('Invalid request body')
    const { type, schemeId, fromWeek } = parsed.data

    // Fetch scheme + verify ownership
    const { data: sow, error: sowErr } = await db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, ' +
        'total_lessons, total_weeks, lessons_per_week, teacher_name, tsc_number, ' +
        'textbook, average_confidence, lessons, breaks'
      )
      .eq('id', schemeId)
      .eq('teacher_id', teacher.id)
      .single()

    if (sowErr || !sow) return apiForbidden()
    const s = sow as unknown as SOWRow

    let html = ''
    let maxWeekDownloaded: number | null = null
    let lpCount = 0

    // ── SOW ──────────────────────────────────────────────────────────────────────

    if (type === 'sow') {
      const previewData: SOWPreviewData = {
        meta: {
          school:           s.school || '',
          teacherName:      s.teacher_name || '',
          tscNumber:        s.tsc_number || '',
          grade:            s.grade,
          learningArea:     s.learning_area,
          term:             String(s.term),
          year:             s.year,
          textbook:         s.textbook || '',
          totalLessons:     s.total_lessons,
          totalWeeks:       s.total_weeks,
          lessonsPerWeek:   s.lessons_per_week,
          generatedDate:    new Date().toLocaleDateString('en-KE'),
          curriculumMode:   s.curriculum_mode as CurriculumMode,
          averageConfidence: s.average_confidence ?? 0.8,
        },
        lessons: (s.lessons as SOWPreviewData['lessons']) || [],
        breaks:  (s.breaks  as SOWPreviewData['breaks'])  || [],
      }
      html = generateSOWHtml(previewData)
      // SOW has no week concept — record total_weeks as the marker
      maxWeekDownloaded = s.total_weeks
    }

    // ── Lesson Plans ──────────────────────────────────────────────────────────────

    if (type === 'lp') {
      let lpQuery = db
        .from('lesson_plans')
        .select(
          'id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, ' +
          'learning_outcomes, key_inquiry_questions, learning_resources, ' +
          'organisation_of_learning, introduction, step_1, step_2, step_3, ' +
          'conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at'
        )
        .eq('sow_id', schemeId)
        .order('week_number')
        .order('lesson_number')

      if (fromWeek) lpQuery = lpQuery.gte('week_number', fromWeek) as typeof lpQuery

      const { data: plans } = await lpQuery

      if (!plans?.length) return apiError('No lesson plans found for this scheme', 404)

      const rows = plans as unknown as PlanRow[]
      lpCount = rows.length
      maxWeekDownloaded = Math.max(...rows.map(p => p.week_number))

      html = generateLessonPlanHTML(rows as unknown as LessonPlanRecord[], {
        teacherName:  s.teacher_name || '',
        tscNumber:    s.tsc_number || '',
        school:       s.school || '',
        learningArea: s.learning_area,
        grade:        s.grade,
        term:         s.term,
        year:         s.year,
      })
    }

    // ── Record of Work ────────────────────────────────────────────────────────────

    if (type === 'row') {
      let rowQuery = db
        .from('lesson_plans')
        .select(
          'week_number, lesson_number, strand, sub_strand, ' +
          'learning_outcomes, key_inquiry_questions, learning_resources, ' +
          'step_1, step_2, step_3, status'
        )
        .eq('sow_id', schemeId)
        .order('week_number')
        .order('lesson_number')

      if (fromWeek) rowQuery = rowQuery.gte('week_number', fromWeek) as typeof rowQuery

      const { data: plans } = await rowQuery

      type ShortPlanRow = {
        week_number: number; lesson_number: number; strand: string; sub_strand: string;
        learning_outcomes: string[] | null; key_inquiry_questions: string[] | null;
        learning_resources: string[] | null; step_1: string | null; step_2: string | null;
        step_3: string | null; status: string;
      }
      const rows = (plans || []) as unknown as ShortPlanRow[]
      lpCount = rows.length
      if (rows.length) maxWeekDownloaded = Math.max(...rows.map(p => p.week_number))

      const entries: ROWEntry[] = rows.map(p => ({
        week_number:           p.week_number,
        lesson_number:         p.lesson_number,
        strand:                p.strand,
        sub_strand:            p.sub_strand,
        learning_outcomes:     p.learning_outcomes ?? [],
        key_inquiry_questions: p.key_inquiry_questions ?? [],
        learning_resources:    p.learning_resources ?? [],
        activities_summary:    [p.step_1, p.step_2, p.step_3].filter(Boolean).join(' / '),
        objectives:            p.learning_outcomes ?? [],
        status:                p.status === 'taught' ? 'completed' : 'not_completed',
        remarks:               '',
        reflection:            '',
      }))

      const rowData: RecordOfWork = {
        teacher_name:  s.teacher_name || '',
        school:        s.school || '',
        grade:         s.grade,
        learning_area: s.learning_area,
        term:          s.term,
        year:          s.year,
        entries,
      }

      html = generateROWHTML(rowData)
    }

    // ── Upsert download marker ────────────────────────────────────────────────────

    const docType = type === 'lp' ? 'lesson_plans' : type
    const downloadedAt = new Date().toISOString()

    await db.from('document_downloads').upsert(
      {
        teacher_id:               teacher.id,
        scheme_id:                schemeId,
        document_type:            docType,
        last_week_downloaded:     maxWeekDownloaded,
        total_weeks:              s.total_weeks,
        lesson_count_at_download: lpCount || null,
        downloaded_at:            downloadedAt,
      },
      { onConflict: 'teacher_id,scheme_id,document_type' }
    )

    return apiSuccess({
      html,
      marker: {
        lastWeek:     maxWeekDownloaded,
        totalWeeks:   s.total_weeks,
        downloadedAt,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Document generation failed'
    console.error('[documents/download]', err)
    return apiError(msg)
  }
}
