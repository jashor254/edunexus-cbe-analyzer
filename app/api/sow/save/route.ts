// app/api/sow/save/route.ts
// POST: Save a completed Scheme of Work to the database

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import type { SOWPreviewData } from '@/lib/sow/types'

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    // ── Parse body ────────────────────────────────────────────────────────────
    const { schemeData }: { schemeData: SOWPreviewData } = await req.json()

    if (!schemeData?.meta) return apiBadRequest('Missing schemeData')

    const { meta, lessons, breaks } = schemeData

    // ── Insert scheme record ──────────────────────────────────────────────────
    const { data: scheme, error: schemeErr } = await db
      .from('schemes_of_work')
      .insert({
        teacher_id: teacher.id,
        school: meta.school,
        grade: meta.grade,
        learning_area: meta.learningArea,
        term: meta.term,
        year: meta.year,
        textbook: meta.textbook || null,
        curriculum_mode: meta.curriculumMode,
        total_lessons: meta.totalLessons,
        total_weeks: meta.totalWeeks,
        average_confidence: meta.averageConfidence,
        breaks: breaks,
        status: 'saved',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (schemeErr) {
      console.error('[sow/save] scheme insert error:', schemeErr)
      return apiError('Failed to save scheme: ' + schemeErr.message)
    }

    const schemeId = scheme.id

    // ── Insert lessons ────────────────────────────────────────────────────────
    if (lessons.length > 0) {
      const lessonRows = lessons.map(l => ({
        scheme_id: schemeId,
        week: l.week,
        lesson: l.lesson,
        strand: l.strand,
        substrand: l.substrand,
        learning_outcomes: l.learningOutcomes,
        learning_experiences: l.learningExperiences,
        key_inquiry_questions: l.keyInquiryQuestions,
        learning_resources: l.learningResources,
        assessment_methods: l.assessmentMethods,
        core_competencies: l.coreCompetencies,
        values: l.values,
        pci_links: l.pciLinks,
        reflection: l.reflection || '',
        confidence: l._confidence,
      }))

      const { error: lessonsErr } = await db
        .from('scheme_lessons')
        .insert(lessonRows)

      if (lessonsErr) {
        console.error('[sow/save] lessons insert error:', lessonsErr)
        // Don't fail the whole request — scheme was saved
      }
    }

    return apiSuccess({ schemeId })
  } catch (err: any) {
    console.error('[sow/save]', err)
    return apiError(err.message || 'Save failed')
  }
}
