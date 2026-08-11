import { createServiceClient } from '@/utils/supabase/service'
import { buildTeacherPanel } from '@/lib/attentionFeed/panel'
import type { RiskLevel } from '@/lib/learnerModel/types'
import type { StudentAttentionItem } from '@/lib/attentionFeed/panel'
import type {
  ClassIntelligencePanel,
  StudentIntelligenceSummary,
  PrerequisiteAlert,
  InterventionCheckin,
  CareerMicroMoment,
  TeachingPatternInsight,
} from '@/lib/learnerModel/types'
import type { SubstrandHealthRow } from '@/lib/teachingIntelligence/types'
import type { AttentionItem, AttentionSeverity } from './types'
import { weekBucketOf } from './weekBucket'
import { computeClassPrerequisiteGaps } from './prerequisiteGaps'

function riskToSeverity(risk: RiskLevel): AttentionSeverity | null {
  if (risk === 'normal') return null
  return risk
}

/**
 * Where a per-learner attention item sends the teacher.
 *
 * Every `student_id` reaching this module comes from the legacy space
 * (`learner_profiles.student_id` / the Monday Panel, both keyed on
 * `students.id`), which is exactly what
 * `app/teacher/reports/blueprint/[studentId]` accepts: it resolves the
 * bridged Core learner via `students.external_id` and redirects into the
 * one canonical Blueprint route, which owns its own `requireLearnerAccess`
 * gate and — for a teacher who may manage this learner — renders the
 * candidate queue, the action plan, and both delivery panels. It is the
 * same destination the legacy class roster already links to
 * (`app/teacher/classes/[classId]/page.tsx`), so a teacher arriving from
 * the feed and one arriving from the roster land in the same place.
 *
 * This replaces `/teacher/classes/{classId}/students/{studentId}`, which
 * four call sites below pointed at and which has never existed — no such
 * page, and no rewrite in `next.config.ts`. Every per-learner item in the
 * feed 404'd. Defined once here rather than re-interpolated per call site
 * precisely because it drifted unnoticed in four places.
 *
 * Deliberately NOT authorization: the destination gates itself. This
 * function only decides where to point.
 */
function learnerActionLink(studentId: string): string {
  return `/teacher/reports/blueprint/${studentId}`
}

// When 3+ students share the identical underlying reason, a teacher doesn't
// want to read the same sentence repeated — collapse it into one class-level
// line and only keep individual items for genuinely distinct cases.
const COLLAPSE_THRESHOLD = 3

function collapseSharedReasons<T extends { student_id: string; student_name: string; reason: string }>(
  students: T[],
): { individual: T[]; shared: Map<string, T[]> } {
  const byReason = new Map<string, T[]>()
  for (const s of students) {
    const group = byReason.get(s.reason) ?? []
    group.push(s)
    byReason.set(s.reason, group)
  }

  const individual: T[] = []
  const shared = new Map<string, T[]>()
  for (const [reason, group] of byReason) {
    if (group.length >= COLLAPSE_THRESHOLD) shared.set(reason, group)
    else individual.push(...group)
  }
  return { individual, shared }
}

// ── EILS teacher panel — per class, live-computed from learner profiles ─────
export async function getEilsItems(teacherId: string, classIds: string[]): Promise<AttentionItem[]> {
  const panels = await Promise.all(
    classIds.map((classId) => buildTeacherPanel(classId, teacherId).catch(() => null)),
  )

  const items: AttentionItem[] = []
  for (const panel of panels) {
    if (!panel) continue
    const week = weekBucketOf(panel.generated_at)

    const eligible = panel.students_needing_attention.filter((s) => riskToSeverity(s.risk_level))
    const { individual, shared } = collapseSharedReasons<StudentAttentionItem>(eligible)

    for (const s of individual) {
      items.push({
        itemKey:         `student:${s.student_id}:${week}`,
        source:          'eils',
        severity:        riskToSeverity(s.risk_level)!,
        studentId:       s.student_id,
        studentName:     s.student_name,
        classId:         panel.class_id,
        title:           `${s.student_name} needs attention`,
        detail:          s.reason,
        suggestedAction: s.suggested_action,
        actionLink:      learnerActionLink(s.student_id),
        generatedAt:     panel.generated_at,
        flagship:        false,
      })
    }

    for (const [reason, group] of shared) {
      const worstSeverity = group
        .map((s) => riskToSeverity(s.risk_level)!)
        .sort((a, b) => (a === 'critical' ? -1 : b === 'critical' ? 1 : 0))[0]
      items.push({
        itemKey:         `substrand:${reason}:group:${week}`,
        source:          'eils',
        severity:        worstSeverity,
        studentId:       null,
        studentName:     null,
        classId:         panel.class_id,
        title:           `${group.length} learners need attention`,
        detail:          reason,
        suggestedAction: group[0].suggested_action,
        actionLink:      `/teacher/classes/${panel.class_id}/insights`,
        generatedAt:     panel.generated_at,
        flagship:        false,
      })
    }

    for (const m of panel.hidden_misconceptions) {
      items.push({
        itemKey:         `substrand:${m.substrand}:misconception:${week}`,
        source:          'eils',
        severity:        'watch',
        studentId:       null,
        studentName:     null,
        classId:         panel.class_id,
        title:           `Hidden misconception in ${m.substrand}`,
        detail:          `${m.students_affected} learner(s) affected — ${m.evidence}`,
        suggestedAction: m.suggestion,
        actionLink:      `/teacher/classes/${panel.class_id}/insights`,
        generatedAt:     panel.generated_at,
        flagship:        false,
      })
    }
  }
  return items
}

// ── Monday panel cache — single read, split into tier-gated pieces ─────────
type MondayPanelRow = {
  class_id:            string
  panel_data:          ClassIntelligencePanel
  prerequisite_alerts: PrerequisiteAlert[]
  pending_checkins:    InterventionCheckin[]
  career_moments:      CareerMicroMoment[]
  teaching_patterns:   TeachingPatternInsight[]
  generated_at:        string
}

export async function fetchMondayPanelRows(teacherId: string): Promise<MondayPanelRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('monday_panel_cache')
    .select('class_id, panel_data, prerequisite_alerts, pending_checkins, career_moments, teaching_patterns, generated_at')
    .eq('teacher_id', teacherId)

  if (error) throw new Error(`Failed to fetch Monday panel cache: ${error.message}`)

  return (data ?? []).map((row) => ({
    class_id:            row.class_id as string,
    panel_data:          row.panel_data as unknown as ClassIntelligencePanel,
    prerequisite_alerts: (row.prerequisite_alerts ?? []) as PrerequisiteAlert[],
    pending_checkins:    (row.pending_checkins ?? [])    as InterventionCheckin[],
    career_moments:      (row.career_moments ?? [])      as CareerMicroMoment[],
    teaching_patterns:   (row.teaching_patterns ?? [])   as TeachingPatternInsight[],
    generated_at:        row.generated_at as string,
  }))
}

// Tier 1 — the flagship insight: "they didn't grasp A, so C is at risk."
// Computed live per class from knowledge_state — does not depend on the
// Monday-panel cache having been populated by a prior page visit.
export async function getLivePrerequisiteAlerts(classIds: string[]): Promise<AttentionItem[]> {
  const now  = new Date().toISOString()
  const week = weekBucketOf(now)

  const perClass = await Promise.all(
    classIds.map(async (classId) => {
      const alerts = await computeClassPrerequisiteGaps(classId).catch(() => [])
      return alerts.map((p): AttentionItem => ({
        itemKey:         `substrand:${p.lesson_substrand}:prereq:${week}`,
        source:          'knowledge_graph',
        severity:        p.pct_affected >= 50 ? 'at_risk' : 'watch',
        studentId:       null,
        studentName:     null,
        classId,
        title:           `Missing prerequisite: ${p.missing_prereq}`,
        detail:          `${p.students_affected} learner(s) (${p.pct_affected}%) lack this before ${p.lesson_substrand}`,
        suggestedAction: p.suggested_warmup,
        actionLink:      `/teacher/classes/${classId}/insights`,
        generatedAt:     now,
        flagship:        true,
      }))
    }),
  )
  return perClass.flat()
}

// Tier 2 — per-student risk summary (dedupes against EILS's own version).
export function mapMondayStudentRisk(rows: MondayPanelRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of rows) {
    const week = weekBucketOf(row.generated_at)
    const withReason = (row.panel_data?.students_needing_attention ?? []).map((s: StudentIntelligenceSummary) => ({
      ...s,
      reason: s.top_flags.map((f) => f.detail).join('; ') || s.action,
    }))
    const eligible = withReason.filter((s) => riskToSeverity(s.risk_level))
    const { individual, shared } = collapseSharedReasons<StudentIntelligenceSummary & { reason: string }>(eligible)

    for (const s of individual) {
      items.push({
        itemKey:         `student:${s.student_id}:${week}`,
        source:          'monday_panel',
        severity:        riskToSeverity(s.risk_level)!,
        studentId:       s.student_id,
        studentName:     s.student_name,
        classId:         row.class_id,
        title:           `${s.student_name} needs attention`,
        detail:          s.reason,
        suggestedAction: s.action,
        actionLink:      learnerActionLink(s.student_id),
        generatedAt:     row.generated_at,
        flagship:        false,
      })
    }

    for (const [reason, group] of shared) {
      const worstSeverity = group
        .map((s) => riskToSeverity(s.risk_level)!)
        .sort((a, b) => (a === 'critical' ? -1 : b === 'critical' ? 1 : 0))[0]
      items.push({
        itemKey:         `substrand:${reason}:group:${week}`,
        source:          'monday_panel',
        severity:        worstSeverity,
        studentId:       null,
        studentName:     null,
        classId:         row.class_id,
        title:           `${group.length} learners need attention`,
        detail:          reason,
        suggestedAction: group[0].action,
        actionLink:      `/teacher/classes/${row.class_id}/insights`,
        generatedAt:     row.generated_at,
        flagship:        false,
      })
    }
  }
  return items
}

// Tier 2 — 14-day intervention follow-ups due.
export function mapInterventionCheckins(rows: MondayPanelRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of rows) {
    for (const c of row.pending_checkins) {
      items.push({
        itemKey:         `checkin:${c.intervention_id}`,
        source:          'monday_panel',
        severity:        'watch',
        studentId:       c.student_id,
        studentName:     c.student_name,
        classId:         row.class_id,
        title:           `Follow-up due: ${c.student_name}`,
        detail:          `${c.intervention_type} for ${c.substrand} — due ${c.due_date}`,
        suggestedAction: 'Check whether the intervention worked and log the outcome.',
        actionLink:      learnerActionLink(c.student_id),
        generatedAt:     row.generated_at,
        flagship:        false,
      })
    }
  }
  return items
}

// Tier 3 — capability milestones worth telling a parent about.
export function mapCareerMoments(rows: MondayPanelRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of rows) {
    const week = weekBucketOf(row.generated_at)
    for (const m of row.career_moments) {
      items.push({
        itemKey:         `career:${m.student_id}:${m.moment_type}:${week}`,
        source:          'monday_panel',
        severity:        'info',
        studentId:       m.student_id,
        studentName:     m.student_name,
        classId:         row.class_id,
        title:           `Milestone: ${m.student_name}`,
        detail:          m.message,
        suggestedAction: null,
        actionLink:      learnerActionLink(m.student_id),
        generatedAt:     row.generated_at,
        flagship:        false,
      })
    }
  }
  return items
}

// Tier 3 — teacher's own formative-signal patterns (self-insight, lowest urgency).
export function mapTeachingPatterns(rows: MondayPanelRow[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of rows) {
    const week = weekBucketOf(row.generated_at)
    for (const p of row.teaching_patterns) {
      items.push({
        itemKey:         `pattern:${p.pattern}:${week}`,
        source:          'monday_panel',
        severity:        'info',
        studentId:       null,
        studentName:     null,
        classId:         row.class_id,
        title:           p.pattern,
        detail:          `Seen ${p.count} time(s) across ${p.substrands.join(', ')}`,
        suggestedAction: p.suggestion,
        actionLink:      `/teacher/classes/${row.class_id}/insights`,
        generatedAt:     row.generated_at,
        flagship:        false,
      })
    }
  }
  return items
}

// ── Weekly intelligence (TIE) — latest row per teacher ───────────────────────
export async function getWeeklyIntelligenceItems(teacherId: string): Promise<AttentionItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('weekly_intelligence')
    .select('sow_id, week_number, new_flags, persistent_flags, created_at')
    .eq('teacher_id', teacherId)
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch weekly intelligence: ${error.message}`)
  if (!data) return []

  const week = weekBucketOf(data.created_at as string)
  const items: AttentionItem[] = []

  const newFlags        = (data.new_flags ?? [])        as SubstrandHealthRow[]
  const persistentFlags = (data.persistent_flags ?? [])  as SubstrandHealthRow[]

  for (const f of newFlags) {
    items.push({
      itemKey:         `substrand:${f.sub_strand}:health:${week}`,
      source:          'weekly_intelligence',
      severity:        'watch',
      studentId:       null,
      studentName:     null,
      classId:         null,
      title:           `New struggle signal: ${f.sub_strand}`,
      detail:          `${f.strand} — ${f.struggle_count} struggle event(s) across ${f.lessons_covered} lesson(s)`,
      suggestedAction: 'Review the remedial bank item for this substrand.',
      actionLink:      `/teacher/scheme-of-work/${f.sow_id}`,
      generatedAt:     data.created_at as string,
      flagship:        false,
    })
  }

  for (const f of persistentFlags) {
    items.push({
      itemKey:         `substrand:${f.sub_strand}:health:${week}`,
      source:          'weekly_intelligence',
      severity:        'at_risk',
      studentId:       null,
      studentName:     null,
      classId:         null,
      title:           `Persistent struggle: ${f.sub_strand}`,
      detail:          `${f.strand} — unresolved for multiple weeks (${f.struggle_count} struggle events)`,
      suggestedAction: 'This substrand needs a different teaching approach, not just repetition.',
      actionLink:      `/teacher/scheme-of-work/${f.sow_id}`,
      generatedAt:     data.created_at as string,
      flagship:        false,
    })
  }

  return items
}

// ── Student alerts — basic operational monitoring, always on ────────────────
const ACADEMIC_ALERT_TYPES = new Set(['declining_scores', 'repeated_struggles', 'inactive', 'holiday_inactive'])

export async function getStudentAlertItems(teacherId: string): Promise<AttentionItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('student_alerts')
    .select('id, student_id, alert_type, message, created_at, students(name)')
    .eq('teacher_id', teacherId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch student alerts: ${error.message}`)

  type AlertRow = {
    id: string
    student_id: string
    alert_type: string
    message: string
    created_at: string
    students: { name: string } | null
  }

  return ((data ?? []) as unknown as AlertRow[]).map((a) => {
    const week      = weekBucketOf(a.created_at)
    const isCritical = a.alert_type === 'inactive' || a.alert_type === 'holiday_inactive'
    const itemKey   = ACADEMIC_ALERT_TYPES.has(a.alert_type)
      ? `student:${a.student_id}:${week}`
      : `alert:${a.id}`

    return {
      itemKey,
      source:          'student_alert' as const,
      severity:        (isCritical ? 'critical' : 'at_risk') as AttentionSeverity,
      studentId:       a.student_id,
      studentName:     a.students?.name ?? null,
      classId:         null,
      title:           a.students?.name ? `${a.students.name}: ${a.alert_type.replace(/_/g, ' ')}` : a.alert_type.replace(/_/g, ' '),
      detail:          a.message,
      suggestedAction: null,
      actionLink:      '/teacher/alerts',
      generatedAt:     a.created_at,
      flagship:        false,
    }
  })
}
