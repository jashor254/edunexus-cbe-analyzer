// lib/adaptiveLearning/recommend.ts
// The Recommendation Layer — Adaptive Learning v2 Architecture §2
// (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN),
// extended by Wave 7 — Curriculum Grounding Layer (Curriculum Integrity
// is Non-Negotiable: every recommendation must be grounded in the real
// curriculum data already in EduNexus, never invented; teachers retain
// full authority to assign/override the specific sub-strand targeted).
//
// The one place "what should this learner work on next" is answered.
// Reads Projection only (`recomputeLearnerProjection`) — never
// `learner_profiles`, never a bespoke read path — for the learner-state
// axis (level, risk, trend). Reads the real `sow_*` curriculum tree (via
// `lib/curriculum/curriculumContext.ts`) — never invented — for the
// curriculum-identity axis (Strand/Sub-Strand/Learning Outcomes). Neither
// axis duplicates the other's source of truth. Every channel (Holiday
// Journey, Printable Pack, Classroom Differentiation, Parent Delivery)
// consumes this module's output; none computes its own version (LI-1).
//
// Does NOT call `lib/remedial/planner.ts`'s `generateRemedialPlan()` —
// that function sources learner data via `getClassLearnerProfiles()`
// (legacy `learner_profiles` reads), which would make this the one
// channel not deriving from Projection. Only the group taxonomy *shape*
// (`RemedialGroupType`) is reused; the classification below is
// independently computed from Projection. See the architecture doc §2
// for the full rationale (a contradiction found and fixed before freeze).

import { confidenceFromScore, insufficientEvidenceInsight, type Insight } from '@/lib/learnerIntelligence/insight'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'
import type { RemedialGroupType } from '@/lib/remedial/types'
import { CurriculumService, type CurriculumContext } from '@/lib/curriculum/service'

export type AdaptiveGroupType = RemedialGroupType
export type TaskStyle = 'foundational' | 'reinforcement' | 'application' | 'enrichment'

export type AdaptiveTask = Insight & {
  learnerId:  string
  subject:    string
  groupType:  AdaptiveGroupType | 'insufficient_data'
  level:      1 | 2 | 3 | 4 | null
  taskStyle:  TaskStyle
  /**
   * Real Strand/Sub-Strand/Learning Outcome data, resolved from the
   * curriculum database — null when no specific sub-strand has been
   * identified (see `curriculumNotice`), never a fabricated stand-in.
   */
  curriculum:        CurriculumContext | null
  /** Set whenever curriculum grounding is incomplete — states the gap explicitly rather than hiding it. */
  curriculumNotice:  string | null
}

export type LearnerContext = {
  learnerId:   string
  learnerName: string
  projection:  LearnerIntelligenceProjection
}

export type ClassGroups = Record<AdaptiveGroupType | 'insufficient_data', AdaptiveTask[]>

const TASK_STYLE_BY_GROUP: Record<AdaptiveGroupType, TaskStyle> = {
  critical_gap:      'foundational',
  prerequisite_gap:  'foundational',
  concept_confusion: 'reinforcement',
  on_track:          'enrichment', // Group C — brief's enrichment tier
}

// Neutral, learner/class-facing labels — per architecture §3's explicit
// rule: internal group taxonomy names must never reach a learner.
const NEUTRAL_LABEL: Record<AdaptiveGroupType, string> = {
  critical_gap:      'Focused Foundation Work',
  prerequisite_gap:  'This Week\'s Focus',
  concept_confusion: 'Practice & Clarify',
  on_track:          'Challenge Set',
}

// Fallback only — used when no curriculum sub-strand has been resolved
// (see buildGroundedAction). Never presented as curriculum-grounded;
// curriculumNotice always accompanies it when it's the one in use.
const GROUP_ACTION_FALLBACK: Record<AdaptiveGroupType, (subject: string) => string> = {
  critical_gap: subject =>
    `Start with a one-on-one diagnostic on the foundational concepts behind ${subject} before returning to the current topic.`,
  prerequisite_gap: subject =>
    `Re-teach the prerequisite concept behind ${subject} first, then return to the current substrand.`,
  concept_confusion: subject =>
    `Work through ${subject} with a focused, worked-example lesson and peer discussion.`,
  on_track: subject =>
    `Extend ${subject} with an open-ended, higher-order challenge — no fixed scaffold, connect it to a real-world or career context.`,
}

const GROUP_ACTION_GROUNDED: Record<AdaptiveGroupType, (outcome: string, curriculum: CurriculumContext) => string> = {
  critical_gap: (outcome, c) =>
    `Start with a one-on-one diagnostic on the prerequisite skills behind "${c.subStrandTitle}" (${c.strandTitle}) before returning to this learning outcome: ${outcome}`,
  prerequisite_gap: (outcome, c) =>
    `Re-teach the prerequisite behind "${c.subStrandTitle}" (${c.strandTitle}) first, then return to this learning outcome: ${outcome}`,
  concept_confusion: (outcome, c) =>
    `Work through "${c.subStrandTitle}" (${c.strandTitle}) with a focused lesson targeting: ${outcome}`,
  on_track: (outcome, c) =>
    `Extend "${c.subStrandTitle}" (${c.strandTitle}) with an open-ended challenge building on: ${outcome}`,
}

function buildGroundedAction(
  groupType:  AdaptiveGroupType,
  subject:    string,
  curriculum: CurriculumContext | null,
): { action: string; curriculumNotice: string | null } {
  if (!curriculum) {
    return {
      action: GROUP_ACTION_FALLBACK[groupType](subject),
      curriculumNotice:
        'No specific curriculum sub-strand has been assigned for this recommendation. ' +
        'This is a subject-level suggestion only — a teacher should assign a specific ' +
        'Strand/Sub-Strand (via the Topic Picker) for full curriculum alignment.',
    }
  }

  const outcome = curriculum.learningOutcomes[0]
  if (!outcome) {
    return {
      action: GROUP_ACTION_FALLBACK[groupType](subject),
      curriculumNotice:
        `No Specific Learning Outcomes are seeded in the curriculum database for ` +
        `${curriculum.strandTitle} — ${curriculum.subStrandTitle}. Content below is grounded ` +
        `in the Strand/Sub-Strand identity only, not a specific learning outcome.`,
    }
  }

  return { action: GROUP_ACTION_GROUNDED[groupType](outcome, curriculum), curriculumNotice: null }
}

/**
 * Classifies a learner's group for one subject, from Projection alone.
 *
 * Ported shape from lib/remedial/planner.ts's four-way split, adapted
 * honestly to what Projection actually computes: the legacy planner used
 * a raw `risk_flags.length >= 2` count (multiple flags across subjects)
 * to detect "critical"; a subject-level RiskProjection carries at most
 * one flag per subject, so "critical" here means that one flag's own
 * `severity === 'critical'` (level 1 AND declining) — a more principled
 * signal than a count, not a weaker one.
 */
export function classifyGroup(
  projection: LearnerIntelligenceProjection,
  subject: string,
): AdaptiveGroupType | 'insufficient_data' {
  const level = projection.academic?.value.bySubject[subject]?.latestLevel ?? null
  if (level === null) return 'insufficient_data'

  const subjectFlag = projection.risk?.value.flags.find(f => f.subject === subject) ?? null

  if (level === 1 && subjectFlag?.severity === 'critical') return 'critical_gap'
  if (level <= 2) return 'prerequisite_gap'
  if (level === 3) return 'concept_confusion'
  return 'on_track'
}

/**
 * Builds one AdaptiveTask — an Insight (observation/evidence/confidence/
 * action) — for a single learner and subject. Pure function of Projection
 * plus an already-resolved CurriculumContext; no DB access here (see
 * recommendForClass below for the async wrapper that resolves both per class).
 */
export function buildAdaptiveTask(
  learnerId:   string,
  learnerName: string,
  subject:     string,
  projection:  LearnerIntelligenceProjection,
  context?:    { careerNote?: string | null; curriculumContext?: CurriculumContext | null },
): AdaptiveTask {
  const groupType = classifyGroup(projection, subject)
  const curriculum = context?.curriculumContext ?? null

  if (groupType === 'insufficient_data') {
    const base = insufficientEvidenceInsight(`${learnerName}'s ${subject} progress`)
    return { ...base, learnerId, subject, groupType, level: null, taskStyle: 'reinforcement', curriculum: null, curriculumNotice: null }
  }

  const academic = projection.academic!.value.bySubject[subject]
  const level = academic.latestLevel
  const confidence = confidenceFromScore(projection.academic!.confidence / 100)

  const { action: groundedAction, curriculumNotice } = buildGroundedAction(groupType, subject, curriculum)
  const action = context?.careerNote ? `${groundedAction} ${context.careerNote}` : groundedAction

  const observation = curriculum
    ? `${learnerName} is currently at Level ${level} in ${subject} (${academic.trend}), working within ${curriculum.strandTitle} — ${curriculum.subStrandTitle}.`
    : `${learnerName} is currently at Level ${level} in ${subject} (${academic.trend}).`

  return {
    observation,
    evidence:    projection.academic!.supportingEvidenceIds,
    confidence,
    action,
    learnerId,
    subject,
    groupType,
    level,
    taskStyle: TASK_STYLE_BY_GROUP[groupType],
    curriculum,
    curriculumNotice,
  }
}

/** The neutral, learner/class-facing label for a group — never the internal taxonomy name. */
export function neutralGroupLabel(groupType: AdaptiveGroupType | 'insufficient_data'): string {
  if (groupType === 'insufficient_data') return 'Not Enough Evidence Yet'
  return NEUTRAL_LABEL[groupType]
}

/** Pure grouping over already-computed projections — the shape Wave 1's tests exercise directly. */
export function buildClassRecommendations(
  learners:   LearnerContext[],
  subject:    string,
  curriculum: CurriculumContext | null = null,
): ClassGroups {
  const groups: ClassGroups = {
    critical_gap: [], prerequisite_gap: [], concept_confusion: [], on_track: [], insufficient_data: [],
  }
  for (const l of learners) {
    const task = buildAdaptiveTask(l.learnerId, l.learnerName, subject, l.projection, { curriculumContext: curriculum })
    groups[task.groupType].push(task)
  }
  return groups
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

/**
 * Reads Projection for a whole class and groups them — the real entry
 * point Classroom Differentiation (Wave 4) wires up. `subStrandId` is the
 * teacher-assigned sub-strand for this differentiation run (e.g. from the
 * assessment's own SOW scope) — one resolution shared by the whole class,
 * not re-resolved per learner.
 */
export async function recommendForClass(
  learners:    Array<{ learnerId: string; learnerName: string }>,
  subject:     string,
  options?:    { subStrandId?: string | null; concurrency?: number },
): Promise<ClassGroups> {
  const concurrency = options?.concurrency ?? 20
  const [withProjections, curriculumContext] = await Promise.all([
    mapWithConcurrency(learners, concurrency, async l => ({
      ...l,
      projection: await recomputeLearnerProjection(l.learnerId),
    })),
    options?.subStrandId ? CurriculumService.resolveSubstrandContext(options.subStrandId) : Promise.resolve(null),
  ])
  return buildClassRecommendations(withProjections, subject, curriculumContext)
}
