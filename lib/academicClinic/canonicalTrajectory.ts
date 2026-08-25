// lib/academicClinic/canonicalTrajectory.ts
//
// Phase 2.2 (Learner Report Architecture — canonical trajectory closure).
//
// Trajectory (direction of a learner's performance over time) is canonically
// owned by Projection's growth projector (lib/projection/growthProjector.ts),
// not by Clinic. This is a thin, read-only resolver: it fetches the
// already-computed, already-persisted growth/risk projection dimensions for
// a learner and returns them in the shape reportGenerator.ts's
// generateClinicalOverview() expects — it computes nothing itself.
//
// Calls recomputeLearnerProjection() rather than getPersistedProjections()
// (the read-only path Compass prefers to avoid a write side effect on every
// chat message). Clinic report generation is not a high-frequency,
// latency-sensitive per-message call the way Compass tutoring is — it's a
// once-per-assessment or once-per-download operation — and trajectory must
// be correct for BOTH Junior and Senior learners, while career-match
// resolution (which also recomputes, Phase 2.1) only runs for Seniors. A
// persisted-only read would silently serve a stale/absent growth value for
// every Junior learner and for any Senior report generated before a prior
// recompute happened to run. Recomputing directly here is the simple,
// correct choice, at the cost of one Projection recompute per report
// (a real, accepted cost — see the Phase 2.2 closeout).
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { CanonicalGrowthInput } from './reportGenerator'

export async function resolveCanonicalGrowthInput(studentId: string): Promise<CanonicalGrowthInput> {
  const projection = await recomputeLearnerProjection(studentId)
  return {
    trend:     projection.growth?.value.trend ?? null,
    riskLevel: projection.risk?.value.overallRiskLevel ?? null,
  }
}
