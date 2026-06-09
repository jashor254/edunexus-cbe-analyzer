// POST: Generate a merged PDF containing SOW / Lesson Plans / ROW for selected schemes
// Body: { schemeIds: string[], include: { sow: boolean, lessonPlans: boolean, recordOfWork: boolean } }

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiUnauthorized, apiForbidden, apiBadRequest, apiError } from '@/lib/api/response'
import { generateBulkExportPDF } from '@/lib/documents/bulkExportPdf'
import type { SchemeMeta, ExportScheme } from '@/lib/documents/bulkExportPdf'
import type { LessonPlanRecord } from '@/lib/lessonPlan/types'
import { z } from 'zod'

const BodySchema = z.object({
  schemeIds: z.array(z.string().uuid()).min(1).max(20),
  include: z.object({
    sow: z.boolean(),
    lessonPlans: z.boolean(),
    recordOfWork: z.boolean(),
  }),
})

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
    const { schemeIds, include } = parsed.data

    // Fetch schemes and verify ownership
    const { data: schemes, error: schemesErr } = await db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, ' +
        'total_lessons, total_weeks, teacher_name, tsc_number, lessons'
      )
      .in('id', schemeIds)
      .eq('teacher_id', teacher.id)

    if (schemesErr || !schemes?.length) return apiForbidden()

    // Fetch lesson plans for all schemes in parallel
    const exportSchemes: ExportScheme[] = await Promise.all(
      (schemes as unknown as SchemeMeta[]).map(async (sow) => {
        const { data: plans } = await db
          .from('lesson_plans')
          .select(
            'id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, ' +
            'learning_outcomes, key_inquiry_questions, learning_resources, ' +
            'organisation_of_learning, introduction, step_1, step_2, step_3, ' +
            'conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at'
          )
          .eq('sow_id', sow.id)
          .order('week_number')
          .order('lesson_number')

        return {
          meta: sow,
          lessonPlans: (plans ?? []) as unknown as LessonPlanRecord[],
        }
      })
    )

    const buffer = await generateBulkExportPDF(exportSchemes, include)

    // ── Upsert download markers ──────────────────────────────────────────────────

    const downloadedAt = new Date().toISOString()

    const upsertRows = exportSchemes.flatMap(({ meta, lessonPlans }) => {
      const maxWeek = lessonPlans.length
        ? Math.max(...lessonPlans.map(p => p.week_number))
        : null
      const lpCount = lessonPlans.length

      const rows: object[] = []

      if (include.sow) {
        rows.push({
          teacher_id: teacher.id, scheme_id: meta.id,
          document_type: 'sow',
          last_week_downloaded: meta.total_weeks,
          total_weeks: meta.total_weeks,
          lesson_count_at_download: null,
          downloaded_at: downloadedAt,
        })
      }
      if (include.lessonPlans) {
        rows.push({
          teacher_id: teacher.id, scheme_id: meta.id,
          document_type: 'lesson_plans',
          last_week_downloaded: maxWeek,
          total_weeks: meta.total_weeks,
          lesson_count_at_download: lpCount || null,
          downloaded_at: downloadedAt,
        })
      }
      if (include.recordOfWork) {
        rows.push({
          teacher_id: teacher.id, scheme_id: meta.id,
          document_type: 'row',
          last_week_downloaded: maxWeek,
          total_weeks: meta.total_weeks,
          lesson_count_at_download: lpCount || null,
          downloaded_at: downloadedAt,
        })
      }
      // Bundle marker: always when doing a multi-type export
      if ((include.sow ? 1 : 0) + (include.lessonPlans ? 1 : 0) + (include.recordOfWork ? 1 : 0) > 1) {
        rows.push({
          teacher_id: teacher.id, scheme_id: meta.id,
          document_type: 'bundle',
          last_week_downloaded: maxWeek ?? meta.total_weeks,
          total_weeks: meta.total_weeks,
          lesson_count_at_download: lpCount || null,
          downloaded_at: downloadedAt,
        })
      }

      return rows
    })

    if (upsertRows.length) {
      await db.from('document_downloads').upsert(upsertRows, {
        onConflict: 'teacher_id,scheme_id,document_type',
      })
    }

    // Build filename
    const single = exportSchemes.length === 1
    const m = exportSchemes[0].meta
    const filename = single
      ? `EduNexus_${m.learning_area.replace(/\s+/g, '_')}_${m.grade.replace(/\s+/g, '_')}_T${m.term}_${m.year}.pdf`
      : `EduNexus_Documents_T${m.term}_${m.year}.pdf`

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed'
    console.error('[documents/bulk-export]', err)
    return apiError(msg)
  }
}
