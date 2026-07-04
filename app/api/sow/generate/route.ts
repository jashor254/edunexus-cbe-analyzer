// app/api/sow/generate/route.ts
// POST: Generate a full Scheme of Work via DeepSeek AI

import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { type FeatureKey } from '@/lib/payments/config'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'

const FEATURE: FeatureKey = 'sow_generate'

const GenerateSOWSchema = z.object({
  context: z.object({
    learningArea:   z.string().min(1),
    grade:          z.union([z.string(), z.number()]),
    curriculumMode: z.string().min(1),
  }).passthrough(),
  lessonStructure: z.object({
    lessonsPerWeek: z.number().int().min(1).optional(),
  }).passthrough().optional(),
  selectedSubstrands: z.array(z.unknown()).min(1),
  breaks: z.array(z.unknown()).optional().default([]),
  timeline: z.array(z.unknown()).optional(),
})
import { buildTermSchedule } from '@/lib/sow/termSchedule'
import { applyBreaksToSchedule } from '@/lib/sow/breakEngine'
import { generateSchemePipeline } from '@/lib/sow/lessonPipeline'
import type {
  SOWContext,
  LessonStructure,
  SelectedSubstrand,
  BreakItem,
  TimelineSlot,
} from '@/lib/sow/types'
import type { BreakWithSlots } from '@/lib/sow/breakEngine'
import { weekLessonToSlot } from '@/lib/sow/termSchedule'

export async function POST(req: Request) {
  try {
    // ── Access check ──────────────────────────────────────────────────────────
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const rateLimit = await checkDailyCallLimit(access.userId, FEATURE)
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} SOW generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

    // ── Verify teacher record (needed for teacher_id FK in downstream queries) ─
    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', access.userId)
      .single()

    if (!teacher) return apiForbidden()

    // ── Parse body ────────────────────────────────────────────────────────────
    const parsed = GenerateSOWSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const {
      context,
      lessonStructure,
      selectedSubstrands,
      breaks,
      timeline: prebuiltTimeline,
    } = parsed.data as unknown as {
      context: SOWContext
      lessonStructure?: LessonStructure
      selectedSubstrands: SelectedSubstrand[]
      breaks?: BreakItem[]
      timeline?: TimelineSlot[]
    }

    // ── Build or use pre-built timeline ───────────────────────────────────────
    let timeline: TimelineSlot[]

    if (prebuiltTimeline?.length) {
      timeline = prebuiltTimeline
    } else {
      if (!lessonStructure?.lessonsPerWeek) return apiBadRequest('Missing lessonStructure.lessonsPerWeek')

      const termSchedule = buildTermSchedule({
        lessonsPerWeek: lessonStructure.lessonsPerWeek,
        firstWeek: lessonStructure.firstWeek,
        firstLesson: lessonStructure.firstLesson,
        lastWeek: lessonStructure.lastWeek,
        lastLesson: lessonStructure.lastLesson,
        doubleLessonOption: lessonStructure.doubleLessonOption,
        doubleLessonCombination: lessonStructure.doubleLessonCombination,
      })

      const breaksWithSlots: BreakWithSlots[] = breaks.map(b => ({
        ...b,
        startSlot: weekLessonToSlot(b.startWeek, b.startLesson, lessonStructure!.lessonsPerWeek),
        endSlot: weekLessonToSlot(b.endWeek, b.endLesson, lessonStructure!.lessonsPerWeek),
      }))

      timeline = applyBreaksToSchedule(termSchedule, breaksWithSlots)
    }

    // ── Run pipeline ──────────────────────────────────────────────────────────
    const result = await generateSchemePipeline({
      timeline,
      selectedSubstrands,
      context,
    })

    return apiSuccess({ result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[SOW Generate Error]:', message)
    if (stack) console.error(stack)
    return apiError(message || 'Generation failed')
  }
}
