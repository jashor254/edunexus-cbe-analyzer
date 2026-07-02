// lib/eils/teacherIntelligence.ts
// Layer 6 — Teacher Intelligence
//
// Generates teacher-facing intelligence panels from learner model data.
// Wraps lib/teachingIntelligence + learner model to produce actionable,
// prioritised panels — not raw data.
//
// A teacher should open their Monday panel and know exactly:
//   1. Who needs attention
//   2. What the class is struggling with that was hidden
//   3. Who is ready to be challenged
//   4. How to adapt this week's lesson

import { createServiceClient } from '@/utils/supabase/service'
import { getClassLearnerProfiles, getAtRiskStudents } from '@/lib/learnerModel/queries'
import type { LearnerProfile, RiskLevel } from '@/lib/learnerModel/types'
import type {
  EILSTeacherPanel,
  StudentAttentionItem,
  MisconceptionAlert,
  AccelerationCandidate,
  MasteryHeatmapRow,
} from './types'

// ── Main: build teacher intelligence panel ────────────────────────────────────

export async function buildTeacherPanel(
  classId:   string,
  teacherId: string,
  weekOf?:   string,
): Promise<EILSTeacherPanel> {
  const db  = createServiceClient()
  const now = weekOf ?? new Date().toISOString().slice(0, 10)

  // Load all learner profiles for this class
  const [allProfiles, atRiskProfiles] = await Promise.all([
    getClassLearnerProfiles(classId),
    getAtRiskStudents(classId, 'watch'),
  ])

  // Load student names
  const studentNames = await loadStudentNames(classId, db)

  const studentsNeeding  = buildAttentionList(atRiskProfiles, studentNames, allProfiles)
  const misconceptions   = detectHiddenMisconceptions(allProfiles, studentNames)
  const accelerateable   = detectAccelerationCandidates(allProfiles, studentNames)
  const heatmap          = buildMasteryHeatmap(allProfiles)
  const trajectory       = computeClassTrajectory(allProfiles)
  const adaptationTips   = buildAdaptationTips(misconceptions, studentsNeeding, heatmap)

  return {
    class_id:                  classId,
    teacher_id:                teacherId,
    week_of:                   now,
    students_needing_attention: studentsNeeding,
    class_trajectory:          trajectory,
    hidden_misconceptions:     misconceptions,
    acceleration_candidates:   accelerateable,
    lesson_adaptation_tips:    adaptationTips,
    class_mastery_heatmap:     heatmap,
    generated_at:              new Date().toISOString(),
  }
}

// ── Students Needing Attention ────────────────────────────────────────────────

function buildAttentionList(
  profiles:     LearnerProfile[],
  studentNames: Map<string, string>,
  allProfiles:  LearnerProfile[],
): StudentAttentionItem[] {
  const items: StudentAttentionItem[] = []

  // Sort by risk severity
  const riskOrder: Record<RiskLevel, number> = { normal: 0, watch: 1, at_risk: 2, critical: 3 }
  const sorted = [...profiles].sort((a, b) =>
    riskOrder[b.overall_risk_level] - riskOrder[a.overall_risk_level]
  )

  for (const profile of sorted.slice(0, 10)) {
    const name         = studentNames.get(profile.student_id) ?? 'Unknown'
    const topFlag      = profile.risk_flags.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))[0]
    const weeksAtRisk  = getWeeksAtRisk(profile)
    const peerHelper   = findPeerHelper(profile, allProfiles, studentNames)

    items.push({
      student_id:       profile.student_id,
      student_name:     name,
      risk_level:       profile.overall_risk_level,
      reason:           topFlag ? topFlag.detail : 'Risk flag active',
      suggested_action: suggestAction(profile),
      weeks_at_risk:    weeksAtRisk,
      peer_helper:      peerHelper,
    })
  }

  return items
}

function suggestAction(profile: LearnerProfile): string {
  const flags = profile.risk_flags
  if (flags.find(f => f.type === 'missing_prerequisite')) return 'Assign Compass remediation for the prerequisite concept'
  if (flags.find(f => f.type === 'disengaged'))            return 'Check in with learner — find out what is happening'
  if (flags.find(f => f.type === 'declining_performance')) return 'Review latest assessment results with the learner'
  if (flags.find(f => f.type === 'multiple_weak_substrands')) return 'Include in small-group remediation session'
  return 'Monitor progress and re-assess next week'
}

function findPeerHelper(
  profile:      LearnerProfile,
  allProfiles:  LearnerProfile[],
  studentNames: Map<string, string>,
): string | undefined {
  // A peer helper is a student with strong capability in the struggling student's weak subjects
  const weakSubjects = new Set(
    profile.confirmed_gaps.map(g => g.split(':')[0]).filter(Boolean)
  )

  for (const other of allProfiles) {
    if (other.student_id === profile.student_id) continue
    if (other.overall_risk_level !== 'normal') continue

    const isStrong = [...weakSubjects].every(subject => {
      const entries = Object.entries(other.knowledge_state)
        .filter(([k]) => k.startsWith(subject + ':'))
      return entries.length > 0 && entries.every(([, m]) => m.level >= 3)
    })

    if (isStrong) return studentNames.get(other.student_id)
  }

  return undefined
}

// ── Hidden Misconceptions ─────────────────────────────────────────────────────
// Finds patterns of 'lost' formative signals or 'confused' outcomes shared
// by multiple students — these are class-wide issues the teacher may not notice.

function detectHiddenMisconceptions(
  profiles:     LearnerProfile[],
  studentNames: Map<string, string>,
): MisconceptionAlert[] {
  const substrandCounts = new Map<string, { students: string[]; subject: string }>()

  for (const profile of profiles) {
    // Check formative signals for 'lost' outcomes
    for (const signal of profile.formative_signals ?? []) {
      if (signal.outcome !== 'lost' && signal.outcome !== 'confused') continue
      const key = `${signal.subject}:${signal.substrand ?? 'unknown'}`
      if (!substrandCounts.has(key)) {
        substrandCounts.set(key, { students: [], subject: signal.subject })
      }
      substrandCounts.get(key)!.students.push(profile.student_id)
    }

    // Check confirmed gaps — if 3+ students share the same gap, it's a class pattern
    for (const gap of profile.confirmed_gaps) {
      if (!substrandCounts.has(gap)) {
        const [subject] = gap.split(':')
        substrandCounts.set(gap, { students: [], subject: subject ?? 'unknown' })
      }
      substrandCounts.get(gap)!.students.push(profile.student_id)
    }
  }

  const alerts: MisconceptionAlert[] = []

  for (const [key, { students, subject }] of substrandCounts) {
    if (students.length < 3) continue  // threshold: affects 3+ students
    const [, substrand] = key.split(':')
    if (!substrand) continue

    const uniqueStudents = [...new Set(students)]
    alerts.push({
      substrand,
      subject,
      students_affected: uniqueStudents.length,
      evidence:          `${uniqueStudents.length} students show difficulty with this concept`,
      suggestion:        `Re-teach ${substrand} using a different approach — consider hands-on activity or peer explanation`,
    })
  }

  return alerts
    .sort((a, b) => b.students_affected - a.students_affected)
    .slice(0, 5)
}

// ── Acceleration Candidates ───────────────────────────────────────────────────

function detectAccelerationCandidates(
  profiles:     LearnerProfile[],
  studentNames: Map<string, string>,
): AccelerationCandidate[] {
  const candidates: AccelerationCandidate[] = []

  for (const profile of profiles) {
    if (profile.overall_risk_level !== 'normal') continue

    // Check for 'accelerating' capability trend
    const dims = profile.capability_dimensions as Record<string, { trend?: string; raw_score?: number }>
    const accelerating = Object.values(dims).filter(d => d?.trend === 'accelerating').length
    const highScores   = Object.values(profile.knowledge_state).filter(m => m.level === 4).length

    if (accelerating >= 2 || highScores >= 3) {
      const name   = studentNames.get(profile.student_id) ?? 'Unknown'
      const reason = accelerating >= 2
        ? `${accelerating} capability dimensions are accelerating — this learner is outpacing the standard curriculum`
        : `${highScores} substrands at EE (Level 4) — ready for above-grade challenge material`

      candidates.push({
        student_id:   profile.student_id,
        student_name: name,
        reason,
        suggestion:   accelerating >= 2
          ? 'Assign extension tasks or peer-teaching role to maintain engagement'
          : 'Provide enrichment material or scholarship preparation content',
      })
    }
  }

  return candidates.slice(0, 5)
}

// ── Mastery Heatmap ───────────────────────────────────────────────────────────

function buildMasteryHeatmap(profiles: LearnerProfile[]): MasteryHeatmapRow[] {
  if (profiles.length === 0) return []

  // Aggregate mastery levels per substrand across all students
  const substrandData = new Map<string, { levels: number[]; subject: string }>()

  for (const profile of profiles) {
    for (const [key, mastery] of Object.entries(profile.knowledge_state)) {
      const [subject, substrand] = key.split(':')
      if (!subject || !substrand) continue

      if (!substrandData.has(key)) {
        substrandData.set(key, { levels: [], subject })
      }
      substrandData.get(key)!.levels.push(mastery.level)
    }
  }

  const rows: MasteryHeatmapRow[] = []

  for (const [key, { levels, subject }] of substrandData) {
    if (levels.length < 2) continue  // need at least 2 data points
    const [, substrand] = key.split(':')
    if (!substrand) continue

    const avgLevel   = levels.reduce((a, b) => a + b, 0) / levels.length
    const belowME    = levels.filter(l => l < 3).length
    const pctBelowME = Math.round((belowME / levels.length) * 100)

    rows.push({
      substrand,
      subject,
      avg_level:    Math.round(avgLevel * 10) / 10,
      pct_below_me: pctBelowME,
      trend:        pctBelowME > 50 ? 'declining' : pctBelowME < 30 ? 'improving' : 'stable',
    })
  }

  return rows
    .sort((a, b) => b.pct_below_me - a.pct_below_me)
    .slice(0, 15)
}

// ── Class Trajectory ──────────────────────────────────────────────────────────

function computeClassTrajectory(profiles: LearnerProfile[]): EILSTeacherPanel['class_trajectory'] {
  if (profiles.length === 0) return 'stable'

  const dims = profiles.flatMap(p => {
    const d = p.capability_dimensions as Record<string, { trend?: string }>
    return Object.values(d).map(v => v?.trend ?? 'stable')
  })

  const improving = dims.filter(t => t === 'improving' || t === 'accelerating').length
  const declining = dims.filter(t => t === 'declining').length

  if (improving > declining * 1.5) return 'improving'
  if (declining > improving * 1.5) return 'declining'
  return 'stable'
}

// ── Lesson Adaptation Tips ────────────────────────────────────────────────────

function buildAdaptationTips(
  misconceptions: MisconceptionAlert[],
  attention:      StudentAttentionItem[],
  heatmap:        MasteryHeatmapRow[],
): string[] {
  const tips: string[] = []

  if (misconceptions.length > 0) {
    const top = misconceptions[0]
    tips.push(`Re-teach ${top.substrand}: ${top.students_affected} students are struggling. Try a different explanation method.`)
  }

  const criticalStudents = attention.filter(s => s.risk_level === 'critical' || s.risk_level === 'at_risk')
  if (criticalStudents.length > 0) {
    tips.push(`Check in with ${criticalStudents.map(s => s.student_name.split(' ')[0]).join(', ')} at the start of class.`)
  }

  const weakHeatmapRows = heatmap.filter(r => r.pct_below_me >= 60)
  if (weakHeatmapRows.length > 0) {
    const top = weakHeatmapRows[0]
    tips.push(`${top.pct_below_me}% of the class is below ME in ${top.substrand}. Consider a whole-class revision before moving on.`)
  }

  const peerPairings = attention.filter(s => s.peer_helper)
  if (peerPairings.length > 0) {
    tips.push(`Peer-pair: ${peerPairings.map(s => `${s.student_name.split(' ')[0]} with ${s.peer_helper}`).slice(0, 3).join(', ')} for collaborative practice.`)
  }

  if (tips.length === 0) {
    tips.push('Class is on track — maintain current pace and consider introducing enrichment tasks.')
  }

  return tips.slice(0, 5)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadStudentNames(
  classId: string,
  db:      ReturnType<typeof createServiceClient>,
): Promise<Map<string, string>> {
  const { data } = await db
    .from('class_enrollments')
    .select('student_id, learners(full_name)')
    .eq('class_id', classId)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const name = (row.learners as { full_name?: string } | null)?.full_name
    if (row.student_id && name) map.set(row.student_id as string, name)
  }
  return map
}

function getWeeksAtRisk(profile: LearnerProfile): number {
  const history  = profile.risk_history ?? []
  const active   = history.find(h => !h.resolved_at)
  return active?.consecutive_weeks ?? 0
}

function severityOrder(s: 'low' | 'medium' | 'high'): number {
  return { low: 0, medium: 1, high: 2 }[s]
}
