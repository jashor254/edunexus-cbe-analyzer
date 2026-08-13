// app/api/sow/generate/route.ts
// POST: Generate a full Scheme of Work via DeepSeek AI

import { z } from 'zod'
import { after } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { type FeatureKey } from '@/lib/payments/config'
import { repos } from '@/lib/repositories'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'

const FEATURE: FeatureKey = 'sow_generate'
export const SOW_GENERATE_JOB_TYPE = 'ai.sow.generate'

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
      context: parsedContext,
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

    // Cost attribution is intentionally unset. This used to resolve an
    // organization for per-org AI cost recording, but `organization_members`
    // has never existed in production — the lookup threw PGRST205 and 500'd
    // this route AFTER the access check had already passed, so fixing
    // checkFeatureAccess alone would have moved the same crash a few lines
    // down. Omitting costContext is a documented no-op per lib/ai/deepseek.ts's
    // contract ("optional and additive"). Per-school cost attribution, if it is
    // ever wanted, belongs on the live school domain, not the absent one.
    const context: SOWContext = { ...parsedContext }

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

    // ── Run pipeline as a background job ──────────────────────────────────────
    // A full term's lessons, generated in batches of 5 concurrent AI calls,
    // does not fit inside one request/response — same pattern as Holiday
    // Planner and class report generation (see those routes). Inserted
    // already `processing` in a single write to avoid the cron
    // job-processor claiming a `queued` row for a job type it has no
    // handler for.
    const total = timeline.filter(s => !s.isBreak).length

    const { data: job, error: jobErr } = await db
      .from('jobs')
      .insert({
        queue_name: 'ai.generation',
        type:       SOW_GENERATE_JOB_TYPE,
        user_id:    access.userId,
        status:     'processing',
        started_at: new Date().toISOString(),
        payload:    { total },
        result:     { total, completed: 0, failed: 0 },
      })
      .select('id')
      .single()
    if (jobErr || !job) return apiError('Could not start scheme of work generation')

    after(async () => {
      try {
        const result = await generateSchemePipeline(
          { timeline, selectedSubstrands, context },
          async progress => {
            await repos.jobs.updateProgress(job.id, {
              result: { total: progress.total, completed: progress.completed, failed: progress.failed },
            })
          },
        )
        await repos.jobs.markComplete(job.id, { total, completed: total, result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await repos.jobs.updateProgress(job.id, { status: 'failed', result: { total, completed: 0, failed: total, errorMessage: message } })
      }
    })

    return apiSuccess({ jobId: job.id, total })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[SOW Generate Error]:', message)
    if (stack) console.error(stack)
    return apiError('We could not start generating your scheme of work. Please try again.')
  }
}
