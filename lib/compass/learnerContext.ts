// lib/compass/learnerContext.ts
//
// Phase 1 / P0-A — the Compass learner-context READ ADAPTER.
//
// This is the one place Compass learns "where is this learner right now,
// academically." It exists because Compass was the last learner-facing
// consumer still deriving that answer exclusively from
// `student_learning_context.subject_tiers` — a table written only by the
// Academic Clinic assessment pipeline and never refreshed when evidence
// changes (lib/projection/eventConsumer.ts refreshes learner_projections,
// students.capability_profile, learner_profiles.career_signals and the
// Monday Panel cache, and deliberately not this one). A learner could
// therefore accumulate months of confirmed evidence while Compass kept
// teaching to a snapshot from their last Clinic assessment.
//
// WHAT THIS IS NOT:
//   - not a learner model — it owns no state and defines no new concept;
//   - not a cache — nothing is memoized or persisted;
//   - not a writer — it never writes learner_projections, learner_evidence,
//     student_learning_context, or anything else;
//   - not a synchronizer — no Projection value is ever copied into
//     student_learning_context. Compass reads canonical state directly, so
//     there remains ONE educational truth rather than two synchronized
//     copies.
//
// It reads Projection through `getPersistedProjections()`
// (lib/projection/recompute.ts) and deliberately NOT through
// `recomputeLearnerProjection()`, which upserts up to seven rows per call.
// A learner sending a chat message must never trigger a projection write,
// and the persisted rows are already kept current by the
// evidence_projection_events outbox consumer that the projection-events
// cron drains.
//
// OWNERSHIP (see docs/architecture/adr-0029 and the migration ledger):
//   Projection owns          academic level, trend, evidence support,
//                            subject ranking.
//   student_learning_context still owns (Phase 1) knowledge_root_causes,
//                            guided_topics, subject_action_steps,
//                            session_goal, compass_bridge, pathway
//                            fallback, sessions_without_improvement,
//                            subject_rest_until.
//   Compass owns             session lifecycle, transcripts, exchange
//                            counts, resume, rest windows, subject
//                            locking, tutoring/probing, mastery logic, XP.
//
// Teacher intent (`compass_bridge`) is authoritative and is NEVER
// overridden by Projection — a canonical level says where the learner is,
// not what the teacher asked them to work on.

import { getPersistedProjections } from '@/lib/projection/recompute'
import { normalizeSubjectKey } from '@/lib/pathwayCalculator'
import type { AcademicValue, Trend } from '@/lib/projection/types'

// ── Canonical tier -> level mapping ────────────────────────────────────────
//
// Lives here rather than in session.ts (its previous home, from which it is
// still re-exported for the existing importers) purely so that session.ts
// can import this module's ranking function without a circular import.
// Same function, same semantics, same legacy string fallbacks — moved, not
// changed.
//
// Current DB values: 'challenge' | 'standard' | 'reinforcement' | 'remedial'
// Legacy fallback handles old 'approaching_expectations' style strings.
export function tierToLevel(tier: string): 1 | 2 | 3 | 4 {
  if (tier === 'challenge'     || tier.includes('exceeding'))   return 4
  if (tier === 'standard'      || tier.includes('meeting'))     return 3
  if (tier === 'reinforcement' || tier.includes('approaching')) return 2
  return 1 // remedial or unknown
}

/**
 * Where the academic level Compass is about to use actually came from.
 * Returned rather than hidden so tests, the shadow-comparison harness, and
 * anyone debugging a surprising tutoring level can tell canonical state
 * from a legacy fallback without guessing.
 */
export type AcademicLevelSource =
  | 'projection'      // canonical, evidence-derived
  | 'client_hint'     // client-supplied level, kept for current compatibility
  | 'legacy_tier'     // student_learning_context.subject_tiers
  | 'legacy_overall'  // student_learning_context.overall_level
  | 'session'         // a resumed session's saved level
  | 'default'         // conservative floor

export type CompassAcademicState = {
  level: 1 | 2 | 3 | 4
  source: AcademicLevelSource
  /** Only ever populated from Projection — never inferred from a tier. */
  trend: Trend | null
  /** Projection's own confidence in the academic dimension (0-100), or null. */
  confidence: number | null
  /** Days since the newest evidence behind this projection, or null. */
  freshnessDays: number | null
}

export type CompassSubjectRank = {
  /** Normalized subject key (see normalizeSubjectKey) — the matching key space. */
  subject: string
  /**
   * The key as the SOURCE spells it — the legacy tier key when the learner
   * has one, otherwise the projection's own subject key.
   *
   * Callers must use this, not `subject`, for anything that addresses a
   * subject downstream (KICD topic lookup, session rows, the picker's
   * subject cards). Normalization exists here to decide *which entries are
   * the same subject*; it is not a rename. Collapsing `core_mathematics`
   * to `mathematics` on the way out would silently change which KICD
   * topic set a senior learner's Compass session is grounded in — a
   * behaviour change P0-A has no business making, since P0-A is about
   * where the learner IS, not what the subject is called.
   */
  sourceKey: string
  level: 1 | 2 | 3 | 4
  source: Extract<AcademicLevelSource, 'projection' | 'legacy_tier'>
}

export type LegacyAcademicFallback = {
  subjectTiers: Record<string, string>
  overallLevel: number | null
  sessionLevel: number | null
  clientHint: number | null
}

// ── Pure resolution ────────────────────────────────────────────────────────

function isLevel(value: number | null | undefined): value is 1 | 2 | 3 | 4 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4
}

/** The tier map's raw key whose normalized form matches `subject`, if any. */
function findTierKey(subjectTiers: Record<string, string>, normalizedSubject: string): string | null {
  return Object.keys(subjectTiers).find(k => normalizeSubjectKey(k) === normalizedSubject) ?? null
}

/** The projection's raw subject key whose normalized form matches `subject`, if any. */
function findProjectionKey(academic: AcademicValue | null, normalizedSubject: string): string | null {
  if (!academic) return null
  return Object.keys(academic.bySubject).find(k => normalizeSubjectKey(k) === normalizedSubject) ?? null
}

/**
 * Resolves the academic level Compass should teach to, canonical-first.
 *
 * Precedence, highest first:
 *   1. canonical Projection for this subject
 *   2. client hint (compatibility — see the note below)
 *   3. student_learning_context.subject_tiers
 *   4. student_learning_context.overall_level
 *   5. a resumed session's saved level
 *   6. conservative default of 2
 *
 * A legacy value can only ever be reached by the ABSENCE of a canonical
 * one — never by comparing the two and preferring the legacy answer. This
 * is the invariant the whole convergence rests on, and it is asserted
 * directly in learnerContext.test.ts.
 *
 * On the client hint: `app/api/learn/route.ts` accepts a client-supplied
 * `subjectLevel`, which today originates from `/api/learn/student` — i.e.
 * from the same server-side resolution as everything below it, so the two
 * agree by construction. It sits BELOW canonical Projection deliberately:
 * a client may not assert a tutoring level that contradicts the learner's
 * own evidence. Whether a client should be able to influence this at all
 * is a separate trust question, deliberately not settled in Phase 1.
 *
 * Pure: no I/O, fully deterministic, trivially testable.
 */
export function resolveCompassAcademicLevel(input: {
  academic: AcademicValue | null
  academicConfidence?: number | null
  academicFreshnessDays?: number | null
  subject: string
  legacy: LegacyAcademicFallback
}): CompassAcademicState {
  const normalized = normalizeSubjectKey(input.subject)

  // 1. Canonical.
  const projectionKey = findProjectionKey(input.academic, normalized)
  if (projectionKey) {
    const performance = input.academic!.bySubject[projectionKey]
    if (isLevel(performance?.latestLevel)) {
      return {
        level: performance.latestLevel,
        source: 'projection',
        trend: performance.trend,
        confidence: input.academicConfidence ?? null,
        freshnessDays: input.academicFreshnessDays ?? null,
      }
    }
  }

  const noCanonical = { trend: null, confidence: null, freshnessDays: null } as const

  // 2. Client hint.
  if (isLevel(input.legacy.clientHint)) {
    return { level: input.legacy.clientHint, source: 'client_hint', ...noCanonical }
  }

  // 3. Legacy per-subject tier.
  const tierKey = findTierKey(input.legacy.subjectTiers, normalized)
  if (tierKey) {
    return { level: tierToLevel(input.legacy.subjectTiers[tierKey]), source: 'legacy_tier', ...noCanonical }
  }

  // 4. Legacy overall level.
  if (isLevel(input.legacy.overallLevel)) {
    return { level: input.legacy.overallLevel, source: 'legacy_overall', ...noCanonical }
  }

  // 5. Resumed session.
  if (isLevel(input.legacy.sessionLevel)) {
    return { level: input.legacy.sessionLevel, source: 'session', ...noCanonical }
  }

  // 6. Conservative floor — the same default this path has always used.
  return { level: 2, source: 'default', ...noCanonical }
}

/**
 * Ranks a learner's subjects weakest-first, canonical level per subject
 * where one exists and the legacy tier otherwise.
 *
 * The candidate set is the UNION of both key spaces, normalized. A subject
 * the learner has real confirmed evidence for but no Clinic tier is a
 * subject Compass should be able to offer — excluding it would mean
 * canonical evidence is visible to every other consumer and invisible to
 * the learner's own next-subject choice. Callers apply their own filters
 * (junior subject list, senior pathway/selection) on top of this, exactly
 * as they did before.
 *
 * Pure: no I/O.
 */
export function resolveCompassSubjectRanking(input: {
  academic: AcademicValue | null
  subjectTiers: Record<string, string>
}): CompassSubjectRank[] {
  const normalizedKeys = new Set<string>()
  for (const key of Object.keys(input.subjectTiers)) normalizedKeys.add(normalizeSubjectKey(key))
  if (input.academic) {
    for (const key of Object.keys(input.academic.bySubject)) normalizedKeys.add(normalizeSubjectKey(key))
  }

  const ranked: CompassSubjectRank[] = []
  for (const subject of normalizedKeys) {
    const state = resolveCompassAcademicLevel({
      academic: input.academic,
      subject,
      // A ranking must never be steered by a client hint or by a single
      // subject's overall/session fallback — only by a real per-subject
      // signal from one of the two real sources.
      legacy: { subjectTiers: input.subjectTiers, overallLevel: null, sessionLevel: null, clientHint: null },
    })
    if (state.source !== 'projection' && state.source !== 'legacy_tier') continue

    // Prefer the learner's existing tier key so downstream subject
    // addressing is unchanged for every learner who already has one; fall
    // back to the projection's key only for canonical-only subjects, which
    // by definition have no tier key to preserve.
    const sourceKey =
      findTierKey(input.subjectTiers, subject) ??
      findProjectionKey(input.academic, subject) ??
      subject

    ranked.push({ subject, sourceKey, level: state.level, source: state.source })
  }

  return ranked.sort((a, b) => a.level - b.level || a.subject.localeCompare(b.subject))
}

// ── Persistence-facing read ────────────────────────────────────────────────

export type CompassAcademicProjection = {
  academic: AcademicValue | null
  confidence: number | null
  freshnessDays: number | null
}

const EMPTY_PROJECTION: CompassAcademicProjection = { academic: null, confidence: null, freshnessDays: null }

/**
 * Reads the learner's persisted academic projection — READ ONLY.
 *
 * Never calls `recomputeLearnerProjection()`: that has a write side effect
 * (upserts/deletes learner_projections rows) which must never be triggered
 * by a learner sending a chat message. `learner_projections` is kept
 * current by the evidence_projection_events outbox consumer.
 *
 * Returns an all-null result rather than throwing when the learner has no
 * persisted projection yet — "no canonical state" is a normal, expected
 * state for a learner whose evidence has not been confirmed, and every
 * caller has a legacy fallback for exactly that case.
 */
export async function readCompassAcademicProjection(learnerId: string): Promise<CompassAcademicProjection> {
  let rows
  try {
    rows = await getPersistedProjections(learnerId)
  } catch (err) {
    // A projection read failing must degrade Compass to its legacy
    // fallback, never break a learner's session.
    console.error('[compass/learnerContext] projection read failed, falling back to legacy context:', err instanceof Error ? err.message : String(err))
    return EMPTY_PROJECTION
  }

  const academicRow = rows.find(r => r.projector_type === 'academic')
  if (!academicRow) return EMPTY_PROJECTION

  const value = academicRow.value as AcademicValue | null
  if (!value || typeof value !== 'object' || !value.bySubject) return EMPTY_PROJECTION

  return {
    academic: value,
    confidence: academicRow.confidence ?? null,
    freshnessDays: academicRow.freshness_days ?? null,
  }
}

/**
 * Reads canonical projection for one learner and resolves the academic
 * level for one subject — the whole precedence chain of
 * {@link resolveCompassAcademicLevel}, with the read attached.
 *
 * For the tutoring route, which needs the active subject's level and not a
 * ranking. Callers that need both should use
 * {@link resolveCompassLearnerContext} instead of calling this and the
 * ranking separately — that would read the projection twice.
 */
export async function resolveCompassAcademicLevelFor(
  learnerId: string,
  subject: string,
  legacy: LegacyAcademicFallback,
): Promise<CompassAcademicState> {
  const projection = await readCompassAcademicProjection(learnerId)
  return resolveCompassAcademicLevel({
    academic: projection.academic,
    academicConfidence: projection.confidence,
    academicFreshnessDays: projection.freshnessDays,
    subject,
    legacy,
  })
}

/**
 * The one call a Compass consumer makes: reads canonical projection once,
 * then resolves both the active subject's academic state and the full
 * subject ranking from it plus the caller's already-loaded legacy context.
 *
 * The legacy context is passed in rather than re-fetched because every
 * caller already reads `student_learning_context` for fields this adapter
 * does not own (compass_bridge, root causes, guided topics, rest windows)
 * — re-reading it here would be a second query for data the caller has.
 */
export async function resolveCompassLearnerContext(input: {
  learnerId: string
  subject: string
  legacy: LegacyAcademicFallback
}): Promise<{ academic: CompassAcademicState; ranking: CompassSubjectRank[] }> {
  const projection = await readCompassAcademicProjection(input.learnerId)

  return {
    academic: resolveCompassAcademicLevel({
      academic: projection.academic,
      academicConfidence: projection.confidence,
      academicFreshnessDays: projection.freshnessDays,
      subject: input.subject,
      legacy: input.legacy,
    }),
    ranking: resolveCompassSubjectRanking({
      academic: projection.academic,
      subjectTiers: input.legacy.subjectTiers,
    }),
  }
}
