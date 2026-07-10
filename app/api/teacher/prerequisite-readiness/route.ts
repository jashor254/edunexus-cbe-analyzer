// GET /api/teacher/prerequisite-readiness?classId=...&subStrand=...&subject=...
// Checks how ready a class is for an upcoming lesson, using the Knowledge Graph.
// Answers: "Before I teach X, how many students are missing the prerequisites?"

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getClassLearnerProfiles } from '@/lib/learnerModel/queries'
import { findPrerequisiteAlerts } from '@/lib/knowledgeGraph/prerequisiteAlerts'

// When ≥ 30% are affected, log an intervention so the teacher gets a follow-up.
const PCT_INTERVENTION_THRESHOLD = 0.30

export async function GET(req: Request): Promise<Response> {
  try {
    // ── 1. Auth & ownership ──────────────────────────────────────────────────
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

    const url       = new URL(req.url)
    const classId   = url.searchParams.get('classId')
    const subStrand = url.searchParams.get('subStrand')
    const subject   = url.searchParams.get('subject')

    if (!classId)   return apiError('classId is required', 400)
    if (!subStrand) return apiError('subStrand is required', 400)
    if (!subject)   return apiError('subject is required', 400)

    // Verify the teacher owns this class
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, name, grade')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    // ── 2. Find the knowledge node for this substrand ────────────────────────
    const { data: matchedNodes } = await db
      .from('knowledge_nodes')
      .select('id, node_id, name, importance, misconceptions, remediation, weak_mastery_signs, strand')
      .eq('subject', subject)
      .or(`name.ilike.%${subStrand}%,strand.ilike.%${subStrand}%`)
      .limit(5)

    const node = matchedNodes?.[0] ?? null

    if (!node) {
      return apiSuccess({
        ready:            true,
        readiness_pct:    100,
        alerts:           [],
        lesson_substrand: subStrand,
        total_students:   0,
        recommendation:   'No knowledge graph data for this substrand — proceed with the lesson.',
      })
    }

    // ── 3. Get class learner profiles ────────────────────────────────────────
    const profiles = await getClassLearnerProfiles(classId)
    const total    = profiles.length

    if (total === 0) {
      return apiSuccess({
        ready:            true,
        readiness_pct:    100,
        alerts:           [],
        lesson_substrand: subStrand,
        total_students:   0,
        recommendation:   'No students in this class yet.',
      })
    }

    // Also fetch student names for the alert detail
    const studentIds = profiles.map(p => p.student_id)
    const { data: students } = await db
      .from('students')
      .select('id, first_name, last_name')
      .in('id', studentIds)

    const nameMap = new Map(
      (students ?? []).map(s => [
        s.id as string,
        `${(s.first_name as string | null) ?? ''} ${(s.last_name as string | null) ?? ''}`.trim(),
      ])
    )

    // ── 4. Check mastery of each prerequisite per student ────────────────────
    // Shared with the Monday Panel (lib/knowledgeGraph/prerequisiteAlerts.ts)
    // so both surfaces produce identical results from the same learner data.
    const alerts = await findPrerequisiteAlerts(db, profiles, nameMap, subject, subStrand)

    // ── 8. Build overall readiness ────────────────────────────────────────────
    // A student "passes" readiness if they are not missing any prerequisite.
    // Approximate from the worst-case alert (highest pct_affected).
    const worstAlert  = alerts.sort((a, b) => b.pct_affected - a.pct_affected)[0]
    const readyThreshold = PCT_INTERVENTION_THRESHOLD * 100  // 30%
    const ready       = !worstAlert || worstAlert.pct_affected < readyThreshold

    // readiness_pct = class average over all prereqs (simple: 100 - worst gap)
    const readinessPct = worstAlert
      ? Math.max(0, 100 - worstAlert.pct_affected)
      : 100

    let recommendation: string
    if (alerts.length === 0) {
      recommendation = 'Class is ready for this lesson. Proceed.'
    } else {
      const topMissing = worstAlert?.missing_prereq ?? alerts[0].missing_prereq
      recommendation = `Run a 10-minute warm-up on "${topMissing}" before starting this lesson.`
    }

    // ── 9. Log prerequisite_warmup intervention if severity is high ───────────
    for (const alert of alerts) {
      if (alert.pct_affected >= readyThreshold) {
        // Insert one intervention_log entry for the class (not per student —
        // that would create noise). Insert only if not already logged today.
        const today = new Date().toISOString().slice(0, 10)

        const { data: existing } = await db
          .from('intervention_log')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('class_id', classId)
          .eq('substrand', alert.missing_prereq)
          .eq('intervention_type', 'prerequisite_warmup')
          .gte('intervened_at', `${today}T00:00:00Z`)
          .maybeSingle()

        if (!existing) {
          const checkinDue = new Date()
          checkinDue.setDate(checkinDue.getDate() + 14)

          await db.from('intervention_log').insert({
            teacher_id:        teacher.id,
            class_id:          classId,
            substrand:         alert.missing_prereq,
            intervention_type: 'prerequisite_warmup',
            intervened_at:     new Date().toISOString(),
            checkin_due_at:    checkinDue.toISOString(),
            risk_level_before: 'watch',
          })
        }
      }
    }

    // ── 10. Return ────────────────────────────────────────────────────────────
    return apiSuccess({
      ready,
      readiness_pct:    readinessPct,
      alerts,
      lesson_substrand: subStrand,
      total_students:   total,
      recommendation,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[prerequisite-readiness]', msg)
    return apiError('Failed to check prerequisite readiness')
  }
}
