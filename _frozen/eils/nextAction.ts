// lib/eils/nextAction.ts
// Layer 3 — Next Best Learning Action
//
// After every interaction: "What should happen next?"
//
// Arbitrates across all EduNexus systems to produce a single prioritised list:
//   - Does not duplicate: if Compass already covers gap X, don't also recommend it via holiday plan
//   - Does not conflict: one system's recommendation supersedes another's where appropriate
//   - Every recommendation is explainable with evidence, confidence, and expected impact
//
// Writes to eils_recommendations table. Supersedes stale recommendations.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { afterRecommendationCreated } from '@/lib/eir/engine'
import type { LearnerProfile, RiskFlag } from '@/lib/learnerModel/types'
import type { EILSRecommendation, ActionType, RecommendationEvidence } from './types'

// ── Main: compute next best actions for a learner ─────────────────────────────

export async function computeNextBestActions(
  studentId: string,
  trigger:   'assessment' | 'compass' | 'formative' | 'parent' | 'periodic' | 'risk_change',
): Promise<EILSRecommendation[]> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)

  const candidates = buildCandidates(profile, trigger)
  const deduped    = deduplicateAndPrioritise(candidates, profile)

  // Supersede existing pending recommendations
  await db
    .from('eils_recommendations')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('status', 'pending')

  if (deduped.length === 0) return []

  const now    = new Date().toISOString()
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const rows = deduped.map((c, i) => ({
    student_id:      studentId,
    action_type:     c.action_type,
    priority:        (i + 1) * 10,   // 10, 20, 30, ...
    confidence:      c.confidence,
    reasoning:       c.reasoning,
    evidence:        c.evidence as Record<string, unknown>,
    expected_impact: c.expected_impact,
    subject:         c.subject ?? null,
    substrand:       c.substrand ?? null,
    source_system:   c.source_system,
    status:          'pending',
    expires_at:      expiry,
    created_at:      now,
    updated_at:      now,
  }))

  const { data } = await db
    .from('eils_recommendations')
    .insert(rows)
    .select('id, student_id, action_type, priority, confidence, reasoning, evidence, expected_impact, subject, substrand, source_system, status, actioned_at, outcome, outcome_note, expires_at, created_at, updated_at')

  const recommendations = (data ?? []) as EILSRecommendation[]

  // EIR: generate explainability record for each new recommendation
  for (const rec of recommendations) {
    void afterRecommendationCreated(rec).catch(() => {})
  }

  return recommendations
}

// ── Candidate builders ────────────────────────────────────────────────────────

type Candidate = {
  action_type:     ActionType
  priority:        number
  confidence:      number
  reasoning:       string
  evidence:        RecommendationEvidence
  expected_impact: string
  subject?:        string
  substrand?:      string
  source_system:   string
  dedup_key:       string   // prevents duplicate recommendations
}

function buildCandidates(
  profile: LearnerProfile,
  trigger: string,
): Candidate[] {
  const candidates: Candidate[] = []

  const riskLevel  = profile.overall_risk_level
  const riskFlags  = profile.risk_flags
  const riskOrder  = { normal: 0, watch: 1, at_risk: 2, critical: 3 }

  // ── Critical risk → immediate teacher notification ──────────────────────────
  if (riskLevel === 'critical') {
    candidates.push({
      action_type:     'notify_teacher',
      priority:        1,
      confidence:      0.95,
      reasoning:       `Learner is at CRITICAL risk with ${riskFlags.filter(f => f.severity === 'high').length} high-severity flags. Immediate teacher notification required.`,
      evidence:        { risk_flags: riskFlags },
      expected_impact: 'Teacher intervention within 24 hours can prevent further academic decline',
      source_system:   'eils.riskEngine',
      dedup_key:       'notify_teacher:critical',
    })
  }

  // ── At-risk → teacher notification + remediation ────────────────────────────
  if (riskOrder[riskLevel] >= riskOrder['at_risk']) {
    const highFlags = riskFlags.filter(f => f.severity === 'high')
    if (highFlags.length > 0) {
      const primaryFlag = highFlags[0]
      candidates.push({
        action_type:     'notify_teacher',
        priority:        2,
        confidence:      0.85,
        reasoning:       `${highFlags.length} high-severity risk flag(s) active: ${primaryFlag.detail}`,
        evidence:        { risk_flags: highFlags },
        expected_impact: 'Teacher becomes aware and can adjust instruction for this learner',
        source_system:   'eils.riskEngine',
        dedup_key:       `notify_teacher:at_risk:${primaryFlag.type}`,
      })
    }
  }

  // ── Missing prerequisite → targeted Compass remediation ─────────────────────
  const prereqFlags = riskFlags.filter(f => f.type === 'missing_prerequisite')
  for (const flag of prereqFlags.slice(0, 2)) {
    const substrand = flag.substrand ?? 'unknown'
    candidates.push({
      action_type:     'remediation',
      priority:        5,
      confidence:      0.9,
      reasoning:       `Missing prerequisite: "${substrand}". Learner cannot progress without first establishing this foundational concept.`,
      evidence:        { risk_flags: [flag], weak_substrands: [substrand] },
      expected_impact: `Establishes "${substrand}" as a foundation, unblocking multiple downstream topics`,
      subject:         flag.subject,
      substrand,
      source_system:   'eils.kgIntelligence',
      dedup_key:       `remediation:prereq:${substrand}`,
    })
  }

  // ── Confirmed gaps → review topic ───────────────────────────────────────────
  const confirmedGaps = profile.confirmed_gaps.slice(0, 3)
  for (const gap of confirmedGaps) {
    const [subject, substrand] = gap.split(':')
    if (!substrand) continue
    candidates.push({
      action_type:     'review_topic',
      priority:        15,
      confidence:      0.8,
      reasoning:       `Confirmed gap: "${substrand}" has been below ME in 2+ assessments. Needs targeted review.`,
      evidence:        { weak_substrands: [gap] },
      expected_impact: 'Reduces the confirmed gap count and improves overall knowledge state confidence',
      subject,
      substrand,
      source_system:   'eils.learnerModel',
      dedup_key:       `review_topic:${gap}`,
    })
  }

  // ── Disengagement → confidence activity ─────────────────────────────────────
  const disengaged = riskFlags.find(f => f.type === 'disengaged')
  if (disengaged) {
    const persistenceScore = profile.learning_behaviour?.persistence?.score ?? 0.5
    candidates.push({
      action_type:     persistenceScore < 0.4 ? 'confidence_activity' : 'practice_questions',
      priority:        8,
      confidence:      0.75,
      reasoning:       `Learner has been disengaged: ${disengaged.detail}. ${persistenceScore < 0.4 ? 'Start with easy wins to rebuild confidence.' : 'Resume Compass with a familiar topic.'}`,
      evidence:        { risk_flags: [disengaged], behaviour_signals: [`persistence: ${persistenceScore}`] },
      expected_impact: 'Re-engages the learner and restores learning consistency',
      source_system:   'eils.behaviourEngine',
      dedup_key:       'engagement:restore',
    })
  }

  // ── Declining performance → practice ────────────────────────────────────────
  const decliningPerf = riskFlags.find(f => f.type === 'declining_performance')
  if (decliningPerf) {
    candidates.push({
      action_type:     'practice_questions',
      priority:        12,
      confidence:      0.7,
      reasoning:       `Declining performance trend detected: ${decliningPerf.detail}. Practice questions help identify where understanding breaks down.`,
      evidence:        { risk_flags: [decliningPerf] },
      expected_impact: 'Diagnostic data from practice will guide the most effective next intervention',
      source_system:   'eils.behaviourEngine',
      dedup_key:       'practice:declining_perf',
    })
  }

  // ── Career pathway recommendation ────────────────────────────────────────────
  const topCareer     = profile.career_signals?.top_career_slugs?.[0]
  const pathwayReady  = getHighestPathwayScore(profile)
  if (topCareer && pathwayReady.score >= 60) {
    candidates.push({
      action_type:     'career_exploration',
      priority:        30,
      confidence:      0.7,
      reasoning:       `Learner shows ${pathwayReady.score}% readiness for ${pathwayReady.pathway} pathway with interest in ${topCareer}. Reinforce with career exploration.`,
      evidence:        { career_signals: [topCareer] },
      expected_impact: 'Career direction reinforces academic motivation and provides pathway clarity',
      source_system:   'eils.careerIntelligence',
      dedup_key:       `career:${topCareer}`,
    })
  }

  // ── Positive trigger → parent notification of progress ──────────────────────
  if (trigger === 'assessment' && profile.overall_risk_level === 'normal') {
    const milestones = profile.growth_milestones.filter(m => !m.notified)
    if (milestones.length > 0) {
      candidates.push({
        action_type:     'notify_parent',
        priority:        25,
        confidence:      0.9,
        reasoning:       `${milestones.length} unnotified growth milestone(s) available — parent deserves to know about their child's progress.`,
        evidence:        {},
        expected_impact: 'Parent celebration of achievement reinforces learner motivation',
        source_system:   'eils.milestoneEngine',
        dedup_key:       'notify_parent:milestone',
      })
    }
  }

  // ── Watch → parent observation request ──────────────────────────────────────
  if (riskLevel === 'watch' && trigger === 'periodic') {
    const lastParentObs  = profile.parent_observations?.[0]
    const daysSinceObs   = lastParentObs
      ? daysBetween(lastParentObs.recorded_at, new Date().toISOString())
      : 999
    if (daysSinceObs > 14) {
      candidates.push({
        action_type:     'notify_parent',
        priority:        20,
        confidence:      0.65,
        reasoning:       `No parent observation in ${Math.round(daysSinceObs)} days. Parent input would strengthen the learner model.`,
        evidence:        { parent_signals: ['14+ days without observation'] },
        expected_impact: 'Parent observation adds a cross-source signal that improves confidence in knowledge state',
        source_system:   'eils.parentIntelligence',
        dedup_key:       'notify_parent:obs_request',
      })
    }
  }

  // ── Persistent gaps → peer discussion ───────────────────────────────────────
  if (profile.persistent_gaps.length >= 2) {
    candidates.push({
      action_type:     'peer_discussion',
      priority:        35,
      confidence:      0.6,
      reasoning:       `${profile.persistent_gaps.length} gaps have persisted across 2+ terms. Peer learning offers a different explanation angle.`,
      evidence:        { weak_substrands: profile.persistent_gaps },
      expected_impact: 'Alternative explanation through peer teaching often resolves stubborn misconceptions',
      source_system:   'eils.learnerModel',
      dedup_key:       'peer_discussion:persistent_gaps',
    })
  }

  return candidates
}

// ── Deduplication + prioritisation ───────────────────────────────────────────

function deduplicateAndPrioritise(
  candidates: Candidate[],
  _profile:   LearnerProfile,
): Candidate[] {
  const seen     = new Set<string>()
  const filtered = candidates.filter(c => {
    if (seen.has(c.dedup_key)) return false
    seen.add(c.dedup_key)
    return true
  })

  // Sort: priority (lower = more urgent), then confidence (higher = more reliable)
  return filtered
    .sort((a, b) => {
      const pDiff = a.priority - b.priority
      if (pDiff !== 0) return pDiff
      return b.confidence - a.confidence
    })
    .slice(0, 8)  // max 8 recommendations at a time
}

// ── Mark a recommendation as actioned ────────────────────────────────────────

export async function markRecommendationActioned(
  recommendationId: string,
  outcome?:         'effective' | 'ineffective' | 'partial',
  outcomeNote?:     string,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eils_recommendations')
    .update({
      status:      outcome ? 'actioned' : 'actioned',
      actioned_at: now,
      outcome:     outcome ?? null,
      outcome_note: outcomeNote ?? null,
      updated_at:  now,
    })
    .eq('id', recommendationId)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHighestPathwayScore(
  profile: LearnerProfile,
): { pathway: string; score: number } {
  const r = profile.pathway_readiness
  const options = [
    { pathway: 'STEM',            score: r.stem.score },
    { pathway: 'Social Sciences', score: r.social_sciences.score },
    { pathway: 'Arts & Sports',   score: r.arts_sports.score },
    { pathway: 'Technical/TVET',  score: r.technical_tvet.score },
  ]
  return options.sort((a, b) => b.score - a.score)[0]
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}
