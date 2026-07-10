// lib/attentionFeed/panel.ts
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
//
// Lifted from lib/eils/teacherIntelligence.ts (frozen) — same output, new home.
// Reads only from lib/learnerModel — no EILS reasoning/arbitration dependency.

import { createServiceClient } from '@/utils/supabase/service'
import { getClassLearnerProfiles } from '@/lib/learnerModel/queries'
import type { LearnerProfile, RiskLevel } from '@/lib/learnerModel/types'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { LearnerIntelligenceProjection, RiskFlag } from '@/lib/projection/types'

// Partial migration only (see docs/architecture/migration-ledger.md): the
// attention list, class trajectory, and every risk-level check in this file
// (including inside peer-helper matching and acceleration candidates) are
// sourced from the Projection Engine — one risk engine, no exceptions. Mastery
// heatmap, hidden misconceptions, and the acceleration/peer-helper *content*
// (capability dimensions, substrand knowledge, risk-duration) stay on legacy
// learner_profiles below — they need substrand-level knowledge_state,
// 6-dimension capability, and consecutive-weeks duration, none of which the
// frozen v1.0 Projection Engine computes (knowledgeProjector is subject-level
// only; capabilityProjector has no 6-dimension breakdown; riskProjector has no
// duration tracking). This is a documented engine gap, not an oversight — do
// not "fix" it by reading learner_profiles substrand data into a
// Projection-labeled field.

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeacherPanel = {
  class_id:                  string
  teacher_id:                string
  week_of:                   string
  students_needing_attention: StudentAttentionItem[]
  class_trajectory:          'improving' | 'stable' | 'declining'
  hidden_misconceptions:     MisconceptionAlert[]
  acceleration_candidates:   AccelerationCandidate[]
  lesson_adaptation_tips:    string[]
  class_mastery_heatmap:     MasteryHeatmapRow[]
  generated_at:              string
}

export type StudentAttentionItem = {
  student_id:       string
  student_name:     string
  risk_level:       RiskLevel
  reason:           string         // one sentence
  suggested_action: string
  weeks_at_risk:    number
  peer_helper?:     string         // name of a classmate who can support
}

export type MisconceptionAlert = {
  substrand:        string
  subject:          string
  students_affected: number
  evidence:         string
  suggestion:       string
}

export type AccelerationCandidate = {
  student_id:   string
  student_name: string
  reason:       string
  suggestion:   string
}

export type MasteryHeatmapRow = {
  substrand:    string
  subject:      string
  avg_level:    number     // 1–4
  pct_below_me: number     // % below Meeting Expectations
  trend:        'improving' | 'stable' | 'declining'
}

// ── Main: build teacher intelligence panel ────────────────────────────────────

export async function buildTeacherPanel(
  classId:   string,
  teacherId: string,
  weekOf?:   string,
): Promise<TeacherPanel> {
  const db  = createServiceClient()
  const now = weekOf ?? new Date().toISOString().slice(0, 10)

  // Load all learner profiles for this class (still needed for heatmap,
  // misconceptions, acceleration, and peer-helper — see the module comment).
  const allProfiles = await getClassLearnerProfiles(classId)

  // Load student names
  const studentNames = await loadStudentNames(classId, db)

  // Batch-recompute projections for the whole class — a class-sized batch
  // (tens of learners) is well within recompute.ts's stated "few hundred" scope.
  const projections = new Map<string, LearnerIntelligenceProjection>(
    await Promise.all(
      allProfiles.map(async p => [p.student_id, await recomputeLearnerProjection(p.student_id)] as const)
    )
  )

  const studentsNeeding  = buildAttentionList(projections, allProfiles, studentNames)
  const misconceptions   = detectHiddenMisconceptions(allProfiles, studentNames)
  const accelerateable   = detectAccelerationCandidates(projections, allProfiles, studentNames)
  const heatmap          = buildMasteryHeatmap(allProfiles)
  const trajectory       = computeClassTrajectory(projections)
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
  projections:  Map<string, LearnerIntelligenceProjection>,
  allProfiles:  LearnerProfile[],
  studentNames: Map<string, string>,
): StudentAttentionItem[] {
  const items: StudentAttentionItem[] = []
  const riskOrder: Record<RiskLevel, number> = { normal: 0, watch: 1, at_risk: 2, critical: 3 }

  const atRisk = [...projections.entries()]
    .map(([studentId, projection]) => ({ studentId, risk: projection.risk?.value ?? null }))
    .filter((r): r is { studentId: string; risk: NonNullable<LearnerIntelligenceProjection['risk']>['value'] } =>
      r.risk !== null && r.risk.overallRiskLevel !== 'normal'
    )
    .sort((a, b) => riskOrder[b.risk.overallRiskLevel] - riskOrder[a.risk.overallRiskLevel])

  for (const { studentId, risk } of atRisk.slice(0, 10)) {
    const name       = studentNames.get(studentId) ?? 'Unknown'
    const topFlag    = [...risk.flags].sort((a, b) => riskFlagSeverityOrder(b.severity) - riskFlagSeverityOrder(a.severity))[0]
    const legacy     = allProfiles.find(p => p.student_id === studentId)
    const weeksAtRisk = legacy ? getWeeksAtRisk(legacy) : 0
    const peerHelper  = legacy ? findPeerHelper(legacy, allProfiles, projections, studentNames) : undefined

    items.push({
      student_id:       studentId,
      student_name:     name,
      risk_level:       risk.overallRiskLevel,
      reason:           topFlag ? topFlag.reason : 'Risk flag active',
      suggested_action: suggestAction(topFlag),
      weeks_at_risk:    weeksAtRisk,
      peer_helper:      peerHelper,
    })
  }

  return items
}

function suggestAction(topFlag: RiskFlag | undefined): string {
  if (!topFlag) return 'Monitor progress and re-assess next week'
  if (topFlag.reason.includes('declining')) return 'Review latest assessment results with the learner'
  if (topFlag.severity === 'critical') return 'Include in small-group remediation session'
  return 'Check in with the learner this week about this specific concern'
}

function findPeerHelper(
  profile:      LearnerProfile,
  allProfiles:  LearnerProfile[],
  projections:  Map<string, LearnerIntelligenceProjection>,
  studentNames: Map<string, string>,
): string | undefined {
  // A peer helper is a student with strong capability in the struggling student's weak subjects
  const weakSubjects = new Set(
    profile.confirmed_gaps.map(g => g.split(':')[0]).filter(Boolean)
  )

  for (const other of allProfiles) {
    if (other.student_id === profile.student_id) continue
    // Risk check sourced from Projection — the same risk engine as the
    // attention list itself — not the legacy overall_risk_level field.
    const otherRisk = projections.get(other.student_id)?.risk?.value.overallRiskLevel ?? 'normal'
    if (otherRisk !== 'normal') continue

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
  projections:  Map<string, LearnerIntelligenceProjection>,
  profiles:     LearnerProfile[],
  studentNames: Map<string, string>,
): AccelerationCandidate[] {
  const candidates: AccelerationCandidate[] = []

  for (const profile of profiles) {
    // Risk check sourced from Projection, not the legacy overall_risk_level
    // field — same risk engine as the attention list and peer-helper matching.
    const risk = projections.get(profile.student_id)?.risk?.value.overallRiskLevel ?? 'normal'
    if (risk !== 'normal') continue

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

function computeClassTrajectory(projections: Map<string, LearnerIntelligenceProjection>): TeacherPanel['class_trajectory'] {
  const trends = [...projections.values()]
    .map(p => p.growth?.value.trend)
    .filter((t): t is 'improving' | 'declining' | 'stable' => t === 'improving' || t === 'declining' || t === 'stable')

  if (trends.length === 0) return 'stable'

  const improving = trends.filter(t => t === 'improving').length
  const declining = trends.filter(t => t === 'declining').length

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
  const { data, error } = await db
    .from('class_students')
    .select('student_id, students(name)')
    .eq('class_id', classId)

  if (error) throw new Error(`loadStudentNames: ${error.message}`)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const name = (row.students as { name?: string } | null)?.name
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

function riskFlagSeverityOrder(s: RiskFlag['severity']): number {
  return { watch: 0, at_risk: 1, critical: 2 }[s]
}
