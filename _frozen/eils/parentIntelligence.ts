// lib/eils/parentIntelligence.ts
// Layer 7 — Parent Intelligence
//
// Generates meaningful parent insights — not scores, but narrative.
//
// Every weekly parent insight answers:
//   - What changed this week (and since last time you heard from us)
//   - Why it changed (plain language cause)
//   - What YOU can do at home (specific, actionable activities)
//   - What to celebrate (positive framing first)
//   - What concerns us (gentle, not alarmist)
//   - Career hint (connects child's learning to their future)

import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { buildCareerIntelligenceSummary } from './careerIntelligence'
import type { EILSParentInsight } from './types'

// ── Main: build parent insight ────────────────────────────────────────────────

export async function buildParentInsight(
  studentId:   string,
  studentName: string,
  weekOf?:     string,
): Promise<EILSParentInsight> {
  const now     = weekOf ?? new Date().toISOString().slice(0, 10)
  const profile = await getOrCreateLearnerProfile(studentId)

  const careerSummary = buildCareerIntelligenceSummary(studentId, profile)
  const firstName     = studentName.split(' ')[0]

  // ── What changed ──────────────────────────────────────────────────────────
  const whatChanged = buildWhatChanged(profile, firstName)

  // ── Why it changed ────────────────────────────────────────────────────────
  const whyItChanged = buildWhyItChanged(profile, firstName)

  // ── What parents can do ───────────────────────────────────────────────────
  const whatYouCanDo = buildHomeActivities(profile, firstName)

  // ── Celebrations ──────────────────────────────────────────────────────────
  const celebrations = buildCelebrations(profile, firstName)

  // ── Concerns ──────────────────────────────────────────────────────────────
  const concerns = buildConcerns(profile, firstName)

  // ── Career hint ───────────────────────────────────────────────────────────
  const careerHint = buildCareerHint(careerSummary, firstName)

  return {
    student_id:      studentId,
    student_name:    studentName,
    week_of:         now,
    what_changed:    whatChanged,
    why_it_changed:  whyItChanged,
    what_you_can_do: whatYouCanDo,
    celebrations,
    concerns,
    career_hint:     careerHint,
    generated_at:    new Date().toISOString(),
  }
}

// ── What Changed ──────────────────────────────────────────────────────────────

function buildWhatChanged(profile: ReturnType<typeof profile_stub>, firstName: string): string {
  const riskLevel = profile.overall_risk_level

  // New milestones are the most positive "what changed"
  const newMilestones = profile.growth_milestones.filter(m => !m.notified)
  if (newMilestones.length > 0) {
    const top = newMilestones[0]
    if (top.type === 'capability_threshold') {
      return `${firstName}'s ${top.dimension?.replace(/_/g, ' ')} capability has grown from ${top.from_level} to ${top.to_level} — this is a real step forward.`
    }
    if (top.type === 'first_mastery') {
      return `${firstName} reached mastery level in ${top.substrand} for the first time — a concept they previously struggled with.`
    }
    if (top.type === 'pathway_readiness_cross') {
      return `${firstName}'s readiness for the ${top.pathway} pathway just crossed ${top.to_level} — an important milestone.`
    }
    if (top.type === 'risk_resolved') {
      return `${firstName} has moved out of the "at risk" zone — the concern we flagged previously has resolved.`
    }
  }

  // Risk changes
  if (riskLevel === 'normal') {
    const recentParentObs = profile.parent_observations?.filter(o => o.outcome === 'demonstrated') ?? []
    if (recentParentObs.length > 0) {
      return `${firstName} has been demonstrating strong understanding at home — we are seeing consistent progress this week.`
    }
    return `${firstName} is progressing well. No concerns this week — consistent performance across subjects.`
  }

  if (riskLevel === 'watch') {
    const topFlag = profile.risk_flags[0]
    return topFlag
      ? `We have noticed ${firstName} needs some support with ${topFlag.substrand ?? 'a topic'} in ${topFlag.subject ?? 'school'}. This is early — now is the best time to help.`
      : `${firstName} is doing well overall, but we are watching one area that could use some support.`
  }

  if (riskLevel === 'at_risk') {
    const topFlag = profile.risk_flags[0]
    return topFlag
      ? `${firstName} has been struggling with ${topFlag.substrand ?? 'some topics'} in ${topFlag.subject ?? 'school'}. This has been going on for a few weeks and we want to work together to help.`
      : `${firstName} is facing some academic challenges. We want to share what we are seeing and how you can help.`
  }

  return `${firstName} needs some focused support right now. We are seeing challenges across multiple areas and want to address them together.`
}

// ── Why It Changed ────────────────────────────────────────────────────────────

function buildWhyItChanged(profile: ReturnType<typeof profile_stub>, firstName: string): string {
  const flags = profile.risk_flags

  const prereqFlag = flags.find(f => f.type === 'missing_prerequisite')
  if (prereqFlag) {
    return `${firstName} is missing some foundational knowledge from earlier — specifically around "${prereqFlag.substrand ?? 'a key concept'}". This makes new topics harder because the building blocks are not fully in place yet. This is very common and completely fixable with the right support.`
  }

  const disengaged = flags.find(f => f.type === 'disengaged')
  if (disengaged) {
    return `${firstName} has not been as active in learning this week — ${disengaged.detail}. Sometimes this is normal, but it can also signal that something needs attention at home or school.`
  }

  const behaviour = profile.learning_behaviour
  if ((behaviour.confidence?.score ?? 1) < 0.4) {
    return `We are noticing that ${firstName}'s confidence in answering questions has dipped. This happens when a learner feels unsure about their progress. Encouragement from you at home makes a big difference.`
  }

  const newMilestones = profile.growth_milestones.filter(m => !m.notified)
  if (newMilestones.length > 0) {
    return `${firstName} has been putting in consistent effort — and that effort is showing up in their results. Progress comes from practice, and they are doing the work.`
  }

  return `${firstName}'s performance reflects their engagement and the support they have been receiving. We will continue to monitor and share updates.`
}

// ── Home Activities ───────────────────────────────────────────────────────────

function buildHomeActivities(profile: ReturnType<typeof profile_stub>, firstName: string): string[] {
  const activities: string[] = []
  const firstName_ = firstName

  // From confirmed gaps — specific home practice
  for (const gap of profile.confirmed_gaps.slice(0, 2)) {
    const [subject, substrand] = gap.split(':')
    if (!substrand) continue

    const subjectLabel = subject?.replace(/_/g, ' ') ?? 'this subject'
    activities.push(`Practice ${substrand.replace(/_/g, ' ')} in ${subjectLabel} for 10–15 minutes a day — ask ${firstName_} to explain it to you in their own words.`)
  }

  // Engagement tip
  const lastActive = (profile.engagement_patterns as { last_active?: string })?.last_active
  if (lastActive) {
    const daysSince = daysBetween(lastActive, new Date().toISOString())
    if (daysSince > 7) {
      activities.push(`Encourage ${firstName_} to spend 20 minutes on their Compass learning app today — consistency matters more than duration.`)
    }
  }

  // If positive trajectory — encourage career exploration
  if (profile.overall_risk_level === 'normal') {
    const topCareer = profile.career_signals?.top_career_slugs?.[0]
    if (topCareer) {
      const title = topCareer.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      activities.push(`Talk to ${firstName_} about ${title} — ask what excites them about this career. Connecting school to their future is powerful motivation.`)
    }
  }

  // Parent observation request
  activities.push(`After ${firstName_}'s study session, ask: "What was one thing you understood well today and one thing you are not sure about yet?" Share what you hear with us.`)

  if (activities.length === 0) {
    activities.push(`Read with ${firstName_} for 15 minutes — comprehension skills help in every subject.`)
  }

  return activities.slice(0, 4)
}

// ── Celebrations ──────────────────────────────────────────────────────────────

function buildCelebrations(profile: ReturnType<typeof profile_stub>, firstName: string): string[] {
  const celebrations: string[] = []

  // Unnotified growth milestones
  const milestones = profile.growth_milestones.filter(m => !m.notified)
  for (const milestone of milestones.slice(0, 2)) {
    if (milestone.type === 'first_mastery') {
      celebrations.push(`${firstName} has achieved mastery in ${milestone.substrand ?? 'a topic'} for the first time — this was a previous challenge. Celebrate this!`)
    } else if (milestone.type === 'capability_threshold') {
      celebrations.push(`${firstName}'s ${milestone.dimension?.replace(/_/g, ' ') ?? 'learning ability'} has grown — they moved from ${milestone.from_level} to ${milestone.to_level}.`)
    } else if (milestone.type === 'risk_resolved') {
      celebrations.push(`${firstName} turned things around! They were in a difficult patch but have worked through it.`)
    } else if (milestone.type === 'pathway_readiness_cross') {
      celebrations.push(`${firstName}'s readiness for the ${milestone.pathway} pathway just crossed a new threshold — great progress!`)
    }
  }

  // Consistent engagement
  const sessions = (profile.engagement_patterns as { sessions_last_30_days?: number })?.sessions_last_30_days ?? 0
  if (sessions >= 10) {
    celebrations.push(`${firstName} has been learning consistently — ${sessions} Compass sessions in the last 30 days. That discipline is building real knowledge.`)
  }

  // High-mastery substrands
  const excellingTopics = Object.entries(profile.knowledge_state)
    .filter(([, m]) => m.level === 4)
    .map(([k]) => k.split(':')[1])
    .filter(Boolean)
    .slice(0, 2)

  if (excellingTopics.length > 0) {
    celebrations.push(`${firstName} is excelling in ${excellingTopics.join(' and ')} — Exceeding Expectations level.`)
  }

  return celebrations.slice(0, 3)
}

// ── Concerns ─────────────────────────────────────────────────────────────────

function buildConcerns(profile: ReturnType<typeof profile_stub>, firstName: string): string[] {
  const concerns: string[] = []
  const flags = profile.risk_flags

  const persistentFlags = profile.risk_history.filter(
    r => !r.resolved_at && (r.consecutive_weeks ?? 0) >= 3
  )

  if (persistentFlags.length > 0) {
    const oldest = persistentFlags[0]
    concerns.push(`${firstName} has been struggling with ${oldest.substrand ?? oldest.flag_type.replace(/_/g, ' ')} for ${oldest.consecutive_weeks} week(s). We want to work together to resolve this.`)
  }

  const prereq = flags.find(f => f.type === 'missing_prerequisite')
  if (prereq && !persistentFlags.find(p => p.flag_type === 'missing_prerequisite')) {
    concerns.push(`We have identified a gap in "${prereq.substrand ?? 'a foundational concept'}" that may be making new topics harder for ${firstName}. Addressing this early will help significantly.`)
  }

  const disengaged = flags.find(f => f.type === 'disengaged' && f.severity !== 'low')
  if (disengaged) {
    concerns.push(`${firstName}'s learning activity has been lower than usual recently. Please encourage regular study sessions at home — even 20 minutes a day helps.`)
  }

  return concerns.slice(0, 2)
}

// ── Career Hint ───────────────────────────────────────────────────────────────

function buildCareerHint(
  careerSummary: ReturnType<typeof buildCareerIntelligenceSummary>,
  firstName:     string,
): string | undefined {
  if (!careerSummary.top_career && careerSummary.pathway_score < 30) return undefined

  if (careerSummary.top_career) {
    return `Did you know? ${firstName}'s subject performance aligns strongly with a future in ${careerSummary.top_career}. This career typically requires strong ${careerSummary.top_pathway ?? 'academic'} skills — exactly what ${firstName} is building.`
  }

  if (careerSummary.top_pathway) {
    return `${firstName} shows natural strength in ${careerSummary.top_pathway} subjects — this opens doors to many exciting career pathways. Talk with them about what kind of work excites them.`
  }

  return undefined
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// TypeScript helper to avoid importing full LearnerProfile type in return annotations
function profile_stub() { return {} as import('@/lib/learnerModel/types').LearnerProfile }

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}
