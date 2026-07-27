// lib/learnerBlueprint/coherence/rules/recommendationAlignment.ts
//
// Rule 3 — Recommendation Alignment. Verifies a recommendation/action's own
// claim (its rationale, or the composed Parent Action text derived
// verbatim from that rationale — see composeRecommendedNextSteps.ts /
// projections.ts's toParentView, which passes `item.rationale` through
// unedited as `description`) is not contradicted by the Projection-derived
// sections sitting beside it in the same Blueprint. This directly
// operationalizes a real bug the Phase 4 audit found: an approved action
// claiming "comprehension below the level expected" for a subject whose
// own Academic Record showed the maximum CBC level and whose Risk section
// showed zero active flags.

import type { LearnerBlueprint, SubjectRecord } from '@/lib/learnerBlueprint/types'
import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { CoherenceFinding } from '../types'
import { textMentionsSubject, textAssertsDeficiency } from './textSignals'

/** True when the learner's own Academic Record + Risk sections give this subject a clean bill of health — the exact condition a "this subject is deficient" claim would contradict. */
function subjectLooksHealthy(subject: SubjectRecord, riskFlagsForSubject: number): boolean {
  return subject.latestLevel === 4 && subject.trend !== 'declining' && riskFlagsForSubject === 0
}

export function checkRecommendationAlignment(
  blueprint: LearnerBlueprint,
  actionItems: BlueprintActionItem[]
): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  const bySubject = blueprint.academicRecord.status === 'available' ? blueprint.academicRecord.data?.bySubject ?? [] : []
  const riskFlags = blueprint.risk.status === 'available' ? blueprint.risk.data?.flags ?? [] : []

  // RA1/RA3 — an action's own rationale asserts a deficiency in a subject
  // the learner's Academic Record + Risk show is healthy (also covers
  // "strongest subject recommended for remediation": a subject at the
  // maximum CBC level with no active risk flag is, by definition, not the
  // learner's weakest subject).
  for (const item of actionItems) {
    const claimText = `${item.title} ${item.rationale}`
    if (!textAssertsDeficiency(claimText)) continue

    for (const subject of bySubject) {
      if (!textMentionsSubject(claimText, subject.subject)) continue
      const flagsForSubject = riskFlags.filter(f => f.subject === subject.subject).length
      if (subjectLooksHealthy(subject, flagsForSubject)) {
        findings.push({
          rule: 'recommendation_alignment',
          severity: 'critical',
          section: `actionItem:${item.id}`,
          explanation: `Action "${item.title}" asserts a deficiency in ${subject.subject} ("${item.rationale}"), but Academic Record shows ${subject.subject} at CBC level 4 (the maximum), trend "${subject.trend}", with zero active Risk flags for that subject. The recommendation contradicts the learner's own evidence.`,
          evidenceReference: `academicRecord.bySubject.${subject.subject}`,
          suggestedCorrection: 'Re-verify this action against the learner\'s current Evidence/Projection before approving or re-approving it — either the rationale is stale, or it names the wrong subject.',
        })
      }
    }
  }

  // RA2 — an active risk flag with no corresponding recommended action
  // anywhere in the approved action set (ignored without explanation).
  for (const flag of riskFlags) {
    if (flag.severity !== 'at_risk' && flag.severity !== 'critical') continue
    if (!flag.subject) continue
    const hasCorrespondingAction = actionItems.some(item =>
      textMentionsSubject(`${item.title} ${item.rationale} ${item.targetCapability ?? ''}`, flag.subject as string)
    )
    if (!hasCorrespondingAction) {
      findings.push({
        rule: 'recommendation_alignment',
        severity: 'warning',
        section: 'recommendedNextSteps',
        explanation: `Risk reports a ${flag.severity} flag for ${flag.subject} ("${flag.reason}"), but no approved action item addresses that subject.`,
        evidenceReference: flag.evidenceIds.join(',') || null,
        suggestedCorrection: `Propose an action targeting ${flag.subject}, or record why none is needed yet.`,
      })
    }
  }

  return findings
}
