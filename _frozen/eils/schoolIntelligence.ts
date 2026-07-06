// lib/eils/schoolIntelligence.ts
// Layer 8 — School Intelligence
//
// Wraps lib/school/intelligence.ts and adds EILS-specific overlays:
//   - Curriculum gap detection (subjects + grades where risk is concentrated)
//   - Teaching effectiveness metrics (via intervention tracking)
//   - Resource need identification (what materials/tools are missing)
//   - Risk cluster mapping (which subject×grade combinations are most at risk)
//
// Privacy contract: no student PII in school-level output — only counts and %s.

import { createServiceClient } from '@/utils/supabase/service'
import { computeSchoolIntelligence } from '@/lib/school/intelligence'
import type { EILSSchoolIntelligence, CurriculumGap, ResourceNeed, RiskCluster, TeacherEffectivenessRow } from './types'

// ── Main: build school intelligence overlay ───────────────────────────────────

export async function buildSchoolIntelligence(
  schoolId: string,
  weekOf?:  string,
): Promise<EILSSchoolIntelligence> {
  const db  = createServiceClient()
  const now = weekOf ?? new Date().toISOString().slice(0, 10)

  // Get base school intelligence from existing system
  const base = await computeSchoolIntelligence(schoolId, weekOf)

  // Add EILS overlays in parallel
  const [curriculumGaps, teacherEffectiveness, resourceNeeds, riskClusters] = await Promise.all([
    detectCurriculumGaps(base),
    computeTeacherEffectiveness(schoolId, db),
    identifyResourceNeeds(base, curriculumGapsStub()),
    buildRiskClusters(base),
  ])

  // Re-run curriculum gaps with actual data now that we have it
  const finalCurriculumGaps = detectCurriculumGaps(base)

  const schoolGrowthTrend = base.risk_trend

  return {
    school_id:              schoolId,
    week_of:                now,
    curriculum_gaps:        await finalCurriculumGaps,
    teaching_effectiveness: teacherEffectiveness,
    resource_needs:         identifyResourceNeedsSync(base, await finalCurriculumGaps),
    risk_clusters:          riskClusters,
    school_growth_trend:    schoolGrowthTrend,
    generated_at:           new Date().toISOString(),
  }
}

// ── Curriculum Gaps ───────────────────────────────────────────────────────────
// A curriculum gap = a substrand where ≥40% of students are below ME across a grade.

async function detectCurriculumGaps(
  base: Awaited<ReturnType<typeof computeSchoolIntelligence>>,
): Promise<CurriculumGap[]> {
  const gaps: CurriculumGap[] = []

  for (const strand of base.top_struggling_strands) {
    const pctAffected = strand.total_students > 0
      ? Math.round((strand.struggle_count / strand.total_students) * 100)
      : 0

    if (pctAffected < 25) continue   // below threshold — not a curriculum gap

    const severity: CurriculumGap['severity'] =
      pctAffected >= 60 ? 'high' :
      pctAffected >= 40 ? 'medium' : 'low'

    gaps.push({
      subject:      strand.subject,
      substrand:    strand.substrand,
      grade:        strand.grade,
      severity,
      pct_affected: pctAffected,
      recommendation: buildGapRecommendation(strand.subject, strand.substrand, severity),
    })
  }

  return gaps.sort((a, b) => b.pct_affected - a.pct_affected).slice(0, 10)
}

function buildGapRecommendation(subject: string, substrand: string, severity: CurriculumGap['severity']): string {
  if (severity === 'high') {
    return `School-wide intervention needed for ${substrand} in ${subject?.replace(/_/g, ' ')}. Consider a coordinated re-teaching session across all classes in the affected grade.`
  }
  if (severity === 'medium') {
    return `Multiple classes struggling with ${substrand} — share successful teaching strategies across teachers in ${subject?.replace(/_/g, ' ')}.`
  }
  return `Monitor ${substrand} in ${subject?.replace(/_/g, ' ')} — some classes are below expected levels.`
}

// ── Teacher Effectiveness ─────────────────────────────────────────────────────

async function computeTeacherEffectiveness(
  schoolId: string,
  db:       ReturnType<typeof createServiceClient>,
): Promise<TeacherEffectivenessRow[]> {
  // Load teachers + their intervention outcomes
  const { data: teachers } = await db
    .from('school_users')
    .select('user_id, role')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')

  if (!teachers?.length) return []

  const teacherUserIds = teachers.map(t => t.user_id as string)

  const { data: interventions } = await db
    .from('intervention_log')
    .select('teacher_user_id, intervention_type, was_effective')
    .in('teacher_user_id', teacherUserIds)

  if (!interventions?.length) return []

  // Group by teacher (anonymised)
  const byTeacher = new Map<string, { total: number; effective: number; types: string[] }>()
  for (const row of interventions) {
    const tid = row.teacher_user_id as string
    if (!byTeacher.has(tid)) byTeacher.set(tid, { total: 0, effective: 0, types: [] })
    const entry = byTeacher.get(tid)!
    entry.total++
    if (row.was_effective) entry.effective++
    if (!entry.types.includes(row.intervention_type as string)) entry.types.push(row.intervention_type as string)
  }

  const rows: TeacherEffectivenessRow[] = []
  let idx = 1
  for (const [, { total, effective }] of byTeacher) {
    rows.push({
      teacher_id:          `teacher_${idx++}`,  // anonymised
      grade:               0,
      subject:             'mixed',
      intervention_count:  total,
      efficacy_rate:       total > 0 ? Math.round((effective / total) * 100) / 100 : 0,
      risk_resolved_count: effective,
    })
  }

  return rows
}

// ── Resource Needs ────────────────────────────────────────────────────────────

function identifyResourceNeedsSync(
  base:            Awaited<ReturnType<typeof computeSchoolIntelligence>>,
  curriculumGaps:  CurriculumGap[],
): ResourceNeed[] {
  const needs: ResourceNeed[] = []

  // High-severity curriculum gaps → need remedial materials
  for (const gap of curriculumGaps.filter(g => g.severity === 'high')) {
    needs.push({
      subject:     gap.subject,
      grade:       gap.grade,
      need_type:   'remedial_materials',
      description: `Remedial materials needed for ${gap.substrand} — ${gap.pct_affected}% of students below ME`,
      urgency:     'high',
    })
  }

  // Low Compass topic coverage → need Compass topic expansion
  const compassGap = base.top_struggling_strands.find(s => s.struggle_count > 5)
  if (compassGap) {
    needs.push({
      subject:     compassGap.subject,
      grade:       compassGap.grade,
      need_type:   'compass_topics',
      description: `More Compass practice topics needed for ${compassGap.substrand}`,
      urgency:     'medium',
    })
  }

  // High persistent risk count → teacher support
  if (base.persistent_risk_count > base.total_students * 0.1) {
    needs.push({
      subject:     'all',
      grade:       0,
      need_type:   'teacher_support',
      description: `${base.persistent_risk_count} students have persistent risk (4+ weeks) — teachers may need professional support or reduced class sizes`,
      urgency:     base.persistent_risk_count > base.total_students * 0.2 ? 'high' : 'medium',
    })
  }

  return needs.slice(0, 8)
}

async function identifyResourceNeeds(
  base:           Awaited<ReturnType<typeof computeSchoolIntelligence>>,
  curriculumGaps: CurriculumGap[],
): Promise<ResourceNeed[]> {
  return identifyResourceNeedsSync(base, curriculumGaps)
}

// ── Risk Clusters ─────────────────────────────────────────────────────────────
// Identifies subject×grade combinations where multiple students have been at risk
// for multiple weeks — these are systemic, not individual issues.

async function buildRiskClusters(
  base: Awaited<ReturnType<typeof computeSchoolIntelligence>>,
): Promise<RiskCluster[]> {
  const clusters: RiskCluster[] = []

  for (const grade of base.grade_health) {
    if (grade.at_risk_pct + grade.critical_pct < 20) continue  // threshold: 20%+ at risk

    const riskLevel = grade.critical_pct >= 15 ? 'critical' :
                      grade.at_risk_pct >= 20 ? 'at_risk' : 'watch'

    // Find the worst substrand for this grade
    const worstStrand = base.top_struggling_strands[0]

    clusters.push({
      subject:       worstStrand?.subject ?? 'multiple',
      substrand:     worstStrand?.substrand ?? 'multiple',
      grade:         grade.grade,
      student_count: Math.round((grade.at_risk_pct / 100) * grade.total_students),
      risk_level:    riskLevel as RiskCluster['risk_level'],
      weeks_active:  4,  // conservative estimate — would need per-grade history for precision
    })
  }

  return clusters.sort((a, b) => b.student_count - a.student_count).slice(0, 5)
}

// ── Stubs ─────────────────────────────────────────────────────────────────────

function curriculumGapsStub(): CurriculumGap[] { return [] }
