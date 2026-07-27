// lib/learnerBlueprint/coherence/rules/evidenceSufficiency.ts
//
// Rule 1 — Evidence Sufficiency. Re-verifies, at the Blueprint layer, an
// invariant the Projection Engine is already supposed to guarantee (a
// trend/direction claim requires at least two data points) — a "compiler"
// does not trust its inputs blindly, it checks the chain link actually
// holds. If this ever fires, the bug is upstream (a Projection regression),
// but the Blueprint is where a teacher would see the consequence, so this
// is where it must be caught before publication.

import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { CoherenceFinding } from '../types'

export function checkEvidenceSufficiency(blueprint: LearnerBlueprint): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  // "trend from one observation" — a subject record claiming a directional
  // trend (not 'insufficient_data') must be backed by at least 2 evidence
  // points; Projection's own academicProjector already enforces this, but
  // the compiler re-checks it here rather than assuming it always will.
  if (blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data) {
    for (const subject of blueprint.academicRecord.data.bySubject) {
      if (subject.trend !== 'insufficient_data' && subject.evidenceCount < 2) {
        findings.push({
          rule: 'evidence_sufficiency',
          severity: 'critical',
          section: 'academicRecord',
          explanation: `${subject.subject} is reported as trend "${subject.trend}" from only ${subject.evidenceCount} evidence point(s) — a trend claim requires at least 2.`,
          evidenceReference: `academicRecord.bySubject.${subject.subject}`,
          suggestedCorrection: `Recompute this subject's trend as 'insufficient_data' until at least 2 confirmed evidence points exist, or verify the Projection Engine's own evidence-count guard.`,
        })
      }
    }
  }

  // "long-term growth from one assessment" — a Growth Timeline entry
  // describing a trajectory backed by fewer than 2 supporting evidence
  // items is asserting a direction the evidence cannot actually support.
  if (blueprint.growthTimeline.status === 'available' && blueprint.growthTimeline.data) {
    for (const entry of blueprint.growthTimeline.data) {
      if (entry.supportingEvidenceIds.length < 2) {
        findings.push({
          rule: 'evidence_sufficiency',
          severity: 'warning',
          section: 'growthTimeline',
          explanation: `A growth trajectory ("${entry.trajectory}") is described from only ${entry.supportingEvidenceIds.length} supporting evidence item(s) — a long-term growth claim on this little evidence should be read as provisional, not asserted plainly.`,
          evidenceReference: entry.supportingEvidenceIds.join(',') || null,
          suggestedCorrection: `Present this trajectory as provisional until at least 2 evidence points support it, or omit the trajectory claim entirely for this window.`,
        })
      }
    }
  }

  // "declining with no active concern" — Phase 4B.1. Academic Record's
  // overall trend and Risk are both Projection-derived but computed
  // independently; nothing previously cross-checked that a "declining"
  // trend and a "normal, no active flags" risk read aren't quietly
  // contradicting each other. Warning, not critical: a genuine one-term
  // dip with no risk flag yet is a plausible, real state (risk thresholds
  // are deliberately not the same as a single trend read) — this is a
  // "worth a second look," not a structural falsehood the way an
  // unsupported "least secure" claim is.
  if (
    blueprint.academicRecord.status === 'available' &&
    blueprint.academicRecord.data?.overallTrend === 'declining' &&
    blueprint.risk.status === 'available' &&
    blueprint.risk.data &&
    blueprint.risk.data.overallRiskLevel === 'normal' &&
    blueprint.risk.data.flags.length === 0
  ) {
    findings.push({
      rule: 'evidence_sufficiency',
      severity: 'warning',
      section: 'risk',
      explanation: `Academic Record reports an overall "declining" trend, but Risk reports overallRiskLevel "normal" with zero active flags — the growth summary and the risk status present differing conclusions with nothing in the Blueprint explaining why.`,
      evidenceReference: 'academicRecord.overallTrend',
      suggestedCorrection: 'Confirm this divergence is real (e.g. a single-term dip not yet severe enough to raise a risk flag) rather than two Projections quietly disagreeing — consider surfacing the reason if it is expected.',
    })
  }

  return findings
}
