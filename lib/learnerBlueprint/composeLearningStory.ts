import type { BlueprintSection, LearningStoryData, LearningStoryInputs } from './types'

const OWNER = 'lib/learnerBlueprint/composeLearningStory'

// ─────────────────────────────────────────────────────────────────────────
// Editorial Polish Sprint (2026-08-03) — this file's prose was rewritten to
// remove repetitive stock openers ("Current evidence suggests...", "Across
// the available evidence...") that previously started 4-6 of this
// narrative's 8 sentences back to back. No fact, threshold, or branching
// condition changed — every case below fires under exactly the same
// condition it did before this pass; only the sentence construction did.
//
// Two literal-substring constraints carry over unchanged and must not
// drift, because other modules pattern-match this file's own output text:
//   1. lib/learnerBlueprint/coherence/rules/textSignals.ts's
//      DEFICIENCY_MARKERS/STRENGTH_MARKERS word lists — "least secure" is
//      used, and only used, in the one branch below where a genuinely
//      below-threshold weakest subject is being named (see
//      describeCapability's mixed+belowThreshold case). Every other branch
//      deliberately avoids every marker word ("weak", "behind", "gap in",
//      "not meeting", "needs attention", etc.) so the Coherence Engine's
//      narrativeAlignment/frictionDetection rules can't misfire against
//      prose that was never asserting a deficiency.
//   2. narrativeAlignment.ts's own literal-phrase checks: `nextConcern`
//      must contain "no current risk flag is active" verbatim when there
//      are no risk flags (NA1), and `trajectory`/`nextConcern` combined
//      must contain "declin" when the overall trend is declining (NA3).
//
// growthTimeline's `entry.trajectory` string itself is Projection-owned
// (lib/projection/growthProjector.ts), not composed here — this file only
// wraps it in one framing sentence and never rewrites the trajectory text
// itself, per this sprint's explicit "do not touch Educational Intelligence
// logic" boundary.
// ─────────────────────────────────────────────────────────────────────────

/** `nextRecommendedAction` (learningCompass, a different composer) isn't guaranteed to end in sentence punctuation — appending it as the tail of a sentence without checking produced a missing trailing period for real recommendation text like "Continue with mathematics". Adds one only when it's actually missing. */
function withSentenceEnd(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text : `${text}.`
}

function confidenceBand(score: number | null): 'low' | 'moderate' | 'high' {
  if (score === null) return 'low'
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

function describeCapability(inputs: LearningStoryInputs): {
  evidence: string
  interpretation: string
  opportunity: string
} {
  const capability = inputs.capability
  const academic = inputs.academicRecord.data
  const nextAction = inputs.learningCompass.data?.nextRecommendedAction ?? null

  if (!capability) {
    return {
      evidence: academic && academic.bySubject.length > 0
        ? `Across the available evidence, the current academic record covers ${academic.bySubject.length} subject${academic.bySubject.length === 1 ? '' : 's'}.`
        : 'Capability evidence is still thin at this stage.',
      interpretation: academic?.overallTrend
        ? `The pattern so far points toward a ${academic.overallTrend} trajectory, though there isn't yet enough capability evidence to say more.`
        : 'There isn\'t yet enough evidence to describe a stable capability pattern.',
      opportunity: nextAction
        ? `Gathering more subject evidence would sharpen the picture — starting point: ${withSentenceEnd(nextAction)}`
        : 'Gathering more subject evidence would sharpen the next step.',
    }
  }

  const subjects = Object.entries(capability.value.bySubject)

  // A "weakest subject" claim requires at least two subjects to compare —
  // the minimum of a one-item (or empty) set is not a weakness, it is the
  // only data point. Naming a learner's only recorded subject "least
  // secure" purely because it is alone in the set was a real, reproduced
  // bug (docs/architecture/educational-intelligence-validation-report.md
  // §6 Finding 2; independently caught by lib/learnerBlueprint/coherence's
  // narrative_alignment rule) — fixed at the source here, not just
  // diagnosed after the fact.
  if (subjects.length <= 1) {
    const only = subjects[0]
    const opportunityBase = only
      ? `There isn't yet a second subject recorded to compare ${only[0]} against, so the clearest opportunity is simply building evidence in additional subjects.`
      : 'The clearest opportunity is to gather more subject evidence before narrowing the next step.'
    return {
      evidence: only
        ? `${capability.value.overallLevel[0].toUpperCase()}${capability.value.overallLevel.slice(1)} is the most consistent description of capability so far, based on ${only[0]} alone.`
        : `${capability.value.overallLevel[0].toUpperCase()}${capability.value.overallLevel.slice(1)} is the most consistent description of capability so far.`,
      interpretation: only
        ? 'With only one subject recorded, this is a single data point rather than a comparison across subjects.'
        : 'The evidence points to a fairly consistent profile at the moment.',
      opportunity: nextAction ? `${opportunityBase} The current recommendation: ${withSentenceEnd(nextAction)}` : opportunityBase,
    }
  }

  const strongest = [...subjects].sort((a, b) => b[1].score - a[1].score)[0]
  const weakest = [...subjects].sort((a, b) => a[1].score - b[1].score)[0]
  const spread = strongest[1].score - weakest[1].score
  const mixed = spread >= 0.25 && strongest[0] !== weakest[0]

  // Phase 4B.1 (docs/architecture/comparable-context-growth-correction-
  // phase4b1.md) — a real, reproduced bug: `opportunityCore` used to name
  // `weakest` "least secure" unconditionally, even when `mixed` was false
  // (no meaningful gap) and even when the weakest subject was itself
  // `capable`/`strong`/`exceptional` — a relatively-lower-but-still-strong
  // subject is not insecure, and calling it so directly contradicted this
  // same narrative's own "relatively consistent capability profile" line.
  // `belowThreshold` is the one distinction that actually justifies
  // remediation-style language: the weakest subject being genuinely
  // early-stage (`emerging`/`developing`), not merely lower than an
  // even-stronger sibling subject.
  const belowThreshold = weakest[1].level === 'emerging' || weakest[1].level === 'developing'

  const evidence = mixed
    ? `Across the available evidence, capability is stronger in ${strongest[0]} and comparatively lower in ${weakest[0]}.`
    : `${capability.value.overallLevel[0].toUpperCase()}${capability.value.overallLevel.slice(1)} best describes the current capability picture across the board.`

  const interpretation = mixed
    ? 'This is a picture developing unevenly rather than moving as one, which makes targeted support more useful than a single overall label.'
    : 'The evidence points to a fairly consistent profile at the moment.'

  const opportunityCore = mixed
    ? (belowThreshold
        ? `${weakest[0]} is where the present evidence is least secure, and the clearest place to focus support.`
        : `${weakest[0]} sits below ${strongest[0]} in the current evidence but remains ${weakest[1].level} — read this as an enrichment opportunity in ${strongest[0]}, or continued challenge in ${weakest[0]}, rather than a deficit to correct.`)
    : 'No single subject stands out as needing particular focus right now — the clearest opportunity is deepening evidence across the board.'

  return {
    evidence,
    interpretation,
    opportunity: nextAction ? `${opportunityCore} Next step: ${withSentenceEnd(nextAction)}` : opportunityCore,
  }
}

function describeTrajectory(inputs: LearningStoryInputs): string {
  if (inputs.growthTimeline.status !== 'available' || !inputs.growthTimeline.data?.[0]) {
    return 'There is not yet enough evidence to describe a reliable growth direction.'
  }

  const entry = inputs.growthTimeline.data[0]
  const pointWord = entry.supportingEvidenceIds.length === 1 ? 'point' : 'points'
  return `${entry.trajectory} (Based on ${entry.supportingEvidenceIds.length} scored evidence ${pointWord}.)`
}

function describeRisk(inputs: LearningStoryInputs): { nextConcern: string; uncertainty: string } {
  if (inputs.risk.status !== 'available' || !inputs.risk.data) {
    return {
      nextConcern: 'No supported risk exposure is available yet from the canonical projection.',
      uncertainty: 'This conclusion remains provisional because risk cannot be described without enough scored evidence.',
    }
  }

  if (inputs.risk.data.flags.length === 0) {
    return {
      nextConcern: 'No current risk flag is active.',
      uncertainty: 'This can change as new evidence arrives, so it is read as the present picture, not a permanent one.',
    }
  }

  const topFlag = inputs.risk.data.flags[0]
  return {
    nextConcern: `The concern most worth attention right now is ${topFlag.reason.toLowerCase()}.`,
    uncertainty: 'This reflects only the evidence recorded so far, and will be revisited as more arrives.',
  }
}

function describeConfidence(inputs: LearningStoryInputs): { confidenceStatement: string; missingEvidence: string } {
  const completeness = inputs.completeness
  if (!completeness) {
    return {
      confidenceStatement: 'There is not yet enough evidence to judge confidence reliably.',
      missingEvidence: 'More recent scored evidence from more subjects is still missing.',
    }
  }

  const band = confidenceBand(Math.min(completeness.confidence, completeness.value.completenessScore))
  const subjectCount = completeness.value.subjectsCovered.length
  const freshnessDays = completeness.coverage.freshnessDays
  const freshnessText = freshnessDays === null ? 'unknown freshness' : `${freshnessDays} day${freshnessDays === 1 ? '' : 's'} since the latest supporting evidence`

  const confidenceStatement = band === 'high'
    ? `Confidence in this picture is high: coverage spans ${subjectCount} subject${subjectCount === 1 ? '' : 's'}, with ${freshnessText}.`
    : band === 'moderate'
      ? `This remains a moderate-confidence picture — the pattern is visible, but coverage is still incomplete (${subjectCount} subject${subjectCount === 1 ? '' : 's'}, ${freshnessText}).`
      : `This remains a low-confidence picture — the story is still provisional (${subjectCount} subject${subjectCount === 1 ? '' : 's'}, ${freshnessText}).`

  const missingEvidence = completeness.value.subjectsCovered.length < 5 || completeness.value.sourceDiversity < 2
    ? 'What is still missing is evidence across more subjects or independent sources, so this remains a provisional read.'
    : 'What would sharpen this further is more recent confirmation that the current pattern is holding.'

  return { confidenceStatement, missingEvidence }
}

export function composeLearningStory(inputs: LearningStoryInputs): BlueprintSection<LearningStoryData> {
  const learnerName = inputs.identity.data?.learnerName ?? 'This learner'

  const hasStoryInputs = Boolean(
    inputs.academicRecord.status === 'available' ||
    inputs.capability ||
    inputs.completeness ||
    inputs.growthTimeline.status === 'available' ||
    inputs.risk.status === 'available'
  )

  if (!hasStoryInputs) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'There is not yet enough canonical evidence to compose a Learning Story for this learner.',
    }
  }

  const capabilityDescription = describeCapability(inputs)
  const trajectory = describeTrajectory(inputs)
  const riskDescription = describeRisk(inputs)
  const confidenceDescription = describeConfidence(inputs)

  // Editorial flow (Part 2 of the Editorial Polish Sprint): current picture
  // -> observed strengths/pattern -> current challenges -> trajectory ->
  // confidence and limitations -> next educational priority, last. Every
  // fragment below is still independently exposed on `data` for any
  // consumer that reads a single field rather than the assembled prose.
  const narrative = [
    `${learnerName}'s story is still unfolding — this is a snapshot from the evidence gathered so far, not a fixed verdict.`,
    capabilityDescription.evidence,
    capabilityDescription.interpretation,
    riskDescription.nextConcern,
    trajectory,
    confidenceDescription.confidenceStatement,
    confidenceDescription.missingEvidence,
    capabilityDescription.opportunity,
  ].join(' ')

  return {
    status: 'available',
    owner: OWNER,
    freshness: 'live',
    data: {
      narrative,
      evidence: capabilityDescription.evidence,
      interpretation: capabilityDescription.interpretation,
      opportunity: capabilityDescription.opportunity,
      trajectory,
      nextConcern: riskDescription.nextConcern,
      uncertainty: riskDescription.uncertainty,
      confidenceStatement: confidenceDescription.confidenceStatement,
      missingEvidence: confidenceDescription.missingEvidence,
    },
  }
}
