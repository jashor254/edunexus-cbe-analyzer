// GET  /api/teacher/intervention-checkin?classId=...
//   → pending check-ins due in the next 7 days, or already overdue
// POST /api/teacher/intervention-checkin
//   → record the teacher's outcome for a follow-up check-in

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { recomputeRiskFlags } from '@/lib/learnerModel/updater'
import { recordInterventionCheckinEvidence } from '@/lib/remedial/interventionEvidence'
import type { InterventionCheckin } from '@/lib/learnerModel/types'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
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

    const url     = new URL(req.url)
    const classId = url.searchParams.get('classId')
    if (!classId) return apiError('classId is required', 400)

    // Verify teacher owns this class
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    // Due window: now + 7 days
    const dueWindow = new Date()
    dueWindow.setDate(dueWindow.getDate() + 7)
    const now = new Date()

    const { data: logs, error: logErr } = await db
      .from('intervention_log')
      .select('id, student_id, substrand, intervention_type, intervened_at, checkin_due_at, risk_level_before')
      .eq('teacher_id', teacher.id)
      .eq('class_id', classId)
      .is('checkin_completed_at', null)
      .lte('checkin_due_at', dueWindow.toISOString())
      .order('checkin_due_at', { ascending: true })

    if (logErr) throw new Error(logErr.message)

    const rows = logs ?? []

    // Fetch student names in one query
    const studentIds = [...new Set(rows.map(r => r.student_id as string))]

    const nameMap = new Map<string, string>()
    if (studentIds.length > 0) {
      const { data: students } = await db
        .from('students')
        .select('id, first_name, last_name')
        .in('id', studentIds)

      for (const s of students ?? []) {
        nameMap.set(
          s.id as string,
          `${(s.first_name as string | null) ?? ''} ${(s.last_name as string | null) ?? ''}`.trim(),
        )
      }
    }

    // Build InterventionCheckin[] and count overdue
    let overdueCount = 0

    const checkins: InterventionCheckin[] = rows.map(row => {
      const dueAt    = new Date(row.checkin_due_at as string)
      const daysSince = Math.floor(
        (now.getTime() - new Date(row.intervened_at as string).getTime()) / (1000 * 60 * 60 * 24),
      )

      if (dueAt < now) overdueCount++

      return {
        intervention_id:   row.id as string,
        student_name:      nameMap.get(row.student_id as string) ?? `Student (${(row.student_id as string).slice(-4)})`,
        student_id:        row.student_id as string,
        substrand:         row.substrand as string,
        intervention_type: row.intervention_type as string,
        days_since:        daysSince,
        due_date:          row.checkin_due_at as string,
      }
    })

    return apiSuccess({ checkins, overdue_count: overdueCount })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[intervention-checkin GET]', msg)
    return apiError('Failed to load intervention check-ins')
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  interventionId: z.string().uuid(),
  studentId:      z.string().uuid(),
  outcome:        z.enum(['improved', 'same', 'worsened']),
  note:           z.string().max(1000).optional(),
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

    const parsed = PostSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { interventionId, studentId, outcome, note } = parsed.data

    // Verify teacher owns this intervention — never trust ids from request body
    const { data: existing, error: fetchErr } = await db
      .from('intervention_log')
      .select('id, teacher_id, subject, substrand')
      .eq('id', interventionId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (fetchErr) throw new Error(fetchErr.message)
    if (!existing) return apiError('Intervention not found', 404)
    if ((existing.teacher_id as string) !== teacher.id) return apiForbidden()

    // Record the outcome
    const { error: updateErr } = await db
      .from('intervention_log')
      .update({
        teacher_outcome:      outcome,
        teacher_note:         note ?? null,
        checkin_completed_at: new Date().toISOString(),
      })
      .eq('id', interventionId)

    if (updateErr) throw new Error(updateErr.message)

    // If the student improved, recompute their risk flags so the profile reflects reality
    if (outcome === 'improved') {
      recomputeRiskFlags(studentId).catch(err => {
        console.error('[intervention-checkin POST] recomputeRiskFlags failed', err)
      })
    }

    recordInterventionCheckinEvidence({
      studentId,
      teacherId: teacher.id,
      teacherUserId: user.id,
      subject: (existing.subject as string | null) ?? null,
      subStrand: (existing.substrand as string | null) ?? null,
      outcome,
      recordedAt: new Date().toISOString(),
    }).catch(err => {
      console.error('[intervention-checkin POST] evidence emission failed', err)
    })

    return apiSuccess({ recorded: true, outcome })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[intervention-checkin POST]', msg)
    return apiError('Failed to record intervention check-in')
  }
}
