// lib/school/intelligence.ts
// School Intelligence aggregation engine.
//
// Reads from learner_profiles, intervention_log, substrand_health, formative_signals.
// Produces aggregated intelligence for principals and HoDs.
//
// Privacy contract enforced here: no student PII leaves this module
// in the school-level output. Only anonymised counts and percentages.

import { createServiceClient } from '@/utils/supabase/service'
import type {
  SchoolIntelligenceSummary, StrandHealthRecord, GradeHealthRecord,
  InterventionEfficacyRecord, TeacherActivitySignal, PrincipalDashboard,
} from './types'

// ── Main: compute full school intelligence ────────────────────────────────────

export async function computeSchoolIntelligence(
  schoolId: string,
  weekOf?:  string,
): Promise<SchoolIntelligenceSummary> {
  const db  = createServiceClient()
  const now = weekOf ?? new Date().toISOString().slice(0, 10)

  // 1. Find all teachers belonging to this school
  const { data: teachers } = await db
    .from('teachers')
    .select('id, user_id, grade_levels, subjects')
    .eq('school_name', schoolId)
    .eq('is_verified', true)

  if (!teachers?.length) {
    return buildEmptySummary(schoolId, now)
  }

  const teacherUserIds = teachers.map(t => t.user_id as string)
  const teacherIds     = teachers.map(t => t.id as string)

  // 2. Find all classes taught by these teachers
  const { data: classes } = await db
    .from('teacher_classes')
    .select('id, grade, subject, teacher_id')
    .in('teacher_id', teacherIds)

  if (!classes?.length) {
    return buildEmptySummary(schoolId, now)
  }

  const classIds = classes.map(c => c.id as string)

  // 3. Find all enrolled students across all classes
  const { data: enrollments } = await db
    .from('class_students')
    .select('student_id, class_id')
    .in('class_id', classIds)

  if (!enrollments?.length) {
    return buildEmptySummary(schoolId, now)
  }

  const studentIds = [...new Set(enrollments.map(e => e.student_id as string))]

  // 4. Load learner profiles (only the fields we need — no PII beyond student_id)
  const { data: profiles } = await db
    .from('learner_profiles')
    .select(
      'student_id, overall_risk_level, capability_dimensions, risk_history, knowledge_state'
    )
    .in('student_id', studentIds)

  const profileList = profiles ?? []

  // 5. Risk distribution
  const riskDist = { normal: 0, watch: 0, at_risk: 0, critical: 0 }
  for (const p of profileList) {
    const level = (p.overall_risk_level as string) ?? 'normal'
    if (level in riskDist) riskDist[level as keyof typeof riskDist]++
    else riskDist.normal++
  }

  const total = profileList.length || 1
  const riskPcts = {
    normal:   Math.round((riskDist.normal   / total) * 100),
    watch:    Math.round((riskDist.watch    / total) * 100),
    at_risk:  Math.round((riskDist.at_risk  / total) * 100),
    critical: Math.round((riskDist.critical / total) * 100),
  }

  // 6. School-wide capability averages
  const capabilityDims = ['analytical_reasoning', 'communication', 'creative_thinking',
                          'technical_aptitude', 'social_intelligence', 'resilience']
  const capabilityTotals: Record<string, number> = {}
  const capabilityCounts: Record<string, number> = {}

  for (const p of profileList) {
    const dims = (p.capability_dimensions as Record<string, { raw_score?: number }>) ?? {}
    for (const dim of capabilityDims) {
      const score = dims[dim]?.raw_score
      if (score != null) {
        capabilityTotals[dim] = (capabilityTotals[dim] ?? 0) + score
        capabilityCounts[dim] = (capabilityCounts[dim] ?? 0) + 1
      }
    }
  }

  const avgCapability: Record<string, number> = {}
  for (const dim of capabilityDims) {
    if (capabilityCounts[dim]) {
      avgCapability[dim] = Math.round((capabilityTotals[dim] / capabilityCounts[dim]) * 100) / 100
    }
  }

  // 7. Persistent risk count (at_risk for 4+ consecutive weeks)
  let persistentRiskCount = 0
  for (const p of profileList) {
    const history = (p.risk_history as Array<{ consecutive_weeks?: number; resolved_at?: string }>) ?? []
    const hasPersistent = history.some(r => !r.resolved_at && (r.consecutive_weeks ?? 0) >= 4)
    if (hasPersistent) persistentRiskCount++
  }

  // 8. Top struggling substrands from substrand_health table
  const { data: healthRows } = await db
    .from('substrand_health')
    .select('subject, sub_strand, strand, struggle_count, total_students, assessment_level, trend, risk_score')
    .in('class_id', classIds)
    .gt('risk_score', 30)   // only meaningful struggle (30%+ below ME)
    .order('risk_score', { ascending: false })
    .limit(5)

  const topStrugglingStrands: StrandHealthRecord[] = (healthRows ?? []).map(row => ({
    subject:        row.subject as string,
    substrand:      row.sub_strand as string,
    grade:          0,   // aggregated — grade breakdown in grade_health
    pct_below_me:   row.risk_score as number,
    struggle_count: row.struggle_count as number,
    total_students: row.total_students as number,
    trend:          (row.trend as StrandHealthRecord['trend']) ?? 'stable',
    weeks_declining: 0,
    avg_level:      row.assessment_level as number,
    teacher_count:  1,
  }))

  // 9. Intervention efficacy
  const { data: interventions } = await db
    .from('intervention_log')
    .select('intervention_type, was_effective, checkin_completed_at')
    .in('teacher_id', teacherUserIds)

  const interventionCount = interventions?.length ?? 0
  const effectiveCount    = interventions?.filter(i => i.was_effective === true).length ?? 0
  const efficacyRate      = interventionCount > 0 ? effectiveCount / interventionCount : 0

  // 10. Risk trend (compare to previous snapshot)
  const { data: prevSnapshot } = await db
    .from('school_intelligence_snapshots')
    .select('at_risk_count, critical_count, total_students')
    .eq('school_id', schoolId)
    .is('grade', null)
    .is('subject', null)
    .order('week_of', { ascending: false })
    .limit(1)
    .maybeSingle()

  let riskTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (prevSnapshot) {
    const prevAtRiskPct = ((prevSnapshot.at_risk_count as number) + (prevSnapshot.critical_count as number))
                         / ((prevSnapshot.total_students as number) || 1) * 100
    const currAtRiskPct = riskPcts.at_risk + riskPcts.critical
    if (currAtRiskPct < prevAtRiskPct - 2) riskTrend = 'improving'
    else if (currAtRiskPct > prevAtRiskPct + 2) riskTrend = 'declining'
  }

  const summary: SchoolIntelligenceSummary = {
    school_id:         schoolId,
    week_of:           now,
    total_students:    total,
    total_teachers:    teachers.length,
    total_classes:     classes.length,
    risk_distribution: riskDist,
    risk_pcts:         riskPcts,
    risk_trend:        riskTrend,
    top_struggling_strands: topStrugglingStrands,
    grade_health:      await computeGradeHealth(db, classes, profileList, enrollments),
    persistent_risk_count: persistentRiskCount,
    interventions_this_term: interventionCount,
    intervention_efficacy:   Math.round(efficacyRate * 100) / 100,
    avg_capability_dimensions: avgCapability,
    generated_at: new Date().toISOString(),
  }

  // Persist snapshot for trend analysis (best-effort — non-fatal)
  try {
    await db.from('school_intelligence_snapshots').upsert({
      school_id:                   schoolId,
      week_of:                     now,
      grade:                       null,
      subject:                     null,
      total_students:              total,
      normal_count:                riskDist.normal,
      watch_count:                 riskDist.watch,
      at_risk_count:               riskDist.at_risk,
      critical_count:              riskDist.critical,
      top_struggling_substrands:   topStrugglingStrands,
      interventions_run:           interventionCount,
      interventions_effective:     effectiveCount,
      avg_capability_dimensions:   avgCapability,
      risk_trend:                  riskTrend,
    }, { onConflict: 'school_id,week_of,grade,subject', ignoreDuplicates: false })
  } catch {
    // non-fatal
  }

  return summary
}

// ── Grade-level health breakdown ──────────────────────────────────────────────

async function computeGradeHealth(
  db:          ReturnType<typeof createServiceClient>,
  classes:     Array<{ id: string; grade: unknown; subject: unknown; teacher_id: unknown }>,
  profileList: Array<{ student_id: string; overall_risk_level: unknown; capability_dimensions: unknown }>,
  enrollments: Array<{ student_id: string; class_id: string }>,
): Promise<GradeHealthRecord[]> {
  // Build map: student_id → grade
  const studentGradeMap = new Map<string, number>()
  const enrollmentMap   = new Map<string, string>()  // student_id → class_id

  for (const e of enrollments) {
    enrollmentMap.set(e.student_id, e.class_id)
  }
  for (const cls of classes) {
    for (const [studentId, classId] of enrollmentMap) {
      if (classId === cls.id) {
        studentGradeMap.set(studentId, cls.grade as number)
      }
    }
  }

  // Group profiles by grade
  const byGrade = new Map<number, typeof profileList>()
  for (const p of profileList) {
    const grade = studentGradeMap.get(p.student_id)
    if (!grade) continue
    if (!byGrade.has(grade)) byGrade.set(grade, [])
    byGrade.get(grade)!.push(p)
  }

  const records: GradeHealthRecord[] = []
  for (const [grade, gradeProfiles] of byGrade) {
    const dist = { normal: 0, watch: 0, at_risk: 0, critical: 0 }
    for (const p of gradeProfiles) {
      const level = (p.overall_risk_level as string) ?? 'normal'
      if (level in dist) dist[level as keyof typeof dist]++
    }
    const t = gradeProfiles.length || 1

    records.push({
      grade,
      total_students: gradeProfiles.length,
      normal_pct:   Math.round((dist.normal   / t) * 100),
      watch_pct:    Math.round((dist.watch    / t) * 100),
      at_risk_pct:  Math.round((dist.at_risk  / t) * 100),
      critical_pct: Math.round((dist.critical / t) * 100),
      avg_capability: {},
      trend: 'stable',
    })
  }

  return records.sort((a, b) => a.grade - b.grade)
}

// ── Intervention Efficacy Breakdown ──────────────────────────────────────────

export async function computeInterventionEfficacy(
  teacherUserIds: string[],
): Promise<InterventionEfficacyRecord[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('intervention_log')
    .select('intervention_type, was_effective, checkin_completed_at, intervened_at')
    .in('teacher_id', teacherUserIds)
    .not('checkin_completed_at', 'is', null)

  if (!data?.length) return []

  const byType = new Map<string, { total: number; effective: number }>()
  for (const row of data) {
    const type = row.intervention_type as string
    if (!byType.has(type)) byType.set(type, { total: 0, effective: 0 })
    const entry = byType.get(type)!
    entry.total++
    if (row.was_effective) entry.effective++
  }

  return [...byType.entries()].map(([type, { total, effective }]) => ({
    intervention_type:   type,
    total_run:           total,
    total_with_outcome:  total,
    effective_count:     effective,
    efficacy_rate:       Math.round((effective / total) * 100) / 100,
    avg_days_to_improve: null,
  }))
}

// ── Teacher Activity Signals ──────────────────────────────────────────────────

export async function computeTeacherActivity(
  teacherIds:     string[],
  teacherUserIds: string[],
): Promise<TeacherActivitySignal[]> {
  const db      = createServiceClient()
  const termStart = getTermStart()

  const signals: TeacherActivitySignal[] = []

  for (let i = 0; i < teacherIds.length; i++) {
    const teacherId     = teacherIds[i]
    const teacherUserId = teacherUserIds[i]

    // Formative signal count this term
    const { count: signalCount } = await db
      .from('formative_signals')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .gte('recorded_at', termStart)

    // Classes and at-risk students
    const { data: classes } = await db
      .from('teacher_classes')
      .select('id, grade, subject')
      .eq('teacher_id', teacherId)

    let atRisk = 0; let atRiskResolved = 0
    for (const cls of classes ?? []) {
      const { data: enrolled } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', cls.id as string)

      const studentIds = (enrolled ?? []).map(e => e.student_id as string)
      if (!studentIds.length) continue

      const { data: profiles } = await db
        .from('learner_profiles')
        .select('overall_risk_level, risk_history')
        .in('student_id', studentIds)

      for (const p of profiles ?? []) {
        if (['at_risk', 'critical'].includes(p.overall_risk_level as string)) atRisk++
        const history = (p.risk_history as Array<{ resolved_at?: string }>) ?? []
        if (history.some(r => r.resolved_at)) atRiskResolved++
      }
    }

    // Intervention efficacy
    const { data: interventions } = await db
      .from('intervention_log')
      .select('was_effective')
      .eq('teacher_id', teacherUserId)
      .not('checkin_completed_at', 'is', null)

    const withOutcome  = (interventions ?? []).length
    const effective    = (interventions ?? []).filter(i => i.was_effective).length
    const efficacy     = withOutcome > 0 ? effective / withOutcome : 0

    signals.push({
      teacher_id:    `teacher_${i + 1}`,  // anonymised
      grade:         (classes?.[0]?.grade as number) ?? 0,
      subject:       (classes?.[0]?.subject as string) ?? 'unknown',
      formative_signal_count_this_term: signalCount ?? 0,
      at_risk_students:    atRisk,
      at_risk_resolved:    atRiskResolved,
      intervention_efficacy: Math.round(efficacy * 100) / 100,
      last_active:   new Date().toISOString(),
    })
  }

  return signals
}

// ── Principal Dashboard ───────────────────────────────────────────────────────

export async function buildPrincipalDashboard(schoolId: string): Promise<PrincipalDashboard> {
  const db = createServiceClient()

  const { data: teachers } = await db
    .from('teachers')
    .select('id, user_id, grade_levels, subjects')
    .eq('school_name', schoolId)
    .eq('is_verified', true)

  const teacherIds     = (teachers ?? []).map(t => t.id as string)
  const teacherUserIds = (teachers ?? []).map(t => t.user_id as string)

  const [summary, efficacy, activity] = await Promise.all([
    computeSchoolIntelligence(schoolId),
    computeInterventionEfficacy(teacherUserIds),
    computeTeacherActivity(teacherIds, teacherUserIds),
  ])

  // Trend vs last term
  const { data: prevTermSnapshot } = await db
    .from('school_intelligence_snapshots')
    .select('at_risk_count, critical_count, total_students, top_struggling_substrands')
    .eq('school_id', schoolId)
    .is('grade', null)
    .is('subject', null)
    .order('week_of', { ascending: false })
    .range(1, 2)   // skip current (index 0), get previous
    .maybeSingle()

  const prevAtRiskPct = prevTermSnapshot
    ? (((prevTermSnapshot.at_risk_count as number) + (prevTermSnapshot.critical_count as number))
       / ((prevTermSnapshot.total_students as number) || 1)) * 100
    : null

  const currAtRiskPct = summary.risk_pcts.at_risk + summary.risk_pcts.critical
  const riskChangePct = prevAtRiskPct != null ? currAtRiskPct - prevAtRiskPct : 0

  return {
    summary,
    top_strand_concerns:   summary.top_struggling_strands,
    grade_breakdown:       summary.grade_health,
    intervention_efficacy: efficacy,
    teacher_activity:      activity,
    trend_vs_last_term: {
      risk_change_pct:       Math.round(riskChangePct * 10) / 10,
      top_improved_strand:   null,
      top_declined_strand:   summary.top_struggling_strands[0]?.substrand ?? null,
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEmptySummary(schoolId: string, weekOf: string): SchoolIntelligenceSummary {
  return {
    school_id:       schoolId,
    week_of:         weekOf,
    total_students:  0,
    total_teachers:  0,
    total_classes:   0,
    risk_distribution: { normal: 0, watch: 0, at_risk: 0, critical: 0 },
    risk_pcts:       { normal: 0, watch: 0, at_risk: 0, critical: 0 },
    risk_trend:      'stable',
    top_struggling_strands: [],
    grade_health:    [],
    persistent_risk_count: 0,
    interventions_this_term: 0,
    intervention_efficacy: 0,
    avg_capability_dimensions: {},
    generated_at: new Date().toISOString(),
  }
}

function getTermStart(): string {
  // Approximate: terms start Jan, May, Sep in Kenya CBC calendar
  const now   = new Date()
  const month = now.getMonth()
  let termStart: Date

  if (month < 4)       termStart = new Date(now.getFullYear(), 0, 6)   // Jan
  else if (month < 8)  termStart = new Date(now.getFullYear(), 4, 5)   // May
  else                 termStart = new Date(now.getFullYear(), 8, 1)   // Sep

  return termStart.toISOString()
}
