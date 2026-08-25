// app/api/teacher/monday-panel/buildAction.ts
//
// Pure formatting only — no DB, no imports beyond this file, deliberately
// separated from route.ts so it stays testable without constructing any
// Supabase client (lib/repositories' eagerly-constructing singleton would
// otherwise make this file's own tests require Supabase credentials for a
// function that touches no database at all).
//
// Phase 3.5 (Risk Consumer Convergence): `flag` is the canonical Projection
// RiskFlag (lib/projection/types.ts) — {subject, evidenceIds, severity,
// reason} — not the legacy learner_profiles taxonomy {type, substrand,
// detail}. Projection's `reason` is already a complete, evidence-grounded
// sentence (e.g. "Below Expectation in mathematics and declining from
// prior evidence"); this formats it for the teacher, it does not
// reclassify or re-derive the underlying judgment (no new risk formula —
// see the Phase 3.5 mandate). The legacy switch's bespoke
// prerequisite/disengagement phrasing is intentionally not reproduced
// here: Projection's evidence-only risk projector has no equivalent
// concept for either (prerequisite gaps are covered separately by Monday
// Panel's own Layer 3 prerequisiteAlerts; disengagement has no Projection
// equivalent at all — see the Phase 3.5 closeout's residual legacy
// inventory).
export function buildAction(
  flag: { subject: string; severity: 'watch' | 'at_risk' | 'critical'; reason: string } | undefined,
  firstName: string
): string {
  if (!flag) return `Check in with ${firstName} this week — their profile is incomplete.`
  return `${firstName}: ${flag.reason}`
}
