// lib/career/recomputeCapabilityProfile.ts
// Persistence/DB orchestration for capability profiles: reads a student's
// assessment history and runs the pure engine. Kept separate from
// capabilityExtractor.ts (pure computation) per "separate orchestration
// from persistence" — the same split lib/projection/engine.ts (pure) vs
// lib/projection/recompute.ts (orchestration) already establishes.
//
// Pure-Domain Test Isolation Audit: capabilityExtractor.ts previously held
// both the pure extractCapabilityProfile() and this DB-backed function in
// one file, so importing extractCapabilityProfile() for a pure/unit test
// also pulled in `@/lib/repositories` — whose barrel eagerly constructs a
// Supabase client for all 42 repositories at import time — and crashed
// without Supabase credentials even though extractCapabilityProfile()
// itself makes no DB call. Moving the DB-backed half here restores
// capabilityExtractor.ts's ability to be imported and tested with zero
// environment/network/DB dependency.

import { repos } from '@/lib/repositories'
import { extractCapabilityProfile } from './capabilityExtractor'
import type { CapabilityProfile } from './types'

// ── Canonical capability computation ───────────────────────────────────────────
// The single source of truth for "what is this student's capability profile
// right now" from the `assessments` table. Every consumer that needs a
// capability profile derived from assessment history — the Learner Model
// (lib/learnerModel/updater.ts), the Career Operating System's persisted
// profile (lib/career/careerEngine.ts), and the on-demand career/capability
// API routes — calls this instead of independently querying `assessments`
// and calling extractCapabilityProfile() themselves. This does not change
// where results are persisted (each caller keeps its own storage target),
// only how the input scoreHistory is built, so every persisted profile is
// computed the same way for the same student at the same point in time.
//
// Returns null (never a fabricated profile) when there is no assessment
// evidence yet — missing evidence is not negative evidence.
export async function computeCapabilityProfile(
  studentId:       string,
  currentSnapshot?: Record<string, number>,
): Promise<CapabilityProfile | null> {
  const history = await repos.learnerModel.findAssessmentHistory(studentId)
  const scoreHistory = history.map(r => r.subject_scores)

  // A just-submitted assessment may not yet be visible to this query (read
  // replica lag, or the caller has it in-hand before the write settles) —
  // append it if it isn't already the most recent entry.
  if (currentSnapshot && (
    scoreHistory.length === 0 ||
    JSON.stringify(scoreHistory[scoreHistory.length - 1]) !== JSON.stringify(currentSnapshot)
  )) {
    scoreHistory.push(currentSnapshot)
  }

  if (scoreHistory.length === 0) return null
  return extractCapabilityProfile(scoreHistory)
}
