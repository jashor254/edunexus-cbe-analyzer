// lib/projection/eventConsumer.ts
// The consumer for evidence_projection_events — the outbox Phase 2 built
// specifically as "hooks for downstream projection recomputation... no
// consumer implemented yet." This is that consumer.
//
// Incremental by construction: only learners with an unprocessed event get
// recomputed, not the whole platform — "avoid recomputing everything
// unnecessarily." Full per-projector incremental recompute (skip
// unaffected projectors) is a documented future optimization, not built
// here — a learner-level recompute is the safe default: an evidence change
// in one subject can affect Growth/Risk/Completeness too, which are
// cross-cutting, so partial recompute risks silently stale cross-cutting
// projections.

import { repos } from '@/lib/repositories'
import { recomputeLearnerProjections } from './recompute'
import { recomputeAndSaveCapabilityProfile } from '@/lib/career/careerEngine'
import { refreshCareerSignals } from '@/lib/learnerModel/updater'

export type ProcessProjectionEventsResult = {
  eventsProcessed: number
  learnersRecomputed: number
}

export async function processProjectionEvents(limit = 100): Promise<ProcessProjectionEventsResult> {
  const events = await repos.evidence.findUnprocessedProjectionEvents(limit)
  if (events.length === 0) return { eventsProcessed: 0, learnersRecomputed: 0 }

  const affectedLearnerIds = [...new Set(events.map(e => e.learner_id))]
  await recomputeLearnerProjections(affectedLearnerIds)

  // Evidence corrections must also invalidate the two persisted stores that
  // sit outside learner_projections but are still derived from a learner's
  // evidence: students.capability_profile and learner_profiles.career_signals.
  // Both are idempotent recomputes from current DB state, so it's safe to run
  // them for every affected learner regardless of which projector the
  // triggering event was about.
  await Promise.all(affectedLearnerIds.map(async learnerId => {
    await Promise.allSettled([
      recomputeAndSaveCapabilityProfile(learnerId),
      refreshCareerSignals(learnerId),
    ])
  }))

  // The Monday Panel's 24h cache has no other correction-triggered
  // invalidation — without this, a class whose panel was just cached could
  // keep showing pre-correction risk data for up to a day.
  const classIds = new Set<string>()
  await Promise.all(affectedLearnerIds.map(async learnerId => {
    const ids = await repos.learnerModel.findClassIdsForStudent(learnerId)
    ids.forEach(id => classIds.add(id))
  }))
  await repos.learnerModel.invalidateMondayPanelCache([...classIds])

  await Promise.all(events.map(e => repos.evidence.markProjectionEventProcessed(e.id)))

  return { eventsProcessed: events.length, learnersRecomputed: affectedLearnerIds.length }
}
