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
import { z } from 'zod'
import { publishEvent } from '@/lib/events'

const SaveSOWSchema = z.object({
  schemeData: z.object({
    meta: z.object({
      school:          z.string().min(1),
      grade:           z.number().int().min(1).max(12),
      learningArea:    z.string().min(1),
      term:            z.number().int().min(1).max(3),
      year:            z.number().int().min(2020).max(2100),
      totalLessons:    z.number().int().min(1),
      totalWeeks:      z.number().int().min(1),
      curriculumMode:  z.string().min(1),
      textbook:        z.string().optional(),
      lessonsPerWeek:  z.number().int().min(1).max(10).optional(),
      averageConfidence: z.number().optional(),
      teacherName:     z.string().optional(),
      tscNumber:       z.string().optional(),
    }),
    lessons: z.array(z.record(z.string(), z.unknown())),
    breaks:  z.array(z.record(z.string(), z.unknown())),
  }),
})

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
    const rawBody: unknown = await req.json()
    const parsed = SaveSOWSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiBadRequest(parsed.error.message ?? 'Invalid request body')
    }
    // Cast through unknown — Zod validates structure, SOWPreviewData adds domain-specific types
    const { schemeData } = parsed.data as unknown as { schemeData: SOWPreviewData }

    const { meta, lessons, breaks } = schemeData

    // timeline: flat array of {week, lesson, isBreak} slots derived from lessons + breaks.
    // weeklyGenerator reads this to know which weeks are teaching vs break weeks.
    const teachingSlots = lessons.map(l => ({ week: l.week, lesson: l.lesson, isBreak: false }))
    const breakSlots = breaks.flatMap(b => {
      const slots = []
      for (let w = b.startWeek; w <= b.endWeek; w++) {
        slots.push({ week: w, lesson: 0, isBreak: true })
      }
      return slots
    })
    const timeline = [...teachingSlots, ...breakSlots].sort((a, b) =>
      a.week !== b.week ? a.week - b.week : a.lesson - b.lesson
    )

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
        lessons_per_week: meta.lessonsPerWeek ?? 4,
        average_confidence: meta.averageConfidence,
        breaks,
        lessons,
        timeline,
        teacher_name: meta.teacherName || null,
        tsc_number: meta.tscNumber || null,
        status: 'active',
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
        reflection: l.reflection || '',
        // pci_links and confidence are preserved in schemes_of_work.lessons JSONB
      }))

      const { error: lessonsErr } = await db
        .from('scheme_lessons')
        .insert(lessonRows)

      if (lessonsErr) {
        console.error('[sow/save] scheme_lessons insert error:', lessonsErr.message)
      }
    }

    void publishEvent({
      event_type:      'teacher.sow.generated',
      resource_type:   'scheme_of_work',
      resource_id:     schemeId,
      actor_id:        teacher.id,
      payload: {
        sow_id:          schemeId,
        title:           meta.learningArea,
        subject:         meta.learningArea,
        grade:           String(meta.grade),
        term:            String(meta.term),
        weeks:           meta.totalWeeks,
        curriculum_type: meta.curriculumMode,
      },
      idempotency_key: `teacher.sow.generated:${schemeId}`,
    }).catch(err => console.error('[events] teacher.sow.generated:', err instanceof Error ? err.message : String(err)))

    return apiSuccess({ schemeId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    console.error('[sow/save]', err)
    return apiError(message)
  }
}
