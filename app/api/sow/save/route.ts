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
    // R3 — `lessons` previously had no minimum, so a payload claiming
    // `totalLessons: 9` with an empty `lessons` array was accepted and
    // stored as an `active` scheme with no lesson structure at all. That is
    // the live shape of one production scheme, and the Friday cron then read
    // it as a break week every week. A Scheme of Work without lessons is not
    // a Scheme of Work.
    lessons: z.array(z.record(z.string(), z.unknown())).min(1, 'A scheme must contain at least one lesson'),
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
    //
    // R3 — the normalized `scheme_lessons` rows are part of the save
    // contract, not an optimisation. Lesson Plan generation reads the JSON
    // copy, but Record of Work seeding falls back to `scheme_lessons`, and a
    // scheme missing them is structurally incomplete. This block used to
    // `console.error` and return success, so a Scheme could be reported
    // saved while its lesson structure was silently absent.
    //
    // Compensating rollback is safe here specifically because this route is
    // INSERT-only: it contains exactly two writes, both inserts, and no other
    // module writes `schemes_of_work`. The scheme deleted below can only ever
    // be the one this same request just created — never a teacher's
    // pre-existing work. If this route ever gains an update path, this
    // strategy must be revisited.
    {
      const lessonRows = lessons.map(l => ({
        scheme_id: schemeId,
        week: l.week,
        lesson: l.lesson,
        strand: l.strand,
        substrand: l.substrand,
        // Curriculum Identity Preservation Contract (H5A-2, CUR-SOW-001/002)
        // — the exact id selected upstream, or null. Never re-resolved here
        // from l.strand/l.substrand text.
        sub_strand_id: l.substrandId,
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

      const { data: insertedLessons, error: lessonsErr } = await db
        .from('scheme_lessons')
        .insert(lessonRows)
        .select('id')

      // Structural consistency check — the insert's own response is the
      // proof, so this costs no extra query.
      const persisted = insertedLessons?.length ?? 0

      if (lessonsErr || persisted !== lessonRows.length) {
        console.error(
          '[sow/save] scheme_lessons insert failed:',
          lessonsErr?.message ?? `persisted ${persisted} of ${lessonRows.length}`,
          { schemeId },
        )

        // Compensate: remove the header this request just created so no
        // structurally incomplete scheme survives. scheme_lessons cascades on
        // schemes_of_work deletion, so any partial rows go with it.
        const { error: rollbackErr } = await db.from('schemes_of_work').delete().eq('id', schemeId)
        if (rollbackErr) {
          console.error('[sow/save] rollback failed, scheme may be incomplete:', rollbackErr.message, { schemeId })
        }

        return apiError('Could not save the scheme’s lessons. Nothing was saved — please try again.')
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
