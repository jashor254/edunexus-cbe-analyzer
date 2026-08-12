// lib/learnerBlueprint/classBlueprintPure.ts
//
// The Class Blueprint's computation, with no I/O — the same pure/IO split
// lib/teacherWorkspace/classDetailProjection.ts already uses, so every rule
// below is unit-testable against hand-built fixtures with no database.
//
// What this is for
// ----------------
// The Blueprint is a per-learner document, and a Kenyan junior-school teacher
// has 40-70 learners on the register (national junior ratio ~1:38, above 1:70
// in some rural schools). Reading 52 four-page narratives is not a workflow, so
// the teacher had no usable entry point into any of this. This module produces
// the scannable form: one row per learner, sorted so the learners who need
// attention are already at the top.
//
// What it deliberately is NOT
// ---------------------------
// Not a second intelligence engine. Every value here is selected from a
// Projection the canonical engine already computed — no new scoring, no new
// thresholds beyond the CBC level bands the platform already uses everywhere,
// and no per-learner Blueprint composition (which would be ~10 queries each).
//
// Not a ranking. KNEC publicly warned schools in December 2025 against
// circulating analyses that use aggregate scores or school mean scores, calling
// them inconsistent with CBE. This module therefore computes NO mean, NO total
// and NO position, and the sort is by "needs attention" — a support-ordering,
// not a merit-ordering. `ClassLevelDistribution` gives leadership the shape of
// a class without ever producing a rankable number.
//
// Honest about staleness: rows are built from PERSISTED projections, which are
// written when evidence changes rather than on read. Every row carries its own
// `projectionAsOf` so the UI can say when the picture was last computed instead
// of implying it is live.

import type { AcademicValue, RiskValue, SubjectPerformance, Trend } from '@/lib/projection/types'
import type { BlueprintGradeBand } from './gradeBand'
import { getGradeBand } from './gradeBand'

/** CBC levels at or below this need a teacher's attention — the same 1-4 banding the rest of the platform uses. */
export const ATTENTION_LEVEL_CEILING = 2

export type ClassBlueprintSubject = {
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  trend: Trend
  evidenceCount: number
}

/**
 * Why a learner is near the top of the list. Ordered by urgency; the first
 * matching reason wins so a row never shows a pile of overlapping labels.
 */
export type ClassAttentionReason =
  | 'no_evidence'
  | 'not_bridged'
  | 'at_risk'
  | 'multiple_subjects_below'
  | 'one_subject_below'
  | 'declining'
  | 'none'

export type ClassBlueprintRow = {
  coreLearnerId: string
  learnerName: string
  admissionNumber: string | null
  gradeBand: BlueprintGradeBand
  /** False when this learner has no legacy identity yet, so no Projection can exist for them at all. */
  bridged: boolean
  subjects: ClassBlueprintSubject[]
  /** Subjects currently at or below ATTENTION_LEVEL_CEILING. */
  subjectsNeedingAttention: string[]
  lowestLevel: 1 | 2 | 3 | 4 | null
  riskLevel: RiskValue['overallRiskLevel'] | null
  /** Total confirmed evidence behind this learner's academic picture. */
  evidenceCount: number
  attentionReason: ClassAttentionReason
  /** When this learner's Projection was last computed — null when they have none. */
  projectionAsOf: string | null
}

/** The shape of a class, without any rankable aggregate. */
export type ClassLevelDistribution = {
  /** How many learners sit at each CBC level, counted by their lowest subject. */
  byLowestLevel: Record<1 | 2 | 3 | 4, number>
  learnersWithEvidence: number
  learnersWithoutEvidence: number
  learnersNotBridged: number
  learnersNeedingAttention: number
}

export type ClassBlueprint = {
  classId: string
  className: string | null
  termId: string
  rows: ClassBlueprintRow[]
  distribution: ClassLevelDistribution
  /** Oldest `projectionAsOf` across rows that have one — the honest "this page is at least this stale" marker. */
  oldestProjectionAsOf: string | null
}

// ── Inputs (already fetched by the I/O wrapper) ──────────────────────────────

export type RosterLearner = {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  admission_number?: string | null
  current_class_name?: string | null
}

export type LearnerProjectionInput = {
  /** Core learners.id — the wrapper maps legacy student ids back before calling in. */
  coreLearnerId: string
  academic: AcademicValue | null
  risk: RiskValue | null
  evidenceCount: number
  lastComputed: string | null
}

export function learnerDisplayName(learner: RosterLearner): string {
  return [learner.first_name, learner.middle_name, learner.last_name]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(' ')
    .trim()
}

function subjectsFrom(academic: AcademicValue | null): ClassBlueprintSubject[] {
  if (!academic) return []
  return Object.values(academic.bySubject)
    .map((s: SubjectPerformance) => ({
      subject: s.subject,
      latestLevel: s.latestLevel,
      trend: s.trend,
      evidenceCount: s.history.length,
    }))
    // Lowest level first so the teacher's eye lands on the subject that needs
    // them; ties broken on subject name so the order is stable across renders.
    .sort((a, b) => a.latestLevel - b.latestLevel || a.subject.localeCompare(b.subject))
}

/**
 * The single reason this learner is where they are in the list.
 *
 * "No evidence" outranks every academic signal on purpose: a learner nobody has
 * assessed is invisible to every other rule, and invisibility is the failure
 * mode a class view exists to catch. A learner with no legacy bridge is a
 * distinct case — the platform genuinely cannot compute anything for them yet,
 * which is a data-plumbing problem for the teacher to escalate, not a learning
 * concern about the child.
 */
export function attentionReasonFor(input: {
  bridged: boolean
  subjects: ClassBlueprintSubject[]
  riskLevel: RiskValue['overallRiskLevel'] | null
  evidenceCount: number
}): ClassAttentionReason {
  if (!input.bridged) return 'not_bridged'
  if (input.evidenceCount === 0 || input.subjects.length === 0) return 'no_evidence'
  if (input.riskLevel === 'at_risk' || input.riskLevel === 'critical') return 'at_risk'

  const below = input.subjects.filter(s => s.latestLevel <= ATTENTION_LEVEL_CEILING)
  if (below.length > 1) return 'multiple_subjects_below'
  if (below.length === 1) return 'one_subject_below'
  if (input.subjects.some(s => s.trend === 'declining')) return 'declining'
  return 'none'
}

/** Urgency order for the list. Lower sorts first. */
const REASON_RANK: Record<ClassAttentionReason, number> = {
  no_evidence: 0,
  at_risk: 1,
  multiple_subjects_below: 2,
  one_subject_below: 3,
  declining: 4,
  not_bridged: 5,
  none: 6,
}

export function buildClassBlueprintRow(
  learner: RosterLearner,
  projection: LearnerProjectionInput | null,
): ClassBlueprintRow {
  const bridged = projection !== null
  const subjects = subjectsFrom(projection?.academic ?? null)
  const riskLevel = projection?.risk?.overallRiskLevel ?? null
  const evidenceCount = projection?.evidenceCount ?? 0

  return {
    coreLearnerId: learner.id,
    learnerName: learnerDisplayName(learner),
    admissionNumber: learner.admission_number ?? null,
    gradeBand: getGradeBand(learner.current_class_name ?? null),
    bridged,
    subjects,
    subjectsNeedingAttention: subjects.filter(s => s.latestLevel <= ATTENTION_LEVEL_CEILING).map(s => s.subject),
    lowestLevel: subjects.length > 0 ? subjects[0].latestLevel : null,
    riskLevel,
    evidenceCount,
    attentionReason: attentionReasonFor({ bridged, subjects, riskLevel, evidenceCount }),
    projectionAsOf: projection?.lastComputed ?? null,
  }
}

export function computeClassBlueprint(input: {
  classId: string
  className: string | null
  termId: string
  roster: RosterLearner[]
  projections: LearnerProjectionInput[]
  /** Core learner ids that have a legacy bridge. A learner absent here can have no Projection at all. */
  bridgedLearnerIds: ReadonlySet<string>
}): ClassBlueprint {
  const byLearner = new Map(input.projections.map(p => [p.coreLearnerId, p]))

  const rows = input.roster
    .map(learner => {
      const bridged = input.bridgedLearnerIds.has(learner.id)
      // An unbridged learner gets a null projection so `bridged: false` is
      // reported honestly, rather than being folded into "no evidence" — the
      // two need different responses from the teacher.
      return buildClassBlueprintRow(learner, bridged ? (byLearner.get(learner.id) ?? {
        coreLearnerId: learner.id, academic: null, risk: null, evidenceCount: 0, lastComputed: null,
      }) : null)
    })
    .sort((a, b) =>
      REASON_RANK[a.attentionReason] - REASON_RANK[b.attentionReason] ||
      // Within a reason, the lower CBC level first; learners with no level sort
      // after those with one, since there is nothing to compare.
      (a.lowestLevel ?? 5) - (b.lowestLevel ?? 5) ||
      a.learnerName.localeCompare(b.learnerName),
    )

  const byLowestLevel: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const row of rows) {
    if (row.lowestLevel !== null) byLowestLevel[row.lowestLevel] += 1
  }

  const asOfValues = rows.map(r => r.projectionAsOf).filter((v): v is string => v !== null).sort()

  return {
    classId: input.classId,
    className: input.className,
    termId: input.termId,
    rows,
    distribution: {
      byLowestLevel,
      learnersWithEvidence: rows.filter(r => r.evidenceCount > 0).length,
      learnersWithoutEvidence: rows.filter(r => r.bridged && r.evidenceCount === 0).length,
      learnersNotBridged: rows.filter(r => !r.bridged).length,
      learnersNeedingAttention: rows.filter(r => r.attentionReason !== 'none').length,
    },
    oldestProjectionAsOf: asOfValues[0] ?? null,
  }
}
