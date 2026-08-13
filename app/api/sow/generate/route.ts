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

// The context fields the PIPELINE actually dereferences, not the ones that
// merely look like identifiers. The two were inverted: `learningArea` and
// `grade` were validated and are never read by generation, while
// `learningAreaName` and `gradeName` — which are read, unguarded — were not.
//
//   lib/sow/lessonPipeline.ts:25       detectSubjectType(context.learningAreaName) -> .toLowerCase()
//   lib/sow/aiLessonGenerator.ts:159   grade (= context.gradeName)                 -> .replace(...)
//
// Omitting either returned 200 with a jobId and then died inside the
// background job as a raw TypeError, which the caller never sees. Anything
// generation cannot run without is validated here, before a job exists.
//
// `learningArea`/`grade` are kept required for compatibility: both production
// callers send the full SOWContext, and this route is not the place to prune
// fields. `.passthrough()` still carries the genuinely optional rest
// (school, term, year, textbook, kicdContext).
const GenerateSOWSchema = z.object({
  context: z.object({
    learningArea:     z.string().min(1),
    grade:            z.union([z.string(), z.number()]),
    curriculumMode:   z.string().min(1),
    // Trimmed: a whitespace-only name passes .min(1) and then produces
    // "Grade  Textbook" prompts and an empty subject-type match.
    learningAreaName: z.string().trim().min(1, 'context.learningAreaName is required'),
    gradeName:        z.string().trim().min(1, 'context.gradeName is required'),
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
    if (!parsed.success) {
      // Name the offending field. Zod's own message for an ABSENT key is
      // "expected string, received undefined" — which does not say which key,
      // so a caller that omitted context.gradeName learned no more from the
      // 400 than they did from the background TypeError it replaced.
      const issue = parsed.error.issues[0]
      const path  = issue?.path.join('.')
      return apiBadRequest(
        issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid input'
      )
    }

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
        // A returned result is not the same as a successful one. This used to
        // call markComplete() on the strength of "the pipeline did not throw",
        // so a run that generated nothing finished as `completed` wrapping an
        // inner `status: 'failed'` — and the teacher UI, which advances on the
        // outer status, showed an empty scheme of work as a success.
        //
        // The verdict is the pipeline's own `result.status`
        // (lib/sow/lessonPipeline.ts) — not a second success rule invented
        // here. 'partial' still counts as completed: some lessons were
        // generated and are usable, and the failures travel inside `result`.
        const generated = result.summary.generated

        if (result.status === 'failed') {
          await repos.jobs.updateProgress(job.id, {
            status: 'failed',
            result: {
              total,
              completed: generated,
              failed:    result.summary.failed,
              // User-safe by construction: counts and a plain sentence. The
              // pipeline's per-lesson `failures[].error` strings can carry raw
              // provider text, so they stay inside `result` and are never
              // promoted into the message the teacher is shown.
              errorMessage: total === 0
                ? 'No lessons could be scheduled for this term. Check the term start and end weeks, then try again.'
                : `No lessons could be generated (0 of ${total}). Please try again.`,
              result,
            },
          })
          return
        }

        // Counts come from the result, not from `total` — a partial run that
        // generated 3 of 10 lessons must not record 10 completed.
        await repos.jobs.markComplete(job.id, { total, completed: generated, failed: result.summary.failed, result })
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
