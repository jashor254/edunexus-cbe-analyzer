// lib/eils/reasoningEngine.ts
// Layer 2 — Education Reasoning Engine
//
// Answers "why" questions about a learner with evidence chains.
// Every conclusion includes: what we know, why we think that, how confident we are.
//
// Does not call any AI model — reasoning is deterministic from learner data.
// AI narrative generation lives in the coordinator (Layer 9).

import { analyseStudentRootCauses } from '@/lib/knowledgeGraph'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type { LearnerProfile, RiskFlag } from '@/lib/learnerModel/types'
import type { RootCauseResult } from '@/lib/knowledgeGraph/types'
import type { ReasoningResult, ActionRecommendation, ReasoningEvidence } from './types'

// ── Public API ────────────────────────────────────────────────────────────────

export async function whyIsLearnerStruggling(
  studentId: string,
  grade:     number,
  subject?:  string,
): Promise<ReasoningResult> {
  const [profile, rootCauses] = await Promise.all([
    getOrCreateLearnerProfile(studentId),
    safeRootCauses(studentId, grade),
  ])

  const focusRootCauses = subject
    ? rootCauses.filter(r => r.subject === subject)
    : rootCauses

  const evidence = buildEvidence(profile, rootCauses)

  // Check 1: Missing prerequisites
  const prereqFlags = profile.risk_flags.filter(f => f.type === 'missing_prerequisite')
  if (prereqFlags.length > 0) {
    const missing = prereqFlags.map(f => f.substrand ?? f.detail).join(', ')
    return conclude(
      `Why is ${subject ?? 'the learner'} struggling?`,
      `Missing prerequisite concepts: ${missing}. The learner cannot access current-grade content because foundational knowledge from earlier grades has not been established.`,
      0.9,
      evidence,
      [
        {
          action:          'remediation',
          substrand:       prereqFlags[0]?.substrand,
          rationale:       `Address prerequisite gap in "${prereqFlags[0]?.substrand}" first — this unblocks downstream learning`,
          confidence:      0.9,
          expected_impact: 'Removes the foundational blocker, enabling current-grade content access',
        },
        {
          action:          'notify_teacher',
          rationale:       'Teacher should be aware of prerequisite gap to adapt lesson sequencing',
          confidence:      0.85,
          expected_impact: 'Teacher adjusts pace and starts with prerequisite revision',
        },
      ],
    )
  }

  // Check 2: Knowledge graph root causes
  if (focusRootCauses.length > 0) {
    const deepestCause = focusRootCauses
      .flatMap(r => r.root_causes)
      .filter(c => c.cause_type === 'root')
      .sort((a, b) => b.depth - a.depth)[0]

    if (deepestCause) {
      const subjectLabel = subject ?? focusRootCauses[0]?.subject ?? 'this subject'
      return conclude(
        `Why is the learner struggling in ${subjectLabel}?`,
        `Knowledge graph analysis identifies "${deepestCause.name}" (${deepestCause.strand}) as a root cause at depth ${deepestCause.depth}. This foundational concept was not mastered, causing cascading failures in ${focusRootCauses.flatMap(r => r.root_causes.filter(c => c.cause_type === 'surface').map(c => c.name)).slice(0, 3).join(', ') || 'subsequent topics'}.`,
        0.8,
        evidence,
        [
          {
            action:          'remediation',
            subject:         focusRootCauses[0]?.subject,
            substrand:       deepestCause.name,
            rationale:       `Teach "${deepestCause.name}" from scratch — it is blocking multiple downstream concepts`,
            confidence:      0.8,
            expected_impact: `Resolves root cause, enabling progress in ${focusRootCauses.length} currently failing topics`,
          },
        ],
      )
    }
  }

  // Check 3: Declining learning behaviour
  const behaviour = profile.learning_behaviour
  const decliningBehaviours = Object.entries(behaviour)
    .filter(([, m]) => m?.trend === 'declining' && (m?.score ?? 1) < 0.4)
    .map(([k]) => k)

  if (decliningBehaviours.length >= 2) {
    return conclude(
      'Why is the learner struggling?',
      `Learning behaviour signals show decline across ${decliningBehaviours.map(b => b.replace(/_/g, ' ')).join(' and ')}. The learner may be experiencing demotivation, confidence issues, or external challenges — not purely an academic gap.`,
      0.7,
      evidence,
      [
        {
          action:          'confidence_activity',
          rationale:       'Start with topics where the learner has previously succeeded to rebuild confidence',
          confidence:      0.7,
          expected_impact: 'Restores intrinsic motivation, improving engagement and subsequent performance',
        },
        {
          action:          'notify_parent',
          rationale:       'Parent should be aware of engagement decline to check for home-side factors',
          confidence:      0.65,
          expected_impact: 'Home-school alignment to address root cause',
        },
      ],
    )
  }

  // Check 4: Multiple weak substrands without clear root cause
  const weakSubstrands = profile.confirmed_gaps.length
  if (weakSubstrands >= 3) {
    return conclude(
      'Why is the learner struggling?',
      `The learner has ${weakSubstrands} confirmed gaps across multiple substrands, suggesting a broad comprehension challenge rather than a single topic gap. This may indicate curriculum-level pace mismatch.`,
      0.65,
      evidence,
      [
        {
          action:          'review_topic',
          rationale:       `Start with the earliest-grade substrand in the confirmed gaps list: ${profile.confirmed_gaps[0]}`,
          confidence:      0.65,
          expected_impact: 'Systematic review from earliest gap may resolve cascading misunderstandings',
        },
        {
          action:          'notify_teacher',
          rationale:       'Teacher awareness needed for individualised pace adjustment',
          confidence:      0.7,
          expected_impact: 'Targeted support reduces the breadth of the gap over time',
        },
      ],
    )
  }

  // Default: insufficient data
  return conclude(
    'Why is the learner struggling?',
    'Insufficient data to determine root cause. More assessments and Compass sessions are needed to build a reliable learner model.',
    0.3,
    evidence,
    [
      {
        action:          'practice_questions',
        rationale:       'Compass diagnostic session will help build the learner model',
        confidence:      0.5,
        expected_impact: 'Generates the evidence needed for confident root cause analysis',
      },
    ],
  )
}

export async function isLearnerImproving(
  studentId: string,
): Promise<ReasoningResult> {
  const profile  = await getOrCreateLearnerProfile(studentId)
  const evidence = buildEvidence(profile, [])

  // Check risk trend
  const riskHistory = profile.risk_history
  const recentResolved = riskHistory.filter(r => r.resolved_at).length
  const recentPersistent = riskHistory.filter(r => !r.resolved_at && (r.consecutive_weeks ?? 0) >= 4).length

  // Check capability trends
  const dims  = profile.capability_dimensions as Record<string, { trend?: string }>
  const improving = Object.values(dims).filter(d => d?.trend === 'improving' || d?.trend === 'accelerating').length
  const declining = Object.values(dims).filter(d => d?.trend === 'declining').length

  // Check growth milestones this term
  const currentYear  = new Date().getFullYear()
  const currentTerm  = getCurrentTerm()
  const termMilestones = profile.growth_milestones.filter(
    m => m.achieved_at.startsWith(String(currentYear))
  )

  if (improving > declining && recentResolved > 0) {
    return conclude(
      'Is the learner improving?',
      `Yes — ${improving} capability dimensions are trending upward, and ${recentResolved} risk flags have been resolved. Growth milestones this term: ${termMilestones.length}. The learner is on a positive trajectory.`,
      0.85,
      evidence,
      [
        {
          action:          'acceleration',
          rationale:       'Learner is improving — challenge them with above-grade-level content to maintain momentum',
          confidence:      0.75,
          expected_impact: 'Sustained improvement and higher ceiling achievement',
        },
      ],
    )
  }

  if (declining > improving && recentPersistent >= 1) {
    return conclude(
      'Is the learner improving?',
      `No — ${declining} capability dimensions are declining and ${recentPersistent} risk flags have persisted for 4+ weeks. The learner needs active intervention.`,
      0.85,
      evidence,
      [
        {
          action:          'notify_teacher',
          rationale:       'Persistent decline warrants urgent teacher intervention',
          confidence:      0.9,
          expected_impact: 'Early teacher action can reverse the decline trajectory',
        },
        {
          action:          'remediation',
          rationale:       'Systematic remediation of the oldest confirmed gap',
          confidence:      0.8,
          expected_impact: 'Addresses root cause of the declining trend',
        },
      ],
    )
  }

  return conclude(
    'Is the learner improving?',
    'Mixed signals — some areas improving, others stable or declining. No clear trend yet.',
    0.55,
    evidence,
    [],
  )
}

export async function whichInterventionIsLikelyToWork(
  studentId: string,
  grade:     number,
): Promise<ReasoningResult> {
  const [profile, rootCauses] = await Promise.all([
    getOrCreateLearnerProfile(studentId),
    safeRootCauses(studentId, grade),
  ])

  const evidence  = buildEvidence(profile, rootCauses)
  const riskLevel = profile.overall_risk_level
  const behaviour = profile.learning_behaviour

  // Match intervention to root cause code
  const prereqGaps   = profile.risk_flags.filter(f => f.type === 'missing_prerequisite')
  const disengaged   = profile.risk_flags.find(f => f.type === 'disengaged')
  const decliningPerf = profile.risk_flags.find(f => f.type === 'declining_performance')

  const actions: ActionRecommendation[] = []

  if (prereqGaps.length > 0) {
    actions.push({
      action:          'remediation',
      substrand:       prereqGaps[0]?.substrand,
      rationale:       'Prerequisite gap identified — targeted Compass remediation most effective',
      confidence:      0.9,
      expected_impact: 'Resolves foundational blocker within 2–4 sessions',
    })
  }

  if (disengaged) {
    const helpSeekingScore = behaviour.help_seeking?.score ?? 0.5
    if (helpSeekingScore < 0.4) {
      // Low intrinsic motivation — teacher/parent nudge most effective
      actions.push({
        action:          'notify_teacher',
        rationale:       'Disengaged + low help-seeking: external prompt needed',
        confidence:      0.8,
        expected_impact: 'Teacher check-in within 1–2 days can re-engage the learner',
      })
    } else {
      // Higher intrinsic motivation — self-directed activity could work
      actions.push({
        action:          'career_exploration',
        rationale:       'Disengaged but previously self-directed: career relevance reframes motivation',
        confidence:      0.7,
        expected_impact: 'Connects academic content to career interest, restoring engagement',
      })
    }
  }

  if (decliningPerf) {
    const persistenceScore = behaviour.persistence?.score ?? 0.5
    if (persistenceScore < 0.4) {
      actions.push({
        action:          'confidence_activity',
        rationale:       'Declining performance + low persistence: start with wins to rebuild belief',
        confidence:      0.75,
        expected_impact: 'Re-establishes growth mindset and willingness to attempt difficult tasks',
      })
    } else {
      actions.push({
        action:          'peer_discussion',
        rationale:       'High persistence but declining performance: peer learning can provide fresh explanation',
        confidence:      0.7,
        expected_impact: 'Alternative explanation from a peer often resolves concept confusion',
      })
    }
  }

  if (actions.length === 0) {
    actions.push({
      action:          'practice_questions',
      rationale:       'No specific flag pattern — diagnostic practice questions build the evidence base',
      confidence:      0.5,
      expected_impact: 'Generates data for more targeted recommendation',
    })
  }

  return conclude(
    'Which intervention is most likely to work?',
    `Based on ${profile.risk_flags.length} active flags (risk level: ${riskLevel}) and behaviour profile, the recommended intervention is: ${actions[0]?.rationale ?? 'no specific intervention identified'}.`,
    actions[0]?.confidence ?? 0.5,
    evidence,
    actions.sort((a, b) => b.confidence - a.confidence),
  )
}

export async function shouldTeacherIntervene(
  studentId: string,
): Promise<ReasoningResult> {
  const profile  = await getOrCreateLearnerProfile(studentId)
  const evidence = buildEvidence(profile, [])

  const riskLevel      = profile.overall_risk_level
  const highFlags      = profile.risk_flags.filter(f => f.severity === 'high')
  const persistentRisk = profile.risk_history.filter(r => !r.resolved_at && (r.consecutive_weeks ?? 0) >= 3)

  if (riskLevel === 'critical' || highFlags.length >= 2) {
    return conclude(
      'Should the teacher intervene?',
      `Yes — immediately. Risk level is ${riskLevel} with ${highFlags.length} high-severity flags. Waiting will increase the severity gap.`,
      0.95,
      evidence,
      [
        { action: 'notify_teacher', rationale: 'Critical risk requires immediate teacher attention', confidence: 0.95, expected_impact: 'Early intervention at critical stage has 3× better outcome than delayed' },
      ],
    )
  }

  if (persistentRisk.length > 0) {
    return conclude(
      'Should the teacher intervene?',
      `Yes — ${persistentRisk.length} risk flag(s) have persisted for 3+ weeks without resolution. Automated systems have not resolved this; teacher action is needed.`,
      0.85,
      evidence,
      [
        { action: 'notify_teacher', rationale: 'Persistent risk requires human judgment — automated systems have reached their limit', confidence: 0.85, expected_impact: 'Teacher can identify root cause that automated systems cannot detect' },
      ],
    )
  }

  if (riskLevel === 'at_risk') {
    return conclude(
      'Should the teacher intervene?',
      'Monitor for now — risk level is "at risk" but flags are recent (< 3 weeks). Assign Compass session first; reassess if no improvement.',
      0.65,
      evidence,
      [
        { action: 'practice_questions', rationale: 'Try Compass intervention first before escalating to teacher', confidence: 0.65, expected_impact: 'Self-directed resolution is faster and less disruptive if risk is recent' },
      ],
    )
  }

  return conclude(
    'Should the teacher intervene?',
    'No immediate teacher intervention needed. Risk level is normal or watch — continue monitoring.',
    0.8,
    evidence,
    [],
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function conclude(
  question:   string,
  conclusion: string,
  confidence: number,
  evidence:   ReasoningEvidence,
  actions:    ActionRecommendation[],
): ReasoningResult {
  return { question, conclusion, confidence, evidence, actions }
}

function buildEvidence(
  profile:    LearnerProfile,
  rootCauses: RootCauseResult[],
): ReasoningEvidence {
  return {
    learner_model: {
      risk_level:       profile.overall_risk_level,
      risk_flags:       profile.risk_flags,
      confirmed_gaps:   profile.confirmed_gaps,
      persistent_gaps:  profile.persistent_gaps,
      assessment_count: Object.values(profile.knowledge_state).reduce((s, m) => s + m.assessment_count, 0),
    },
    knowledge_graph: rootCauses,
    career_profile: {
      top_career:   profile.career_signals?.top_career_slugs?.[0] ?? null,
      pathway_stem: profile.pathway_readiness?.stem?.score ?? 0,
    },
    behaviour: profile.learning_behaviour as unknown as Record<string, unknown>,
    risk_history: profile.risk_history as unknown as Record<string, unknown>[],
  }
}

async function safeRootCauses(studentId: string, grade: number): Promise<RootCauseResult[]> {
  try {
    return await analyseStudentRootCauses(studentId, grade)
  } catch (e: unknown) {
    console.error('[reasoningEngine:safeRootCauses]', e instanceof Error ? e.message : String(e))
    return []
  }
}

function getCurrentTerm(): number {
  const month = new Date().getMonth()
  if (month < 4) return 1
  if (month < 8) return 2
  return 3
}
