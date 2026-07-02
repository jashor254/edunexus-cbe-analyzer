// POST /api/formative/signal
// Teacher records who got it, who was confused, who was lost — after any lesson.
// 30 seconds of input. Maximum intelligence output.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { afterFormativeSignal } from '@/lib/eils'

const Schema = z.object({
  classId:      z.string().uuid(),
  sowId:        z.string().uuid().optional(),
  lessonPlanId: z.string().uuid().optional(),
  weekNumber:   z.number().int().optional(),
  lessonNumber: z.number().int().optional(),
  subject:      z.string().min(1),
  strand:       z.string().optional(),
  subStrand:    z.string().optional(),
  gotItIds:     z.array(z.string()).default([]),
  confusedIds:  z.array(z.string()).default([]),
  lostIds:      z.array(z.string()).default([]),
  teacherNote:  z.string().max(500).optional(),
})

export async function POST(req: Request): Promise<Response> {
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

    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const d   = parsed.data
    const now = new Date().toISOString()

    // Save the signal record
    await db.from('formative_signals').insert({
      teacher_id:    teacher.id,
      class_id:      d.classId,
      sow_id:        d.sowId ?? null,
      lesson_plan_id: d.lessonPlanId ?? null,
      week_number:   d.weekNumber ?? null,
      lesson_number: d.lessonNumber ?? null,
      subject:       d.subject,
      strand:        d.strand ?? null,
      sub_strand:    d.subStrand ?? null,
      got_it_ids:    d.gotItIds,
      confused_ids:  d.confusedIds,
      lost_ids:      d.lostIds,
      teacher_note:  d.teacherNote ?? null,
      recorded_at:   now,
    })

    // Update EILS + Learner Model for each student — fire and forget
    const allUpdates = [
      ...d.gotItIds.map(id  => afterFormativeSignal({ studentId: id, classId: d.classId, subject: d.subject, substrand: d.subStrand, outcome: 'got_it',  recordedAt: now })),
      ...d.confusedIds.map(id => afterFormativeSignal({ studentId: id, classId: d.classId, subject: d.subject, substrand: d.subStrand, outcome: 'confused', recordedAt: now })),
      ...d.lostIds.map(id   => afterFormativeSignal({ studentId: id, classId: d.classId, subject: d.subject, substrand: d.subStrand, outcome: 'lost',    recordedAt: now })),
    ]
    Promise.allSettled(allUpdates).catch(() => {})

    return apiSuccess({
      recorded:     true,
      got_it_count: d.gotItIds.length,
      confused_count: d.confusedIds.length,
      lost_count:   d.lostIds.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[formative/signal]', msg)
    return apiError('Failed to record formative signal')
  }
}
