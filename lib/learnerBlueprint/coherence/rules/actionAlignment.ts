// lib/learnerBlueprint/coherence/rules/actionAlignment.ts
//
// Rule 4 — Action Alignment. Every approved action must answer "what
// educational problem is this solving?" A non-empty `rationale` is already
// required at write time (validation.ts's `validateProposeInput`) — this
// re-checks that invariant defensively (AA1) rather than trusting it holds
// forever, exactly as Evidence Sufficiency does for Projection.
//
// AA2/AA3: an action with no supporting evidence chain
// (`evidenceBasis.supportingEvidenceIds` empty and `projectorType` null —
// i.e. `EVIDENCE_BASIS_EMPTY`, see actionPlan/types.ts) is treated
// differently depending on provenance, deliberately, not by oversight:
//   - `proposalSource === 'system'` (candidateGeneration.ts's output, were
//     it ever reconnected) must always carry a real evidence chain by
//     construction — an empty one here is a real bug -> CRITICAL.
//   - `proposalSource === 'teacher'` is explicitly allowed to have no
//     formal Projection backing (a teacher's own professional judgement
//     doesn't require a machine-computed evidence chain to be valid) -> a
//     WARNING, worth a second look, never a hard rejection. Flagging every
//     teacher-authored action here regardless would make PASS_WITH_WARNINGS
//     meaningless noise on the common case this codebase's own domain
//     model was explicitly designed to allow.

import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { CoherenceFinding } from '../types'

function hasEvidenceChain(item: BlueprintActionItem): boolean {
  return item.evidenceBasis.supportingEvidenceIds.length > 0 || item.evidenceBasis.projectorType !== null
}

export function checkActionAlignment(actionItems: BlueprintActionItem[]): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  for (const item of actionItems) {
    // AA1 — defensive re-check of a write-time invariant.
    if (!item.rationale || item.rationale.trim().length === 0) {
      findings.push({
        rule: 'action_alignment',
        severity: 'critical',
        section: `actionItem:${item.id}`,
        explanation: `Action "${item.title}" has no rationale — it does not answer "what educational problem is this solving?"`,
        evidenceReference: null,
        suggestedCorrection: 'Every approved action must state the educational problem it addresses; this should be unreachable given write-time validation and indicates that validation regressed.',
      })
    }

    if (hasEvidenceChain(item)) continue

    // AA2 — a system-authored action with no evidence chain is a real bug.
    if (item.proposalSource === 'system') {
      findings.push({
        rule: 'action_alignment',
        severity: 'critical',
        section: `actionItem:${item.id}`,
        explanation: `System-proposed action "${item.title}" has no supporting evidence chain (empty evidenceBasis) — a system-generated candidate must always be evidence-grounded.`,
        evidenceReference: null,
        suggestedCorrection: 'Do not persist a system-generated candidate whose evidenceBasis is empty — candidateGeneration.ts already returns null rather than a candidate in that case; check the caller for a bypass.',
      })
      continue
    }

    // AA3 — a teacher-authored action with no evidence chain: allowed by
    // design, still worth a warning per field actually populated, so a
    // reviewer can see exactly which of the action's stakeholder-facing
    // fields is asserting something with nothing machine-checkable behind it.
    const populatedFields: Array<{ field: 'teacherAction' | 'learnerAction' | 'parentSupport'; value: string | null }> = [
      { field: 'teacherAction', value: item.teacherAction },
      { field: 'learnerAction', value: item.learnerAction },
      { field: 'parentSupport', value: item.parentSupport },
    ]
    for (const { field, value } of populatedFields) {
      if (!value) continue
      findings.push({
        rule: 'action_alignment',
        severity: 'warning',
        section: `actionItem:${item.id}.${field}`,
        explanation: `Action "${item.title}"'s ${field} ("${value}") has no supporting evidence chain — this is a permitted teacher-authored judgement, not an error, but worth confirming it still reflects the learner's current evidence.`,
        evidenceReference: null,
        suggestedCorrection: 'No action required if this remains the teacher\'s intentional professional judgement; link a Projection-derived evidence basis if this was meant to be evidence-driven.',
      })
    }
  }

  return findings
}
