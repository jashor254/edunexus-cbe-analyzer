import type { BlueprintSection, LearningStoryData, LearningStoryInputs } from './types'

const OWNER = 'lib/learnerBlueprint/composeLearningStory'

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
        : 'Across the available evidence, capability coverage is still thin.',
      interpretation: academic?.overallTrend
        ? `Current evidence suggests a ${academic.overallTrend} academic pattern, but capability coverage is still too limited for a stronger claim.`
        : 'There is not yet enough evidence to describe a stable capability pattern.',
      opportunity: nextAction
        ? `The clearest current opportunity is to act on the live learning recommendation: ${nextAction}.`
        : 'The greatest current opportunity is to gather more subject evidence before narrowing the next step.',
    }
  }

  const subjects = Object.entries(capability.value.bySubject)
  const strongest = [...subjects].sort((a, b) => b[1].score - a[1].score)[0]
  const weakest = [...subjects].sort((a, b) => a[1].score - b[1].score)[0]
  const spread = strongest && weakest ? strongest[1].score - weakest[1].score : 0
  const mixed = spread >= 0.25 && strongest && weakest && strongest[0] !== weakest[0]

  const evidence = mixed
    ? `Across the available evidence, current capability is stronger in ${strongest[0]} and less secure in ${weakest[0]}.`
    : `Across the available evidence, current capability is most consistently described as ${capability.value.overallLevel}.`

  const interpretation = mixed
    ? `Current evidence suggests the learner is developing unevenly rather than moving uniformly, which makes targeted support more useful than a broad label.`
    : `Current evidence suggests a relatively consistent capability profile at the moment.`

  const opportunityCore = weakest
    ? `The greatest current opportunity is to strengthen ${weakest[0]}, where the present capability evidence is least secure.`
    : 'The greatest current opportunity is to deepen the current strongest area with more evidence.'

  return {
    evidence,
    interpretation,
    opportunity: nextAction ? `${opportunityCore} The live learning recommendation points to this next step: ${nextAction}.` : opportunityCore,
  }
}

function describeTrajectory(inputs: LearningStoryInputs): string {
  if (inputs.growthTimeline.status !== 'available' || !inputs.growthTimeline.data?.[0]) {
    return 'There is not yet enough evidence to describe a reliable growth direction.'
  }

  const entry = inputs.growthTimeline.data[0]
  return `${entry.trajectory} This direction is based on ${entry.supportingEvidenceIds.length} scored evidence point${entry.supportingEvidenceIds.length === 1 ? '' : 's'}.`
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
      nextConcern: 'Across the available evidence, no current risk flag is active.',
      uncertainty: 'This conclusion remains provisional because risk can change as new evidence arrives.',
    }
  }

  const topFlag = inputs.risk.data.flags[0]
  return {
    nextConcern: `The main concern that deserves attention now is ${topFlag.reason.toLowerCase()}.`,
    uncertainty: 'This conclusion remains provisional because the current risk picture only reflects the evidence recorded so far.',
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
    ? `Current evidence suggests a high-confidence picture: coverage spans ${subjectCount} subject${subjectCount === 1 ? '' : 's'} with ${freshnessText}.`
    : band === 'moderate'
      ? `Current evidence suggests a moderate-confidence picture: the pattern is visible, but coverage is still incomplete (${subjectCount} subject${subjectCount === 1 ? '' : 's'}, ${freshnessText}).`
      : `Current evidence suggests a low-confidence picture: the story is still provisional (${subjectCount} subject${subjectCount === 1 ? '' : 's'}, ${freshnessText}).`

  const missingEvidence = completeness.value.subjectsCovered.length < 5 || completeness.value.sourceDiversity < 2
    ? 'Evidence is still missing across more subjects or independent sources, so this story should be read as provisional.'
    : 'The clearest missing evidence is more recent confirmation that the current pattern is holding.'

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

  const narrative = [
    `${learnerName} is still emerging through the current evidence rather than a fixed label.`,
    capabilityDescription.evidence,
    capabilityDescription.interpretation,
    capabilityDescription.opportunity,
    riskDescription.nextConcern,
    trajectory,
    confidenceDescription.confidenceStatement,
    confidenceDescription.missingEvidence,
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
