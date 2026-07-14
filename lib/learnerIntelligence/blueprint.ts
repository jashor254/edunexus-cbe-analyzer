// lib/learnerIntelligence/blueprint.ts
// Assembles the Learner Blueprint entirely from real, already-computed data —
// the Permanent Learner Memory (lib/learnerModel), the capability engine
// (lib/career/capabilityExtractor), and the Grade 7 Mathematics prerequisite
// engine (lib/knowledgeGraph/quickWins). No AI narrative generation here: every
// sentence is a template filled from a real number, so nothing can assert a
// trait or prediction the underlying data doesn't support.

import { repos } from '@/lib/repositories'
import { getStudentBasicInfo, getOrCreateLearnerProfile } from '@/lib/learnerModel'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { COS_DISCLAIMER } from '@/lib/career/types'
import type { CapabilityProfile, CapabilityScore } from '@/lib/career/types'
import { computeQuickWins } from '@/lib/knowledgeGraph'
import type { HolidayPlanData } from '@/lib/holiday/types'
import { HOLIDAY_PLAN_RELEVANCE_DAYS } from '@/lib/holiday/types'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { RiskFlag, LearnerIntelligenceProjection } from '@/lib/projection/types'
import { projectionToScoreHistory, projectionRiskFlags } from './projectionAdapters'
import { confidenceFromScore, insufficientEvidenceInsight } from './insight'
import type { Insight } from './insight'
import type { LearnerBlueprint, BlueprintEvidenceSummary } from './types'

const CAPABILITY_LABELS: Record<string, string> = {
  analytical_reasoning: 'analytical reasoning',
  communication:        'communication',
  creative_thinking:    'creative thinking',
  technical_aptitude:   'technical aptitude',
  social_intelligence:  'social intelligence',
  resilience:           'resilience',
}

const CAPABILITY_ACTIONS: Record<string, { strong: string; support: string }> = {
  analytical_reasoning: {
    strong:  'Introduce robotics, coding, or engineering-style problem sets to extend this strength.',
    support: 'Practise multi-step word problems with guided reasoning before moving to independent work.',
  },
  communication: {
    strong:  'Encourage debate, presentation, or writing-club opportunities to extend this strength.',
    support: 'Increase structured reading-and-summarising practice a few times a week.',
  },
  creative_thinking: {
    strong:  'Offer open-ended design, art, or music projects with room for original ideas.',
    support: 'Introduce more open-ended tasks with fewer fixed answers to build creative confidence.',
  },
  technical_aptitude: {
    strong:  'Introduce hands-on technical or pre-technical projects that apply this strength.',
    support: 'Build up technical practice with concrete, step-by-step hands-on exercises.',
  },
  social_intelligence: {
    strong:  'Give leadership or peer-mentoring roles in group work to extend this strength.',
    support: 'Increase structured group work with a clear, small role for the learner.',
  },
  resilience: {
    strong:  'Set stretch goals that require sustained effort over several weeks.',
    support: 'Break tasks into smaller wins and track them visibly to build persistence.',
  },
}

function capabilityInsight(dimension: string, score: CapabilityScore, assessmentCount: number): Insight {
  const label = CAPABILITY_LABELS[dimension] ?? dimension.replace(/_/g, ' ')

  // `score.confidence === 0` means capabilityExtractor observed zero subjects
  // for this dimension and is returning a labeled placeholder ("...score is
  // an estimate"), not a real measurement. Resilience is a trajectory signal
  // that needs 2+ assessments to mean anything — below that it also falls
  // back to a fixed placeholder. Both cases must say "insufficient evidence"
  // rather than a confident-sounding templated sentence built from a guess.
  const isPlaceholder = score.confidence === 0 || (dimension === 'resilience' && assessmentCount < 2)
  if (score.evidence.length === 0 || isPlaceholder) {
    return insufficientEvidenceInsight(label)
  }

  const trendPhrase: Record<CapabilityScore['trend'], string> = {
    declining:    'currently declining',
    stable:       'holding steady',
    growing:      'growing',
    accelerating: 'accelerating quickly',
  }

  const isStrong = score.level === 'strong' || score.level === 'exceptional'
  const actions  = CAPABILITY_ACTIONS[dimension]

  return {
    observation: `Current evidence suggests ${score.level} ${label}, ${trendPhrase[score.trend]}.`,
    evidence:    score.evidence,
    confidence:  confidenceFromScore(score.confidence),
    action:      isStrong ? actions.strong : actions.support,
  }
}

function capabilityDimensionEntries(profile: CapabilityProfile): Array<[string, CapabilityScore]> {
  return (Object.keys(CAPABILITY_LABELS) as Array<keyof typeof CAPABILITY_LABELS>)
    .map(key => [key, profile[key as keyof CapabilityProfile] as CapabilityScore])
}

async function buildBecomingInsights(capability: CapabilityProfile, assessmentCount: number): Promise<Insight[]> {
  return capabilityDimensionEntries(capability)
    .map(([dimension, score]) => capabilityInsight(dimension, score, assessmentCount))
}

async function buildOpportunityInsight(
  studentId:      string,
  grade:          number,
  capability:     CapabilityProfile,
  assessmentCount: number,
): Promise<Insight> {
  // Grade 7 Mathematics is the only subject/grade with a proven prerequisite
  // graph today (see MIGRATION.md) — use it when it applies, since a named
  // topic + blast radius is stronger evidence than a capability-dimension gap.
  if (grade === 7) {
    const quickWins = await computeQuickWins(studentId, 'mathematics', 7, 1)
    if (quickWins.length > 0) {
      const qw = quickWins[0]
      return {
        observation: `${qw.topicName} is this learner's highest-leverage gap in Mathematics right now.`,
        evidence: [
          `Current rating on ${qw.topicName}: ${qw.rating}/4`,
          `${qw.blastRadius} downstream topic(s) depend on mastering this first`,
          ...qw.unlockedTopicNames.slice(0, 3).map(name => `Blocks progress on: ${name}`),
        ],
        confidence: qw.blastRadius > 0 ? 'High' : 'Medium',
        action:     qw.reason,
      }
    }
  }

  // Exclude placeholders: `confidence === 0` means capabilityExtractor observed
  // zero subjects for that dimension (a labeled estimate, not a measurement),
  // and resilience needs 2+ assessments before its score reflects anything
  // real. An unmeasured dimension must never be picked as "greatest opportunity".
  const entries = capabilityDimensionEntries(capability)
    .filter(([dimension]) => dimension !== 'resilience' || assessmentCount >= 2)
    .filter(([, score]) => score.evidence.length > 0 && score.confidence > 0)
  if (entries.length === 0) return insufficientEvidenceInsight('growth opportunity')

  const [weakestDim, weakestScore] = entries.reduce((weakest, current) =>
    current[1].raw_score < weakest[1].raw_score ? current : weakest
  )
  const label = CAPABILITY_LABELS[weakestDim] ?? weakestDim.replace(/_/g, ' ')

  return {
    observation: `${label[0].toUpperCase()}${label.slice(1)} is this learner's greatest current growth opportunity.`,
    evidence:    weakestScore.evidence,
    confidence:  confidenceFromScore(weakestScore.confidence),
    action:      CAPABILITY_ACTIONS[weakestDim]?.support ?? `Focus additional practice on ${label}.`,
  }
}

function buildParentAction(
  riskFlags:   RiskFlag[],
  opportunity: Insight,
  holidayPlan: HolidayPlanData | null,
): Insight {
  const topFlag = riskFlags[0]
  if (topFlag) {
    // A conflicting-evidence flag is itself an uncertainty signal — it must
    // never read with the same "High" confidence as a corroborated risk
    // claim, or the flag defeats its own purpose.
    const isConflict = topFlag.reason.startsWith('Conflicting evidence')
    return {
      observation: `${topFlag.reason}`,
      evidence:    [`Risk flag: ${(topFlag.subject ?? 'overall').replace(/_/g, ' ')} (${topFlag.severity} severity)`, ...topFlag.evidenceIds.map(id => `Supporting evidence: ${id}`)],
      confidence:  isConflict ? 'Low' : 'High',
      action:      isConflict ? 'Ask the class teacher to review the conflicting records before acting on either one.' : 'Check in with the class teacher this week about this specific concern.',
    }
  }

  // Teacher-approved holiday plan outranks the generic capability opportunity
  // — it's specific, current, and reviewed by the class teacher rather than
  // a general template.
  if (holidayPlan) {
    return {
      observation: holidayPlan.parent_summary,
      evidence:    [
        `Holiday plan for ${holidayPlan.holiday_period}, approved by the class teacher.`,
        ...(holidayPlan.priority_gaps.length ? [`Priority focus areas: ${holidayPlan.priority_gaps.join(', ')}`] : []),
      ],
      confidence:  'High',
      action:      holidayPlan.weeks[0]?.parent_action ?? 'Follow the holiday plan shared by the class teacher.',
    }
  }

  return {
    observation: opportunity.observation,
    evidence:    opportunity.evidence,
    confidence:  opportunity.confidence,
    action:      `At home, support this by: ${opportunity.action}`,
  }
}

function buildTeacherAction(profile: Awaited<ReturnType<typeof getOrCreateLearnerProfile>>, opportunity: Insight): Insight {
  const gaps = profile.confirmed_gaps
  if (gaps.length > 0) {
    return {
      observation: `This learner has a confirmed gap (weak across 2+ assessments) in: ${gaps.join(', ')}.`,
      evidence:    gaps.map(gap => `Confirmed gap: ${gap}`),
      confidence:  'High',
      action:      `Prioritise remedial time on ${gaps[0]} before introducing dependent content.`,
    }
  }

  return {
    observation: opportunity.observation,
    evidence:    opportunity.evidence,
    confidence:  opportunity.confidence,
    action:      opportunity.action,
  }
}

function buildEvidenceSummary(
  projection:  LearnerIntelligenceProjection,
  capability:  CapabilityProfile | null,
  assessmentCount: number,
): BlueprintEvidenceSummary {
  const completeness = projection.completeness

  const evidenceUsed = completeness?.value.subjectsCovered ?? []
  // completeness.confidence is 0-100 (Projection Engine scale); confidenceFromScore
  // expects 0-1 — reusing the one shared confidence-labeling function rather than
  // inventing a second threshold set.
  const confidence = completeness ? confidenceFromScore(completeness.confidence / 100) : 'Low'
  const freshnessDays = completeness?.coverage.freshnessDays ?? null

  const missingEvidence = capability
    ? capabilityDimensionEntries(capability)
        .filter(([dimension, score]) => score.evidence.length === 0 || (dimension === 'resilience' && assessmentCount < 2))
        .map(([dimension]) => CAPABILITY_LABELS[dimension] ?? dimension.replace(/_/g, ' '))
    : Object.values(CAPABILITY_LABELS)

  const recommendedNextEvidence = missingEvidence.length > 0
    ? `Based on available evidence, a topical assessment or teacher observation covering ${missingEvidence[0]} would sharpen this Blueprint's confidence most.`
    : freshnessDays !== null && freshnessDays > 60
      ? `Current evidence suggests this Blueprint is complete but ageing (${freshnessDays} days since the most recent record) — a fresh assessment would confirm it still holds.`
      : `Current evidence suggests this Blueprint is well-supported — continued regular assessment will keep it that way.`

  return { evidenceUsed, confidence, freshnessDays, missingEvidence, recommendedNextEvidence }
}

function buildLearnerAction(opportunity: Insight): Insight {
  return {
    observation: opportunity.observation,
    evidence:    opportunity.evidence,
    confidence:  opportunity.confidence,
    action:      `Your next step: ${opportunity.action}`,
  }
}

export async function buildLearnerBlueprint(studentId: string): Promise<LearnerBlueprint> {
  const holidayPlanSince = new Date(Date.now() - HOLIDAY_PLAN_RELEVANCE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // `profile` is retained only for confirmed_gaps (teacher-authored data, not
  // computed intelligence) — capability and risk now come from the
  // Projection Engine, not learner_profiles. See docs/architecture/migration-ledger.md.
  const [student, profile, projection, holidayPlan] = await Promise.all([
    getStudentBasicInfo(studentId),
    getOrCreateLearnerProfile(studentId),
    recomputeLearnerProjection(studentId),
    repos.learnerIntelligence.findPublishedHolidayPlan(studentId, holidayPlanSince),
  ])

  if (!student) throw new Error(`buildLearnerBlueprint: student ${studentId} not found`)

  const scoreHistory = projectionToScoreHistory(projection)
  const capability   = scoreHistory.length > 0
    ? extractCapabilityProfile(scoreHistory)
    : null
  const riskFlags = projectionRiskFlags(projection)

  const becomingInsights = capability ? await buildBecomingInsights(capability, scoreHistory.length) : []
  const opportunityInsight = capability
    ? await buildOpportunityInsight(studentId, student.grade, capability, scoreHistory.length)
    : insufficientEvidenceInsight('this learner’s growth opportunity')

  return {
    studentId,
    studentName: student.name,
    grade:       student.grade,
    term:        student.term,
    year:        student.year,
    school:      student.school,
    generatedAt: new Date().toISOString(),
    disclaimer:  COS_DISCLAIMER,
    evidenceSummary: buildEvidenceSummary(projection, capability, scoreHistory.length),

    becoming: {
      insights: becomingInsights,
    },

    opportunity: {
      insight: opportunityInsight,
    },

    actions: {
      parent:  buildParentAction(riskFlags, opportunityInsight, holidayPlan),
      teacher: buildTeacherAction(profile, opportunityInsight),
      learner: buildLearnerAction(opportunityInsight),
    },
  }
}
