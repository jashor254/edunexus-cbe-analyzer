// GET /api/cron/term-readiness
// Runs on the first Monday of each term (Jan, May, Sep roughly).
// Generates a "Holiday Completion Brief" per class showing which students
// engaged with holiday work and how that maps to their current risk level.
// Protected by CRON_SECRET. Uses service role throughout — bypasses RLS.

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { sendWhatsApp } from '@/lib/whatsapp/sender'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentBrief = {
  student_id:        string
  student_name:      string
  risk_level:        string
  completed_sessions: number
  abandoned_sessions: number
  engaged:           boolean
}

type ClassHolidayBrief = {
  class_id:          string
  class_name:        string
  teacher_id:        string
  total_students:    number
  engagers:          number
  engagement_rate:   number   // 0–100
  at_risk_engagers:  number
  at_risk_total:     number
  students:          StudentBrief[]
  key_insight:       string
  generated_at:      string
}

// ── Term-start computation ────────────────────────────────────────────────────
// Kenya school terms (approximate):
//   Term 1: ~Jan 6   → ends ~Apr 5
//   Term 2: ~May 6   → ends ~Aug 2
//   Term 3: ~Sep 1   → ends ~Nov 15
// We compute "term started N days ago" by finding the most recent term-start
// boundary relative to today.

function computeTermStartDate(): Date {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1  // 1-based

  let termStart: Date

  if (month <= 4) {
    // Term 1 (Jan–Apr)
    termStart = new Date(`${year}-01-06T00:00:00Z`)
  } else if (month <= 8) {
    // Term 2 (May–Aug)
    termStart = new Date(`${year}-05-06T00:00:00Z`)
  } else {
    // Term 3 (Sep–Nov)
    termStart = new Date(`${year}-09-01T00:00:00Z`)
  }

  return termStart
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  try {
    // ── 1. Auth: CRON_SECRET only ────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`)) {
      return apiUnauthorized()
    }

    const db = createServiceClient()

    // ── 2. Compute holiday window ─────────────────────────────────────────────
    // The holiday is the 50 days before term start.
    const termStart     = computeTermStartDate()
    const holidayStart  = new Date(termStart)
    holidayStart.setDate(holidayStart.getDate() - 50)

    const termStartIso   = termStart.toISOString()
    const holidayStartIso = holidayStart.toISOString()

    // ── 3. Query compass_sessions for holiday-mode work ───────────────────────
    const { data: sessions, error: sessErr } = await db
      .from('compass_sessions')
      .select('id, learner_id, status, created_at')
      .eq('mode', 'holiday')
      .gte('created_at', holidayStartIso)
      .lt('created_at', termStartIso)
      .in('status', ['completed', 'abandoned'])

    if (sessErr) throw new Error(`compass_sessions: ${sessErr.message}`)

    if (!sessions || sessions.length === 0) {
      return apiSuccess({
        classes_processed:  0,
        holiday_engagers:   0,
        at_risk_engagers:   0,
        message:            'No holiday sessions found in window.',
      })
    }

    // ── 4. Group by learner_id ────────────────────────────────────────────────
    type SessionTally = { completed: number; abandoned: number }
    const tally = new Map<string, SessionTally>()

    for (const s of sessions) {
      const learnerId = s.learner_id as string
      const existing  = tally.get(learnerId) ?? { completed: 0, abandoned: 0 }
      if (s.status === 'completed') existing.completed++
      else existing.abandoned++
      tally.set(learnerId, existing)
    }

    const uniqueLearnerIds = [...tally.keys()]

    // ── 5. Get risk levels and class membership in parallel ───────────────────
    const [profilesRes, enrollmentRes] = await Promise.all([
      db.from('learner_profiles')
        .select('student_id, overall_risk_level')
        .in('student_id', uniqueLearnerIds),
      db.from('class_students')
        .select('student_id, class_id')
        .in('student_id', uniqueLearnerIds),
    ])

    if (profilesRes.error) throw new Error(`learner_profiles: ${profilesRes.error.message}`)
    if (enrollmentRes.error) throw new Error(`class_students: ${enrollmentRes.error.message}`)

    const riskMap = new Map(
      (profilesRes.data ?? []).map(p => [p.student_id as string, p.overall_risk_level as string])
    )

    // Build: class_id → student_ids (holiday participants only)
    const classToStudents = new Map<string, Set<string>>()
    for (const row of enrollmentRes.data ?? []) {
      const sid = row.student_id as string
      const cid = row.class_id as string
      if (!classToStudents.has(cid)) classToStudents.set(cid, new Set())
      classToStudents.get(cid)!.add(sid)
    }

    // Collect all class ids that had at least one holiday participant
    const classIds = [...classToStudents.keys()]

    if (classIds.length === 0) {
      return apiSuccess({
        classes_processed: 0,
        holiday_engagers:  uniqueLearnerIds.length,
        at_risk_engagers:  0,
      })
    }

    // ── 5b. Get class details + teacher info ──────────────────────────────────
    const { data: classRows, error: classErr } = await db
      .from('teacher_classes')
      .select('id, name, teacher_id')
      .in('id', classIds)

    if (classErr) throw new Error(`teacher_classes: ${classErr.message}`)

    const teacherIds = [...new Set((classRows ?? []).map(c => c.teacher_id as string))]

    // Get ALL enrolled students per class (not just holiday participants) so
    // the engagement rate is honest.
    const { data: allEnrollments, error: allEnrollErr } = await db
      .from('class_students')
      .select('student_id, class_id')
      .in('class_id', classIds)

    if (allEnrollErr) throw new Error(`all enrollments: ${allEnrollErr.message}`)

    // Get student names
    const allStudentIds = [...new Set((allEnrollments ?? []).map(e => e.student_id as string))]

    const [namesRes, teachersRes, allProfilesRes] = await Promise.all([
      db.from('students')
        .select('id, first_name, last_name')
        .in('id', allStudentIds),
      db.from('teachers')
        .select('id, full_name, phone')
        .in('id', teacherIds),
      db.from('learner_profiles')
        .select('student_id, overall_risk_level')
        .in('student_id', allStudentIds),
    ])

    const nameMap = new Map(
      (namesRes.data ?? []).map(s => [
        s.id as string,
        `${(s.first_name as string | null) ?? ''} ${(s.last_name as string | null) ?? ''}`.trim(),
      ])
    )

    const teacherMap = new Map(
      (teachersRes.data ?? []).map(t => [t.id as string, t])
    )

    // Merge risk info (include all students, not just holiday participants)
    const fullRiskMap = new Map(
      (allProfilesRes.data ?? []).map(p => [p.student_id as string, p.overall_risk_level as string])
    )

    // Build class_id → all student_ids map
    const classAllStudents = new Map<string, string[]>()
    for (const row of allEnrollments ?? []) {
      const cid = row.class_id as string
      const sid = row.student_id as string
      if (!classAllStudents.has(cid)) classAllStudents.set(cid, [])
      classAllStudents.get(cid)!.push(sid)
    }

    // ── 6 & 7. Build a brief per class ───────────────────────────────────────
    const briefs: ClassHolidayBrief[] = []

    for (const cls of classRows ?? []) {
      const classId   = cls.id as string
      const className = cls.name as string
      const teacherId = cls.teacher_id as string

      const allSids    = classAllStudents.get(classId) ?? []
      const totalStudents = allSids.length

      const students: StudentBrief[] = allSids.map(sid => {
        const t          = tally.get(sid)
        const riskLevel  = fullRiskMap.get(sid) ?? 'normal'
        const completed  = t?.completed ?? 0
        const abandoned  = t?.abandoned ?? 0
        const engaged    = completed >= 1

        return {
          student_id:         sid,
          student_name:       nameMap.get(sid) ?? `Student (${sid.slice(-4)})`,
          risk_level:         riskLevel,
          completed_sessions: completed,
          abandoned_sessions: abandoned,
          engaged,
        } satisfies StudentBrief
      })

      const engagers      = students.filter(s => s.engaged).length
      const engagementRate = totalStudents > 0
        ? Math.round((engagers / totalStudents) * 100)
        : 0

      const atRiskStudents  = students.filter(s => s.risk_level !== 'normal')
      const atRiskTotal     = atRiskStudents.length
      const atRiskEngagers  = atRiskStudents.filter(s => s.engaged).length

      // Build key insight
      let keyInsight: string
      if (atRiskTotal === 0) {
        keyInsight = `${engagers} of ${totalStudents} students engaged with holiday work (${engagementRate}%).`
      } else if (atRiskEngagers === atRiskTotal) {
        keyInsight = `All ${atRiskTotal} at-risk students engaged with holiday work — great sign.`
      } else if (atRiskEngagers > 0) {
        keyInsight = `${atRiskEngagers} of your ${atRiskTotal} at-risk students did holiday work — their risk level may have improved. ${atRiskTotal - atRiskEngagers} did not engage.`
      } else {
        keyInsight = `None of your ${atRiskTotal} at-risk students engaged with holiday work — they will need immediate catch-up support.`
      }

      const brief: ClassHolidayBrief = {
        class_id:        classId,
        class_name:      className,
        teacher_id:      teacherId,
        total_students:  totalStudents,
        engagers,
        engagement_rate: engagementRate,
        at_risk_engagers: atRiskEngagers,
        at_risk_total:   atRiskTotal,
        students,
        key_insight:     keyInsight,
        generated_at:    new Date().toISOString(),
      }

      briefs.push(brief)
    }

    // ── 7. Upsert all class briefs into monday_panel_cache in one call ────────
    // Store each brief as panel_data so teachers see it on their Monday Panel.
    if (briefs.length > 0) {
      await db.from('monday_panel_cache').upsert(
        briefs.map(brief => ({
          class_id:     brief.class_id,
          teacher_id:   brief.teacher_id,
          panel_data:   { holiday_brief: brief },
          generated_at: new Date().toISOString(),
        })),
        { onConflict: 'class_id' }
      )
    }

    // ── 8. Optional: WhatsApp notification per teacher ────────────────────────
    let whatsappSent = 0

    for (const brief of briefs) {
      const teacher = teacherMap.get(brief.teacher_id)
      if (!teacher?.phone) continue

      const message =
        `*EduNexus — Term Readiness Brief* 📊\n\n` +
        `Class: *${brief.class_name}*\n` +
        `Holiday engagement: *${brief.engagers}/${brief.total_students}* students (${brief.engagement_rate}%)\n\n` +
        `${brief.key_insight}\n\n` +
        `Check your Monday Panel for the full breakdown.`

      try {
        await sendWhatsApp(teacher.phone as string, message)
        whatsappSent++
      } catch {
        // Never let a WhatsApp failure block the cron response
      }
    }

    // ── 9. Return summary ─────────────────────────────────────────────────────
    const totalHolidayEngagers = briefs.reduce((acc, b) => acc + b.engagers, 0)
    const totalAtRiskEngagers  = briefs.reduce((acc, b) => acc + b.at_risk_engagers, 0)

    console.info(
      `[cron/term-readiness] classes=${briefs.length} engagers=${totalHolidayEngagers}` +
      ` at_risk_engagers=${totalAtRiskEngagers} whatsapp_sent=${whatsappSent}`
    )

    return apiSuccess({
      classes_processed:  briefs.length,
      holiday_engagers:   totalHolidayEngagers,
      at_risk_engagers:   totalAtRiskEngagers,
      whatsapp_sent:      whatsappSent,
      holiday_window: {
        from: holidayStartIso,
        to:   termStartIso,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/term-readiness]', msg)
    return apiError('Term readiness cron failed')
  }
}
