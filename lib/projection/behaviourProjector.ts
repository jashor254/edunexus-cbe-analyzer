// lib/projection/behaviourProjector.ts
// Learning behaviour signal, derived only from evidence sources that
// actually represent behavioural observation (compass_session,
// classroom_observation, parent_observation) — not academic score sources.
//
// Honest scoping: no ingestion source producing these evidence types is
// wired up yet (only csv_export/csv-sourced academic evidence exists as of
// this phase). This projector will correctly return null for every learner
// today — that's the right behavior per "no projection may exist without
// supporting evidence," not a bug. It activates automatically once such a
// source starts producing evidence, with no change needed here.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, BehaviourValue } from './types'
import { computeCoverage, computeProjectionConfidence } from './coverage'

export const BEHAVIOUR_PROJECTION_VERSION = 'behaviour-v1'

const BEHAVIOURAL_SOURCES = new Set(['compass_session', 'classroom_observation', 'parent_observation'])

export function projectBehaviour(evidence: EvidenceRow[], now: Date = new Date()): Projection<BehaviourValue> | null {
  const behavioural = evidence.filter(e => BEHAVIOURAL_SOURCES.has(e.evidence_source))
  if (behavioural.length === 0) return null

  const distinctSources = [...new Set(behavioural.map(e => e.evidence_source))]
  return {
    value: { observationCount: behavioural.length, distinctSources },
    supportingEvidenceIds: behavioural.map(e => e.id),
    confidence: computeProjectionConfidence(behavioural),
    coverage: computeCoverage(behavioural, now),
    lastComputed: now.toISOString(),
    projectionVersion: BEHAVIOUR_PROJECTION_VERSION,
  }
}
