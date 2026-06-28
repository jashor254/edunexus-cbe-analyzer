// GET /api/teacher/monday-panel?classId=...
// The teacher's Monday morning intelligence brief — completely rebuilt.
//
// Five intelligence layers:
//   1. Students needing attention (existing — enhanced with risk history)
//   2. Teaching patterns (NEW — teacher sees their own formative signal patterns)
//   3. Prerequisite alerts (NEW — which lessons need a warm-up first)
//   4. Intervention check-ins (NEW — 14-day follow-ups due this week)
//   5. Career micro-moments (NEW — capability milestones worth telling parents)
//
// Cached for 24 hours per class. Invalidated on learner model update.

import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getClassLearnerProfiles, getAtRiskStudents } from '@/lib/learnerModel/queries'
import type {
  StudentIntelligenceSummary, ClassIntelligencePanel,
  TeachingPatternInsight, PrerequisiteAlert,
  InterventionCheckin, CareerMicroMoment,
} from '@/lib/learnerModel/types'

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
      .select('id, name, grade, subject')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    // Check cache (valid if < 24 hours old)
    const { data: cached } = await db
      .from('monday_panel_cache')
      .select('panel_data, teaching_patterns, prerequisite_alerts, pending_checkins, career_moments, valid_until')
      .eq('class_id', classId)
      .maybeSingle()

    if (cached && new Date(cached.valid_until as string) > new Date()) {
      return apiSuccess({ panel: cached.panel_data, _cached: true })
    }

    // ── Fetch base data in parallel ───────────────────────────────────────────
    const [atRisk, allProfiles] = await Promise.all([
      getAtRiskStudents(classId, 'watch'),
      getClassLearnerProfiles(classId),
    ])

    const atRiskIds = atRisk.map(p => p.student_id)
    const allIds    = allProfiles.map(p => p.student_id)

    const { data: students } = await db
      .from('students')
      .select('id, first_name, last_name')
      .in('id', allIds)

    const nameMap = new Map(
      (students ?? []).map(s => [
        s.id as string,
        `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
      ])
    )

    const capabilityMap = new Map(
      allProfiles.map(p => [
        p.student_id,
        p.capability_dimensions as Record<string, { raw_score?: number }>,
      ])
    )

    // ── Layer 1: Students needing attention (enhanced) ────────────────────────
    const summaries: StudentIntelligenceSummary[] = atRisk
      .sort((a, b) => {
        const order = { critical: 3, at_risk: 2, watch: 1, normal: 0 }
        return order[b.overall_risk_level] - order[a.overall_risk_level]
      })
      .slice(0, 8)
      .map(profile => {
        const name    = nameMap.get(profile.student_id) ?? `Student (${profile.student_id.slice(-4)})`
        const topFlag = profile.risk_flags?.[0]
        const flags   = profile.risk_flags ?? []

        // How many consecutive weeks at risk — from risk_history
        const weeksAtRisk = profile.risk_history
          .filter(r => !r.resolved_at && ['at_risk', 'critical'].includes(
            profile.overall_risk_level
          ))
          .reduce((max, r) => Math.max(max, r.consecutive_weeks ?? 0), 0)

        // Peer pairing — strongest on weakest dimension
        const weakDim = findWeakestDimension(capabilityMap.get(profile.student_id) ?? {})
        let peerPairing: string | undefined

        if (weakDim) {
          const helper = allProfiles
            .filter(p => p.student_id !== profile.student_id && p.overall_risk_level === 'normal')
            .sort((a, b) => {
              const aScore = ((a.capability_dimensions as Record<string, { raw_score?: number }>)[weakDim]?.raw_score ?? 0)
              const bScore = ((b.capability_dimensions as Record<string, { raw_score?: number }>)[weakDim]?.raw_score ?? 0)
              return bScore - aScore
            })[0]

          if (helper) {
            const helperName = nameMap.get(helper.student_id) ?? 'a strong student'
            peerPairing = `Pair with ${helperName} for support on ${weakDim.replace(/_/g, ' ')} — assign 10 minutes before Thursday's lesson`
          }
        }

        const compassSuggestion = buildCompassSuggestion(profile.knowledge_state ?? {})
        const firstName         = name.split(' ')[0]

        // Escalation note if 4+ weeks at risk
        const urgency = weeksAtRisk >= 4
          ? ` ⚠️ ${firstName} has been flagged for ${weeksAtRisk} consecutive weeks — consider a parent call.`
          : ''

        return {
          student_id:          profile.student_id,
          student_name:        name,
          risk_level:          profile.overall_risk_level,
          top_flags:           flags.slice(0, 2),
          action:              buildAction(topFlag, firstName) + urgency,
          peer_pairing:        peerPairing,
          compass_suggestion:  compassSuggestion,
          weeks_at_risk:       weeksAtRisk > 0 ? weeksAtRisk : undefined,
        } satisfies StudentIntelligenceSummary
      })

    // ── Layer 2: Teaching Pattern Insights ────────────────────────────────────
    // Teacher's own formative signals — what patterns do they reveal?
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()
    const { data: formativeRows } = await db
      .from('formative_signals')
      .select('subject, sub_strand, got_it_ids, confused_ids, lost_ids, recorded_at')
      .eq('teacher_id', teacher.id)
      .eq('class_id', classId)
      .gte('recorded_at', eightWeeksAgo)

    const teachingPatterns = buildTeachingPatterns(formativeRows ?? [])

    // ── Layer 3: Prerequisite Alerts for upcoming lessons ─────────────────────
    // Find the next lesson's substrand from the active SOW
    const { data: activeSow } = await db
      .from('schemes_of_work')
      .select('id, lessons, timeline')
      .eq('teacher_id', teacher.id)
      .eq('grade', cls.grade)
      .eq('subject', cls.subject)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prerequisiteAlerts: PrerequisiteAlert[] = []
    if (activeSow?.lessons) {
      const lessons = activeSow.lessons as Array<{ weekNumber?: number; subStrand?: string; strand?: string }>
      const currentWeek = getCurrentWeekOfTerm()
      const upcomingLesson = lessons.find(l => (l.weekNumber ?? 0) === currentWeek + 1)
        ?? lessons.find(l => (l.weekNumber ?? 0) === currentWeek)

      if (upcomingLesson?.subStrand) {
        const alerts = await checkPrerequisiteReadiness(
          db, allProfiles, nameMap, cls.subject as string, upcomingLesson.subStrand
        )
        prerequisiteAlerts.push(...alerts)
      }
    }

    // ── Layer 4: Intervention Check-ins Due ────────────────────────────────────
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: dueCheckins } = await db
      .from('intervention_log')
      .select('id, student_id, substrand, intervention_type, intervened_at, checkin_due_at, risk_level_before')
      .eq('teacher_id', user.id)
      .eq('class_id', classId)
      .is('checkin_completed_at', null)
      .lte('checkin_due_at', sevenDaysFromNow)
      .order('checkin_due_at', { ascending: true })
      .limit(5)

    const pendingCheckins: InterventionCheckin[] = (dueCheckins ?? []).map(row => {
      const studentName = nameMap.get(row.student_id as string) ?? 'Unknown student'
      const daysSince   = Math.floor(
        (Date.now() - new Date(row.intervened_at as string).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        intervention_id:   row.id as string,
        student_name:      studentName,
        student_id:        row.student_id as string,
        substrand:         (row.substrand ?? 'the target topic') as string,
        intervention_type: row.intervention_type as string,
        days_since:        daysSince,
        due_date:          row.checkin_due_at as string,
      }
    })

    // ── Layer 5: Career Micro-Moments ─────────────────────────────────────────
    // Surface capability milestones that haven't been notified yet
    const careerMoments: CareerMicroMoment[] = []
    for (const profile of allProfiles) {
      const unnotifiedMilestones = profile.growth_milestones.filter(
        m => !m.notified && (m.type === 'capability_threshold' || m.type === 'pathway_readiness_cross')
      )
      for (const milestone of unnotifiedMilestones.slice(0, 1)) {  // max 1 per student in panel
        const studentName = nameMap.get(profile.student_id) ?? 'A student'
        const firstName   = studentName.split(' ')[0]

        let message:     string
        let parentNote:  string

        if (milestone.type === 'capability_threshold') {
          const dim = (milestone.dimension ?? 'capability').replace(/_/g, ' ')
          message    = `${firstName} crossed from ${milestone.from_level} to ${milestone.to_level} in ${dim} — tell them this is genuine progress`
          parentNote = `${firstName}'s ${dim} has reached a new level this week`
        } else {
          message    = `${firstName}'s ${milestone.pathway ?? 'pathway'} readiness crossed ${milestone.to_level} — this is worth noting in their next parent conversation`
          parentNote = `${firstName}'s pathway readiness is growing — they're building strong foundations`
        }

        careerMoments.push({
          student_id:   profile.student_id,
          student_name: studentName,
          moment_type:  milestone.type as CareerMicroMoment['moment_type'],
          message,
          parent_note:  parentNote,
        })

        // Mark as notified (fire and forget)
        const updatedMilestones = profile.growth_milestones.map(m =>
          m === milestone ? { ...m, notified: true, notified_at: new Date().toISOString() } : m
        )
        db.from('learner_profiles')
          .update({ growth_milestones: updatedMilestones })
          .eq('student_id', profile.student_id)
          .then(() => {}).catch(() => {})
      }
    }

    // ── Class trajectory ──────────────────────────────────────────────────────
    const criticalCount = allProfiles.filter(p => p.overall_risk_level === 'critical').length
    const atRiskCount   = allProfiles.filter(p => p.overall_risk_level === 'at_risk').length
    const watchCount    = allProfiles.filter(p => p.overall_risk_level === 'watch').length
    const normalCount   = allProfiles.filter(p => p.overall_risk_level === 'normal').length
    const total         = allProfiles.length

    const trajectory = buildTrajectoryMessage(total, normalCount, watchCount, atRiskCount, criticalCount)

    // ── Assemble panel ────────────────────────────────────────────────────────
    const panel: ClassIntelligencePanel = {
      class_id:    classId,
      class_name:  cls.name as string,
      week_of:     new Date().toISOString().slice(0, 10),
      students_needing_attention: summaries,
      class_trajectory:          trajectory,
      teaching_patterns:         teachingPatterns,
      prerequisite_alerts:       prerequisiteAlerts,
      pending_checkins:          pendingCheckins,
      career_moments:            careerMoments,
      total_students:            total,
      normal_count:              normalCount,
      watch_count:               watchCount,
      at_risk_count:             atRiskCount,
      critical_count:            criticalCount,
      generated_at:              new Date().toISOString(),
    }

    // Cache the result
    await db.from('monday_panel_cache').upsert({
      class_id:           classId,
      teacher_id:         user.id,
      panel_data:         panel,
      teaching_patterns:  teachingPatterns,
      prerequisite_alerts: prerequisiteAlerts,
      pending_checkins:   pendingCheckins,
      career_moments:     careerMoments,
      generated_at:       new Date().toISOString(),
      valid_until:        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'class_id' })
    .catch(() => {})

    return apiSuccess({ panel })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[monday-panel]', msg)
    return apiError('Failed to generate Monday panel')
  }
}

// ── Layer 2: Teaching pattern computation ────────────────────────────────────

type FormativeRow = {
  subject:      unknown
  sub_strand:   unknown
  got_it_ids:   unknown
  confused_ids: unknown
  lost_ids:     unknown
  recorded_at:  unknown
}

function buildTeachingPatterns(rows: FormativeRow[]): TeachingPatternInsight[] {
  if (!rows.length) return []

  // Aggregate by substrand
  const agg = new Map<string, { lost: number; confused: number; got_it: number }>()

  for (const row of rows) {
    const substrand  = (row.sub_strand ?? row.subject ?? 'unknown') as string
    const lostIds    = (row.lost_ids    as string[] | null) ?? []
    const confusedIds= (row.confused_ids as string[] | null) ?? []
    const gotItIds   = (row.got_it_ids  as string[] | null) ?? []

    const existing = agg.get(substrand) ?? { lost: 0, confused: 0, got_it: 0 }
    // Count signals (not individual students per signal) for pattern detection
    existing.lost    += lostIds.length > 0 ? 1 : 0
    existing.confused += confusedIds.length > 0 ? 1 : 0
    existing.got_it  += gotItIds.length > 0 ? 1 : 0
    agg.set(substrand, existing)
  }

  const patterns: TeachingPatternInsight[] = []
  for (const [substrand, counts] of agg) {
    if (counts.lost < 2) continue  // single signal is noise

    const suggestion = counts.lost >= 5
      ? `Consider a whole-class reteach using a different approach — ${counts.lost} "lost" signals suggests a method issue, not just student gaps`
      : counts.lost >= 3
      ? `This substrand may have a prerequisite gap — check the knowledge graph before the next lesson`
      : `Early warning — 2 "lost" signals on this substrand. Watch closely this week`

    patterns.push({
      pattern:    `Students consistently struggle with "${substrand}" — marked as "lost" ${counts.lost} time${counts.lost > 1 ? 's' : ''} in the last 8 weeks`,
      count:      counts.lost,
      suggestion,
      substrands: [substrand],
    })
  }

  return patterns.sort((a, b) => b.count - a.count).slice(0, 3)
}

// ── Layer 3: Prerequisite readiness check ────────────────────────────────────

async function checkPrerequisiteReadiness(
  db:          ReturnType<typeof createServiceClient>,
  profiles:    Awaited<ReturnType<typeof getClassLearnerProfiles>>,
  nameMap:     Map<string, string>,
  subject:     string,
  subStrand:   string,
): Promise<PrerequisiteAlert[]> {
  // Find the knowledge node for this substrand
  const { data: node } = await db
    .from('knowledge_nodes')
    .select('id, name, strand, remediation, weak_mastery_signs')
    .eq('subject', subject.toLowerCase())
    .or(`name.ilike.%${subStrand}%,strand.ilike.%${subStrand}%`)
    .limit(1)
    .maybeSingle()

  if (!node) return []

  // Find prerequisite edges
  const { data: edges } = await db
    .from('knowledge_edges')
    .select('prerequisite_node_id, weight')
    .eq('dependent_node_id', node.id as string)
    .order('weight', { ascending: false })
    .limit(3)

  if (!edges?.length) return []

  const prereqIds = edges.map(e => e.prerequisite_node_id as string)
  const { data: prereqNodes } = await db
    .from('knowledge_nodes')
    .select('id, name, strand, remediation')
    .in('id', prereqIds)

  const alerts: PrerequisiteAlert[] = []

  for (const prereq of prereqNodes ?? []) {
    const prereqName    = prereq.name as string
    const prereqStrand  = prereq.strand as string

    // Check which students are missing this prerequisite
    const affectedStudents: string[] = []
    for (const profile of profiles) {
      const state = profile.knowledge_state
      const matchKey = Object.keys(state).find(k =>
        k.toLowerCase().includes(prereqName.toLowerCase()) ||
        k.toLowerCase().includes(prereqStrand.toLowerCase())
      )
      if (!matchKey || state[matchKey].level <= 2) {
        affectedStudents.push(profile.student_id)
      }
    }

    const pctAffected = profiles.length > 0
      ? Math.round((affectedStudents.length / profiles.length) * 100)
      : 0

    if (pctAffected < 20) continue

    const studentNames = affectedStudents
      .slice(0, 5)
      .map(id => nameMap.get(id)?.split(' ')[0] ?? id.slice(-4))

    const remediation = (prereq.remediation as string[] | null)?.[0]
      ?? `Review "${prereqName}" before proceeding`

    alerts.push({
      lesson_substrand:  subStrand,
      missing_prereq:    prereqName,
      students_affected: affectedStudents.length,
      pct_affected:      pctAffected,
      suggested_warmup:  remediation,
      student_names:     studentNames,
    })
  }

  return alerts
}

// ── Class trajectory message ──────────────────────────────────────────────────

function buildTrajectoryMessage(
  total: number, normal: number, watch: number, atRisk: number, critical: number
): string {
  if (total === 0) {
    return 'No student data yet. Add students to this class to see intelligence.'
  }
  if (critical > 0) {
    return `${critical} student${critical > 1 ? 's' : ''} need urgent support this week. ${normal} of ${total} are on track. Address critical cases before anything else.`
  }
  if (atRisk > 0) {
    return `${atRisk} student${atRisk > 1 ? 's' : ''} flagged for attention, ${watch > 0 ? `${watch} to watch, ` : ''}${normal} on track. Small interventions this week can prevent escalation.`
  }
  if (watch > 0) {
    return `${watch} student${watch > 1 ? 's' : ''} to watch — no urgent action needed, but worth a check-in. ${normal} of ${total} are progressing well.`
  }
  return `${normal} of ${total} students on track. Strong week — keep the momentum.`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAction(
  flag: { type: string; substrand?: string; detail: string } | undefined,
  firstName: string
): string {
  if (!flag) return `Check in with ${firstName} this week — their profile is incomplete.`
  switch (flag.type) {
    case 'missing_prerequisite':
      return `${firstName} is missing "${flag.substrand}". Re-teach this first — 15 minutes unlocks the next topic.`
    case 'declining_performance':
      return `${firstName}'s performance is declining. Brief one-on-one: ask what feels hard. Adjust pace or method before the next assessment.`
    case 'multiple_weak_substrands':
      return `${firstName} has multiple weak areas. Focus on one substrand at a time — start with the most recently taught.`
    case 'disengaged':
      return `${firstName} hasn't been active. A direct check-in today matters more than any Compass session. Personal contact first.`
    default:
      return `${firstName} needs attention: ${flag.detail.slice(0, 100)}`
  }
}

function findWeakestDimension(dims: Record<string, { raw_score?: number }>): string | null {
  const order = [
    'analytical_reasoning', 'communication', 'creative_thinking',
    'technical_aptitude', 'social_intelligence',
  ]
  let weakest: string | null = null
  let weakestScore = 1

  for (const dim of order) {
    const score = dims[dim]?.raw_score ?? null
    if (score !== null && score < weakestScore) {
      weakest = dim
      weakestScore = score
    }
  }
  return weakest
}

function buildCompassSuggestion(knowledgeState: Record<string, { level: number }>): string | undefined {
  const weakest = Object.entries(knowledgeState)
    .filter(([, m]) => m.level <= 2)
    .sort(([, a], [, b]) => a.level - b.level)[0]

  if (!weakest) return undefined
  const topic = weakest[0].split(':')[1] ?? weakest[0]
  return `Assign Compass: "${topic}" — this is the clearest gap in their knowledge state`
}

function getCurrentWeekOfTerm(): number {
  const now        = new Date()
  const month      = now.getMonth()
  let termStart: Date

  if (month < 4)      termStart = new Date(now.getFullYear(), 0, 6)
  else if (month < 8) termStart = new Date(now.getFullYear(), 4, 5)
  else                termStart = new Date(now.getFullYear(), 8, 1)

  const daysSince = (now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(1, Math.ceil(daysSince / 7))
}
