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

export type ProcessProjectionEventsResult = {
  eventsProcessed: number
  learnersRecomputed: number
}

export async function processProjectionEvents(limit = 100): Promise<ProcessProjectionEventsResult> {
  const events = await repos.evidence.findUnprocessedProjectionEvents(limit)
  if (events.length === 0) return { eventsProcessed: 0, learnersRecomputed: 0 }

  const affectedLearnerIds = [...new Set(events.map(e => e.learner_id))]
  await recomputeLearnerProjections(affectedLearnerIds)

  await Promise.all(events.map(e => repos.evidence.markProjectionEventProcessed(e.id)))

  return { eventsProcessed: events.length, learnersRecomputed: affectedLearnerIds.length }
}
