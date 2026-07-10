// lib/learnerIntelligence/insight.ts
// The single primitive every Learner Blueprint / Career Intelligence claim is built from.
//
// EIOS Principle: no sentence shown to a learner, parent, or teacher may assert a
// conclusion without the evidence that produced it. `confidenceFromScore` is the
// one place a 0-1 confidence number becomes a Low/Medium/High label — every
// engine that emits an Insight must go through it rather than inventing its own
// thresholds, so labels stay comparable across capability, prerequisite, and
// pathway insights.

export type ConfidenceLevel = 'Low' | 'Medium' | 'High'

export type Insight = {
  observation: string
  evidence:    string[]
  confidence:  ConfidenceLevel
  action:      string
}

export function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 0.7) return 'High'
  if (score >= 0.4) return 'Medium'
  return 'Low'
}

// Used whenever an engine has too little data to support any claim — the
// mandate requires saying this explicitly rather than filling the gap with
// a plausible-sounding sentence.
export function insufficientEvidenceInsight(topic: string): Insight {
  return {
    observation: `There is currently insufficient evidence to conclude anything about ${topic}.`,
    evidence:    [],
    confidence:  'Low',
    action:      'Collect more assessment data before drawing conclusions here.',
  }
}
