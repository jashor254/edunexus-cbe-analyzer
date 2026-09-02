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

import { insufficientEvidenceInsight, type Insight, type ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { computeLearnerProjection } from '@/lib/projection/engine'
import type { LearnerIntelligenceProjection, Trend } from '@/lib/projection/types'
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
  /**
   * Which grain of Projection evidence backed this task's `level` — ADR-0024
   * Phase 2/3. 'subStrand' only when Projection has real, resolved evidence
   * for the assigned sub-strand (`academic.bySubStrand`); 'subject' is the
   * conservative fallback (`academic.bySubject`), used whenever sub-strand
   * evidence doesn't exist yet — never fabricated past what Projection
   * actually resolved. `null` only for 'insufficient_data'.
   */
  academicGrain:     'subStrand' | 'subject' | null
  /**
   * How well-founded this task's band is — evidence state at the resolved
   * grain, whether it is provisional, and the plain-language why. Always
   * present, including for `insufficient_data`. `decision.groupType` is by
   * construction the same value as `groupType` above (both come from the
   * one `decideAdaptive()` call); it is repeated here rather than removed
   * so the decision object stays independently meaningful when passed on.
   */
  decision:          AdaptiveDecision
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

type AcademicSignal = {
  level: 1 | 2 | 3 | 4
  trend: Trend
  grain: 'subStrand' | 'subject'
  /**
   * The chronological level history at the grain that actually won — the
   * sub-strand's own history when `grain === 'subStrand'`, the subject's
   * otherwise. Read at the resolved grain deliberately: a sub-strand
   * decision must be corroborated by sub-strand observations, never by
   * subject-wide ones that may be about an entirely different topic.
   */
  history: ReadonlyArray<{ level: 1 | 2 | 3 | 4; evidenceId: string }>
}

/**
 * How much observation this decision rests on, AT THE GRAIN THE DECISION
 * WAS MADE. This is the sprint's central educational commitment made
 * explicit: it changes how CONFIDENTLY the system adapts, never WHETHER it
 * adapts. There is no state here that means "refuse to help" — the only
 * non-adapting outcome remains `insufficient_data`, which means Projection
 * resolved no academic signal at all for this subject/grain.
 *
 * - `initial`     one valid observation. Enough to begin. Marked provisional.
 * - `developing`  two observations — the first real corroboration.
 * - `established` three or more — a pattern that a single later observation
 *                 must not be able to overturn on its own (see damping in
 *                 `decideAdaptive`).
 */
export type AdaptiveEvidenceState = 'no_evidence' | 'initial' | 'developing' | 'established'

/**
 * Instructional severity rank of a CBC level, and the only place levels are
 * collapsed for corroboration purposes. Deliberately mirrors the existing
 * band→tier grouping (levels 1 and 2 both mean foundation work), so damping
 * never fires on a change that would not have changed the delivered tier
 * anyway — a 1→2 wobble is not a reversal worth damping.
 */
function severityRank(level: 1 | 2 | 3 | 4): 0 | 1 | 2 {
  if (level <= 2) return 0
  if (level === 3) return 1
  return 2
}

function evidenceStateFor(observationCount: number): AdaptiveEvidenceState {
  if (observationCount === 0) return 'initial'  // a resolved signal with no history rows still rests on one real observation
  if (observationCount === 1) return 'initial'
  if (observationCount === 2) return 'developing'
  return 'established'
}

/**
 * Confidence for the SUBJECT/GRAIN this decision is actually about — never
 * projection.academic!.confidence, which is a whole-learner aggregate over
 * every subject's evidence combined (lib/projection/coverage.ts's
 * countFactor). Deliberately mirrors evidenceStateFor's own thresholds:
 * confidence and evidenceState are two labels for the same underlying fact
 * (how many real observations this exact decision rests on), so they must
 * never be able to disagree the way the aggregate score could.
 */
function confidenceFromEvidenceState(state: AdaptiveEvidenceState): ConfidenceLevel {
  if (state === 'established') return 'High'
  if (state === 'developing') return 'Medium'
  return 'Low' // 'initial' or 'no_evidence' (the latter never reaches here — insufficient_data returns earlier)
}

// Human-readable rendering of Trend for a teacher-facing sentence only.
// decision.trend / signal.trend stay the raw enum everywhere else (API
// responses, the returned AdaptiveTask) — this map exists solely so
// buildAdaptiveTask's observation string never interpolates an internal
// enum member like 'insufficient_data' or 'mixed' as if it were English.
const TREND_LABEL: Record<Trend, string> = {
  improving:          'improving',
  declining:          'declining',
  stable:             'holding steady',
  mixed:              'showing a mixed pattern',
  insufficient_data:  'too early to call a trend',
}

/**
 * The full adaptive decision — band plus everything a caller needs to know
 * about how well-founded it is. `classifyGroup` below is a thin wrapper that
 * keeps its long-standing contract; both share this one computation, so a
 * consumer reading `groupType` here and one calling `classifyGroup` can
 * never disagree.
 */
export type AdaptiveDecision = {
  groupType: AdaptiveGroupType | 'insufficient_data'
  evidenceState: AdaptiveEvidenceState
  /** Which grain of Projection evidence the decision rests on — null only for `insufficient_data`. */
  grain: 'subStrand' | 'subject' | null
  level: 1 | 2 | 3 | 4 | null
  trend: Trend | null
  /** Observations at the resolved grain — the corroboration count, not a learner-wide evidence total. */
  observationCount: number
  /**
   * True when this decision should be treated as revisable on the next
   * observation: either it rests on a single observation, or the latest
   * observation reversed an established pattern and has not yet been
   * corroborated. Never means "do not adapt" — it means "adapt, and expect
   * to revise."
   */
  provisional: boolean
  /** Plain-language why. Always populated — a decision that cannot explain itself must not be delivered. */
  rationale: string
}

/**
 * Applies the corroboration rule to an established pattern.
 *
 * A single observation must not be able to move a learner into foundation
 * work (or out of the support they are currently getting and into
 * enrichment) on its own. When a learner has an established pattern (three
 * or more observations at this grain), the two most recent prior
 * observations agreed with each other, and the newest one reverses them,
 * the decision is damped one step toward the middle rather than following
 * the newest observation all the way.
 *
 * Deliberately NOT a statistical model, a moving average, or a weighting
 * scheme: it is a two-point corroboration rule over data Projection already
 * computed. The very next observation in the same direction satisfies it
 * and the adaptive state moves fully — so a real, sustained change is never
 * blocked, only an isolated one is held for confirmation.
 *
 * Damping always lands on the MIDDLE rank (level 3 / `concept_confusion`),
 * which is by construction never more extreme than the undamped result in
 * either direction.
 */
function isUncorroboratedReversal(history: ReadonlyArray<{ level: 1 | 2 | 3 | 4 }>): boolean {
  if (history.length < 3) return false
  const latest = severityRank(history[history.length - 1].level)
  const prior1 = severityRank(history[history.length - 2].level)
  const prior2 = severityRank(history[history.length - 3].level)
  return prior1 === prior2 && latest !== prior1
}

/**
 * The one place Recommendation reads a learner's academic level from
 * Projection — ADR-0024 Phase 3. Prefers `academic.bySubStrand[subStrandId]`
 * when Projection actually has resolved evidence for that sub-strand;
 * otherwise falls back to `academic.bySubject[subject]`. Never guesses a
 * sub-strand and never treats its absence from `bySubStrand` as a signal in
 * itself — Projection performs no instructional sufficiency judgment (that's
 * ARDS's job, ADR-0023, not yet built), so the fallback here is
 * unconditional, not confidence-gated.
 */
function resolveAcademicSignal(
  projection:  LearnerIntelligenceProjection,
  subject:     string,
  subStrandId?: string | null,
): AcademicSignal | null {
  const academic = projection.academic?.value
  if (!academic) return null

  // Every academic/risk projector writes bySubject/flags keyed by
  // mapSubject(rawSubject).canonicalSubject (lib/assessments/evidence.ts,
  // lib/compass/evidence.ts) — lowercase, not the human-readable subject
  // name (e.g. "Mathematics") every real caller actually has (assignment.subject
  // is free-text from app/api/teacher/assignments; class_subjects/subjects.name
  // is "Mathematics", never "mathematics"). Before this normalization, an
  // exact-match `bySubject[subject]` lookup here silently missed on the
  // capitalization mismatch and returned `insufficient_data` for 100% of a
  // real class regardless of how much confirmed evidence existed — found
  // live against Kangai Junior School's real Grade 7 Yellow: 29/29 learners
  // with real Mathematics evidence all reported "no evidence" until this fix.
  const canonicalSubject = mapSubject(subject).canonicalSubject

  if (subStrandId) {
    const subStrand = academic.bySubStrand[subStrandId]
    if (subStrand && subStrand.subject === canonicalSubject) {
      return { level: subStrand.latestLevel, trend: subStrand.trend, grain: 'subStrand', history: subStrand.history }
    }
  }

  const bySubject = academic.bySubject[canonicalSubject]
  if (!bySubject) return null
  return { level: bySubject.latestLevel, trend: bySubject.trend, grain: 'subject', history: bySubject.history }
}

/** The undamped band for a level + this subject's own risk flag — the rule set as it has always been. */
function rawBand(level: 1 | 2 | 3 | 4, subjectFlagSeverity: string | null): AdaptiveGroupType {
  if (level === 1 && subjectFlagSeverity === 'critical') return 'critical_gap'
  if (level <= 2) return 'prerequisite_gap'
  if (level === 3) return 'concept_confusion'
  return 'on_track'
}

/**
 * The one place "what adaptive support does this learner need, and how
 * sure are we" is answered. Everything below and every consumer of
 * `classifyGroup` shares this computation.
 *
 * NON-NEGOTIABLE: evidence quantity changes CONFIDENCE and CAUTION, never
 * permission. There is exactly one path to `insufficient_data` — Projection
 * resolved no academic signal for this subject/grain at all. A learner with
 * one trustworthy assessment gets a real, adaptive decision.
 */
export function decideAdaptive(
  projection: LearnerIntelligenceProjection,
  subject: string,
  subStrandId?: string | null,
): AdaptiveDecision {
  const signal = resolveAcademicSignal(projection, subject, subStrandId)
  if (!signal) {
    return {
      groupType: 'insufficient_data',
      evidenceState: 'no_evidence',
      grain: null, level: null, trend: null,
      observationCount: 0,
      provisional: false,
      rationale: `No confirmed academic evidence has been resolved for ${subject} yet, at any grain.`,
    }
  }

  const observationCount = signal.history.length
  const evidenceState = evidenceStateFor(observationCount)
  // Same canonical-subject requirement as resolveAcademicSignal above — risk
  // flags are also keyed by mapSubject(...).canonicalSubject, not the
  // human-readable subject name.
  const canonicalSubject = mapSubject(subject).canonicalSubject
  const subjectFlag = projection.risk?.value.flags.find(f => f.subject === canonicalSubject) ?? null
  const undamped = rawBand(signal.level, subjectFlag?.severity ?? null)

  const grainLabel = signal.grain === 'subStrand' ? 'this sub-strand' : subject

  // Established pattern + an isolated reversal → hold the more extreme
  // move for confirmation, but keep adapting at the middle band.
  if (evidenceState === 'established' && isUncorroboratedReversal(signal.history)) {
    return {
      groupType: 'concept_confusion',
      evidenceState,
      grain: signal.grain,
      level: signal.level,
      trend: signal.trend,
      observationCount,
      provisional: true,
      rationale:
        `The most recent observation (Level ${signal.level}) reverses an established pattern across ` +
        `${observationCount} observations in ${grainLabel}. Support is adjusted, but a single observation ` +
        `is not treated as a settled change — the next observation in the same direction will confirm it.`,
    }
  }

  return {
    groupType: undamped,
    evidenceState,
    grain: signal.grain,
    level: signal.level,
    trend: signal.trend,
    observationCount,
    provisional: evidenceState === 'initial',
    rationale: evidenceState === 'initial'
      ? `Based on the first confirmed observation in ${grainLabel} (Level ${signal.level}). ` +
        `That is enough to begin adapting; it is not yet enough to call this a persistent pattern.`
      : `Based on ${observationCount} confirmed observations in ${grainLabel} (currently Level ${signal.level}, ${signal.trend}).`,
  }
}

/**
 * Classifies a learner's group for one subject, from Projection alone —
 * the long-standing contract, now a thin wrapper over `decideAdaptive()`
 * so band selection is computed exactly once. Callers wanting to know how
 * well-founded the band is (evidence state, provisional, rationale) should
 * call `decideAdaptive()` directly rather than re-deriving anything.
 *
 * Curriculum-aware (ADR-0024 Phase 3): when `subStrandId` resolves to real
 * evidence in `academic.bySubStrand`, the sub-strand-specific level drives
 * classification; otherwise the subject-level level does, exactly as before.
 *
 * Ported shape from lib/remedial/planner.ts's four-way split, adapted
 * honestly to what Projection actually computes: the legacy planner used
 * a raw `risk_flags.length >= 2` count (multiple flags across subjects)
 * to detect "critical"; a subject-level RiskProjection carries at most
 * one flag per subject, so "critical" here means that one flag's own
 * `severity === 'critical'` (level 1 AND declining) — a more principled
 * signal than a count, not a weaker one. Risk stays subject-scoped even
 * when the level itself is sub-strand-scoped — Projection has no
 * sub-strand-level risk to consume, so nothing here invents one.
 */
export function classifyGroup(
  projection: LearnerIntelligenceProjection,
  subject: string,
  subStrandId?: string | null,
): AdaptiveGroupType | 'insufficient_data' {
  return decideAdaptive(projection, subject, subStrandId).groupType
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
  const curriculum = context?.curriculumContext ?? null
  const decision = decideAdaptive(projection, subject, curriculum?.subStrandId)
  const groupType = decision.groupType

  if (groupType === 'insufficient_data') {
    const base = insufficientEvidenceInsight(`${learnerName}'s ${subject} progress`)
    return { ...base, learnerId, subject, groupType, level: null, taskStyle: 'reinforcement', curriculum: null, curriculumNotice: null, academicGrain: null, decision }
  }

  const signal = resolveAcademicSignal(projection, subject, curriculum?.subStrandId)!
  const level = signal.level
  // Was confidenceFromScore(projection.academic!.confidence / 100) — that
  // score is computed across EVERY subject's evidence combined (coverage.ts's
  // countFactor over the whole learner), so a learner with one CAT across 8
  // subjects showed "High confidence" on a decision resting on exactly one
  // real observation IN THIS SUBJECT. decision.evidenceState is already the
  // correctly-scoped signal (computed from signal.history — this subject/
  // grain's own observation count) — use that instead.
  const confidence = confidenceFromEvidenceState(decision.evidenceState)

  const { action: groundedAction, curriculumNotice } = buildGroundedAction(groupType, subject, curriculum)
  const action = context?.careerNote ? `${groundedAction} ${context.careerNote}` : groundedAction

  // TREND_LABEL, not the raw Trend value — 'insufficient_data' and 'mixed'
  // are internal enum members, not English. With 1-2 real observations
  // (the common pilot case), 'insufficient_data' was the DEFAULT string
  // rendered into a teacher-facing sentence: "...Mathematics
  // (insufficient_data)." decision.trend (used everywhere else — API
  // responses, the returned AdaptiveTask) stays the raw enum; only this
  // rendered sentence is affected.
  const trendLabel = TREND_LABEL[signal.trend]

  const baseObservation = curriculum
    ? (signal.grain === 'subStrand'
        ? `${learnerName} is currently at Level ${level} in ${curriculum.strandTitle} — ${curriculum.subStrandTitle} (${trendLabel}), based on evidence specific to this sub-strand.`
        : `${learnerName} is currently at Level ${level} in ${subject} (${trendLabel}), working within ${curriculum.strandTitle} — ${curriculum.subStrandTitle}.`)
    : `${learnerName} is currently at Level ${level} in ${subject} (${trendLabel}).`

  // A provisional decision must SAY it is provisional. The mandate is that
  // thin evidence changes how confidently we speak, not whether we help —
  // so the support is still delivered, with the uncertainty stated in the
  // same sentence a teacher reads, never buried in a field nobody renders.
  const observation = decision.provisional
    ? `${baseObservation} ${decision.rationale}`
    : baseObservation

  return {
    observation,
    // Was projection.academic!.supportingEvidenceIds — every subject's
    // evidence ids, not this subject's. A Mathematics task would cite the
    // learner's Kiswahili evidence as its support. signal.history is
    // already scoped to the grain that produced this decision.
    evidence:    signal.history.map(h => h.evidenceId),
    confidence,
    action,
    learnerId,
    subject,
    groupType,
    level,
    taskStyle: TASK_STYLE_BY_GROUP[groupType],
    curriculum,
    curriculumNotice,
    academicGrain: signal.grain,
    decision,
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
    mapWithConcurrency(learners, concurrency, async l => {
      try {
        return { ...l, projection: await recomputeLearnerProjection(l.learnerId) }
      } catch (err) {
        // Per-learner error isolation — one failed recomputeLearnerProjection
        // (a real, observed failure mode: transient Supabase fetch errors
        // during this exact call, hit repeatedly seeding Kangai Junior
        // School's real data) must never abort the WHOLE class's
        // recommendations. Falls back to computeLearnerProjection(id, [])
        // — the same pure engine, given no evidence — which naturally
        // yields the existing, already-correct `insufficient_data` path
        // through buildAdaptiveTask, rather than inventing a second
        // failure representation. Same "isolate, never crash the batch"
        // rule lib/assignments/printRoutes.ts already established for its
        // own per-learner loop (that module works around this exact gap
        // by not calling recommendForClass at all — see its header
        // comment); this closes the gap for every OTHER real consumer
        // (variantGeneration.ts, Classroom Differentiation) that calls
        // recommendForClass directly.
        console.error('[adaptiveLearning/recommend] projection lookup failed for learner', l.learnerId, err instanceof Error ? err.message : String(err))
        return { ...l, projection: computeLearnerProjection(l.learnerId, []) }
      }
    }),
    options?.subStrandId ? CurriculumService.resolveSubstrandContext(options.subStrandId) : Promise.resolve(null),
  ])
  return buildClassRecommendations(withProjections, subject, curriculumContext)
}
