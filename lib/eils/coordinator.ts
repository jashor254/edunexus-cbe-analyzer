// lib/eils/coordinator.ts
// Layer 9 — AI Coordination Layer
//
// EILS acts as the decision engine behind every AI system in EduNexus.
// Before any AI generates content, it should ask EILS for context.
//
// This prevents:
//   - Lesson plan generators ignoring that a student is missing a prerequisite
//   - Tutors teaching advanced content to a learner who needs foundational support
//   - Career explorer showing careers incompatible with the student's actual readiness
//   - Assessment generators ignoring class-wide misconceptions
//
// Usage:
//   const ctx = await getContextForTutor(studentId, topic, subject)
//   // Now inject ctx.context_note into the AI system prompt
//
// EILS is the conductor. The AI systems are the orchestra.

import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { buildLightweightSnapshot } from './profile'
import type { EILSCoordinationContext, LearningStyleHint, TeachingApproach } from './types'
import type { LearnerProfile } from '@/lib/learnerModel/types'

// ── Tutor / Compass context ───────────────────────────────────────────────────
// Called before generating a Compass question or AI tutor response.

export async function getContextForTutor(
  studentId: string,
  topic:     string,
  subject:   string,
  grade:     number,
): Promise<EILSCoordinationContext> {
  const profile = await getOrCreateLearnerProfile(studentId)
  return buildCoordinationContext(profile, grade, topic, subject)
}

// ── Lesson Plan context ────────────────────────────────────────────────────────
// Called before generating a lesson plan for a class.
// Aggregates across the class — returns the most common gaps.

export async function getContextForLessonPlan(
  classProfiles: LearnerProfile[],
  grade:         number,
  subject:       string,
): Promise<EILSCoordinationContext> {
  if (classProfiles.length === 0) {
    return buildEmptyContext(grade)
  }

  // Find the modal risk level and most common gaps across the class
  const allConfirmedGaps = classProfiles.flatMap(p =>
    p.confirmed_gaps.filter(g => g.startsWith(subject + ':'))
  )
  const gapFreq  = countFreq(allConfirmedGaps)
  const topGaps  = [...gapFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)
    .slice(0, 3)

  const prereqFlags = classProfiles.flatMap(p =>
    p.risk_flags.filter(f => f.type === 'missing_prerequisite' && f.subject === subject)
  )
  const prereqFreq = countFreq(prereqFlags.map(f => f.substrand ?? 'unknown'))
  const topPrereqs = [...prereqFreq.entries()]
    .filter(([, count]) => count >= Math.ceil(classProfiles.length * 0.2))  // 20% threshold
    .map(([p]) => p)
    .slice(0, 3)

  // Representative profile: most-at-risk student
  const riskOrder = { normal: 0, watch: 1, at_risk: 2, critical: 3 }
  const repProfile = classProfiles.sort(
    (a, b) => riskOrder[b.overall_risk_level] - riskOrder[a.overall_risk_level]
  )[0]

  const ctx = buildCoordinationContext(repProfile, grade, subject, subject)

  return {
    ...ctx,
    confirmed_gaps:      topGaps,
    prerequisite_gaps:   topPrereqs,
    context_note:        buildLessonPlanContextNote(subject, topGaps, topPrereqs, classProfiles.length),
  }
}

// ── Assessment Generator context ──────────────────────────────────────────────
// Called before generating assessment questions for a class.
// Focus areas = the weakest substrands across the class.

export async function getContextForAssessmentGenerator(
  classProfiles: LearnerProfile[],
  grade:         number,
  subject:       string,
): Promise<{ focus_substrands: string[]; avoid_substrands: string[]; context_note: string }> {
  const allKnowledge = classProfiles.flatMap(p =>
    Object.entries(p.knowledge_state)
      .filter(([k]) => k.startsWith(subject + ':'))
      .map(([k, m]) => ({ substrand: k.split(':')[1] ?? '', level: m.level }))
  )

  const bySubstrand = new Map<string, number[]>()
  for (const { substrand, level } of allKnowledge) {
    if (!bySubstrand.has(substrand)) bySubstrand.set(substrand, [])
    bySubstrand.get(substrand)!.push(level)
  }

  const substrandAvgs = [...bySubstrand.entries()]
    .map(([sub, levels]) => ({
      substrand: sub,
      avg: levels.reduce((a, b) => a + b, 0) / levels.length,
    }))
    .sort((a, b) => a.avg - b.avg)

  const focus  = substrandAvgs.filter(s => s.avg < 2.5).map(s => s.substrand).slice(0, 5)
  const strong = substrandAvgs.filter(s => s.avg >= 3.5).map(s => s.substrand).slice(0, 3)

  return {
    focus_substrands: focus,
    avoid_substrands: strong,  // don't over-test what they already know
    context_note:     focus.length > 0
      ? `Assessment focus: class is weakest in ${focus.slice(0, 3).map(s => s.replace(/_/g, ' ')).join(', ')}. Include diagnostic questions on these. ${strong.length > 0 ? `Class is strong in ${strong[0]?.replace(/_/g, ' ')} — include as confidence anchor.` : ''}`
      : `Class shows broad mastery — balance assessment across all ${subject.replace(/_/g, ' ')} substrands.`,
  }
}

// ── Career Explorer context ────────────────────────────────────────────────────
// Called before showing career recommendations to a student.

export async function getContextForCareerExplorer(
  studentId: string,
  grade:     number,
): Promise<{
  top_pathway:       string | null
  pathway_score:     number
  readiness_warning: string | null
  strengths:         string[]
  gaps_to_address:   string[]
  context_note:      string
}> {
  const profile  = await getOrCreateLearnerProfile(studentId)
  const r        = profile.pathway_readiness
  const pathways = [
    { name: 'STEM',            score: r.stem.score,            trend: r.stem.trend },
    { name: 'Social Sciences', score: r.social_sciences.score, trend: r.social_sciences.trend },
    { name: 'Arts & Sports',   score: r.arts_sports.score,     trend: r.arts_sports.trend },
    { name: 'Technical/TVET',  score: r.technical_tvet.score,  trend: r.technical_tvet.trend },
  ].sort((a, b) => b.score - a.score)

  const top        = pathways[0]
  const strengths  = profile.career_signals?.strongest_subjects ?? []
  const gaps       = profile.confirmed_gaps.slice(0, 3).map(g => g.split(':')[1] ?? g)

  const readinessWarning = top.score < 30
    ? `Student's pathway readiness is still developing (${top.score}%). Career exploration should focus on building foundational competencies rather than specific career planning.`
    : null

  return {
    top_pathway:       top.name,
    pathway_score:     top.score,
    readiness_warning: readinessWarning,
    strengths,
    gaps_to_address:   gaps,
    context_note:      buildCareerContextNote(top, profile),
  }
}

// ── Holiday Planner context ───────────────────────────────────────────────────
// Called before generating a holiday learning plan.

export async function getContextForHolidayPlanner(
  studentId: string,
  grade:     number,
): Promise<{
  priority_gaps:     string[]
  career_aligned_topics: string[]
  learning_style:    LearningStyleHint
  session_length_mins: number
  context_note:      string
}> {
  const profile = await getOrCreateLearnerProfile(studentId)
  const ctx     = buildCoordinationContext(profile, grade)

  // Priority gaps: persistent > confirmed > current weak
  const priorityGaps = [
    ...profile.persistent_gaps.slice(0, 2),
    ...profile.confirmed_gaps.filter(g => !profile.persistent_gaps.includes(g)).slice(0, 3),
  ]

  // Career-aligned topics: subjects relevant to top career
  const topCareer      = profile.career_signals?.top_career_slugs?.[0] ?? null
  const strongSubjects = profile.career_signals?.strongest_subjects ?? []
  const careerTopics   = topCareer ? strongSubjects.slice(0, 2) : []

  // Session length based on behaviour
  const velocityScore = profile.learning_behaviour?.velocity?.score ?? 0.5
  const sessionLength = velocityScore >= 0.7 ? 30 : velocityScore >= 0.4 ? 20 : 15

  return {
    priority_gaps:         priorityGaps,
    career_aligned_topics: careerTopics,
    learning_style:        ctx.learning_style,
    session_length_mins:   sessionLength,
    context_note:          buildHolidayContextNote(priorityGaps, careerTopics, ctx.learning_style),
  }
}

// ── Core builder ──────────────────────────────────────────────────────────────

function buildCoordinationContext(
  profile:  LearnerProfile,
  grade:    number,
  topic?:   string,
  subject?: string,
): EILSCoordinationContext {
  const learningStyle  = determineLearningStyle(profile)
  const approach       = determineApproach(profile, learningStyle)
  const confirmedGaps  = subject
    ? profile.confirmed_gaps.filter(g => g.startsWith(subject + ':'))
    : profile.confirmed_gaps.slice(0, 5)
  const prereqGaps     = profile.risk_flags
    .filter(f => f.type === 'missing_prerequisite')
    .map(f => f.substrand ?? '')
    .filter(Boolean)

  const strongEntries = Object.entries(profile.knowledge_state)
    .filter(([k, m]) => m.level >= 3 && (!subject || k.startsWith(subject + ':')))
    .map(([k]) => k.split(':')[1] ?? k)

  const weakEntries = Object.entries(profile.knowledge_state)
    .filter(([k, m]) => m.level <= 2 && (!subject || k.startsWith(subject + ':')))
    .map(([k]) => k.split(':')[1] ?? k)

  const topCareer  = profile.career_signals?.top_career_slugs?.[0]
  const r          = profile.pathway_readiness
  const topPathway = [
    { name: 'STEM',            score: r.stem.score },
    { name: 'Social Sciences', score: r.social_sciences.score },
    { name: 'Arts & Sports',   score: r.arts_sports.score },
    { name: 'Technical/TVET',  score: r.technical_tvet.score },
  ].sort((a, b) => b.score - a.score)[0]

  return {
    student_id:              profile.student_id,
    grade,
    risk_level:              profile.overall_risk_level,
    confirmed_gaps:          confirmedGaps,
    persistent_gaps:         profile.persistent_gaps,
    top_weak_substrands:     weakEntries.slice(0, 5),
    top_strong_substrands:   strongEntries.slice(0, 3),
    learning_style:          learningStyle,
    career_direction:        topCareer
      ? topCareer.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null,
    pathway:                 topPathway.score > 30 ? topPathway.name : null,
    recommended_approach:    approach,
    prerequisite_gaps:       prereqGaps,
    context_note:            buildContextNote(profile, learningStyle, approach, prereqGaps, weakEntries, topic, subject),
  }
}

// ── Learning Style Detection ──────────────────────────────────────────────────

function determineLearningStyle(profile: LearnerProfile): LearningStyleHint {
  const prereqGaps   = profile.risk_flags.filter(f => f.type === 'missing_prerequisite')
  const behaviour    = profile.learning_behaviour
  const riskLevel    = profile.overall_risk_level

  if (prereqGaps.length > 0) return 'needs_foundation_first'

  const dims = profile.capability_dimensions as Record<string, { trend?: string; raw_score?: number }>
  const allAccelerating = Object.values(dims).filter(d => d?.trend === 'accelerating' || d?.raw_score && d.raw_score >= 0.8).length >= 3
  if (allAccelerating && riskLevel === 'normal') return 'ready_for_challenge'

  if ((behaviour.confidence?.score ?? 1) < 0.4 || (behaviour.persistence?.score ?? 1) < 0.4) {
    return 'confidence_building'
  }

  if ((behaviour.velocity?.score ?? 1) < 0.3) return 'needs_variety'

  return 'standard'
}

// ── Teaching Approach ─────────────────────────────────────────────────────────

function determineApproach(
  profile: LearnerProfile,
  style:   LearningStyleHint,
): TeachingApproach {
  if (style === 'needs_foundation_first') return 'remediate_prerequisite'
  if (style === 'confidence_building')    return 'restore_confidence'
  if (style === 'ready_for_challenge')    return 'challenge_and_extend'
  if (profile.confirmed_gaps.length >= 2) return 'reinforce_concepts'
  return 'standard_progression'
}

// ── Context Note Builders ──────────────────────────────────────────────────────

function buildContextNote(
  profile:    LearnerProfile,
  style:      LearningStyleHint,
  approach:   TeachingApproach,
  prereqs:    string[],
  weakItems:  string[],
  topic?:     string,
  subject?:   string,
): string {
  const lines: string[] = []

  if (prereqs.length > 0) {
    lines.push(`PREREQUISITE WARNING: This learner is missing foundational concepts: ${prereqs.slice(0, 2).join(', ')}. Do NOT assume prior mastery of these topics.`)
  }

  if (approach === 'restore_confidence') {
    lines.push('CONFIDENCE ALERT: This learner is in a confidence dip. Start with concepts they have mastered before introducing new challenges.')
  }

  if (approach === 'challenge_and_extend') {
    lines.push('ACCELERATION NOTE: This learner is performing above grade level. Challenge them with extension material.')
  }

  if (weakItems.length > 0 && approach === 'reinforce_concepts') {
    lines.push(`REINFORCEMENT NEEDED: Focus on ${weakItems.slice(0, 2).map(w => w.replace(/_/g, ' ')).join(' and ')} — confirmed weak areas.`)
  }

  if (topic) {
    const topicKey = `${subject ?? ''}:${topic}`
    const topicMastery = profile.knowledge_state[topicKey]
    if (topicMastery && topicMastery.level <= 2) {
      lines.push(`TOPIC STATUS: The current topic "${topic}" is flagged as a weak area (Level ${topicMastery.level}/4). Pace explanation carefully and check understanding frequently.`)
    }
  }

  if (lines.length === 0) {
    lines.push(`Learner is ${profile.overall_risk_level === 'normal' ? 'on track' : 'at ' + profile.overall_risk_level + ' level'}. Standard curriculum progression is appropriate.`)
  }

  return lines.join(' | ')
}

function buildLessonPlanContextNote(
  subject:    string,
  topGaps:    string[],
  topPrereqs: string[],
  classSize:  number,
): string {
  const lines: string[] = []
  const subjectLabel = subject.replace(/_/g, ' ')

  if (topPrereqs.length > 0) {
    lines.push(`CLASS PREREQUISITE GAPS: ${topPrereqs.slice(0, 2).join(', ')} are missing for 20%+ of the class. Include a warm-up that briefly revisits these before the main lesson.`)
  }

  if (topGaps.length > 0) {
    const gapLabels = topGaps.slice(0, 2).map(g => g.split(':')[1] ?? g).map(g => g.replace(/_/g, ' '))
    lines.push(`FOCUS AREAS: Class is weakest in ${gapLabels.join(' and ')}. Design activities that specifically address these.`)
  }

  if (lines.length === 0) {
    lines.push(`Class of ${classSize} is performing well in ${subjectLabel}. Continue standard curriculum progression.`)
  }

  return lines.join(' | ')
}

function buildCareerContextNote(
  topPathway: { name: string; score: number; trend: string },
  profile:    LearnerProfile,
): string {
  const careersText = profile.career_signals?.top_career_slugs?.slice(0, 2)
    .map(c => c.replace(/-/g, ' ').replace(/\b\w/g, x => x.toUpperCase()))
    .join(' and ')

  if (topPathway.score < 30) {
    return 'Student is still building foundational competencies. Present a broad range of career options rather than specific recommendations.'
  }

  if (careersText) {
    return `Student shows interest in ${careersText} with ${topPathway.score}% ${topPathway.name} pathway readiness. Emphasise how current subjects directly relate to these career paths.`
  }

  return `Student has ${topPathway.score}% readiness in ${topPathway.name} pathway. Highlight career options in this area.`
}

function buildHolidayContextNote(
  gaps:         string[],
  careerTopics: string[],
  style:        LearningStyleHint,
): string {
  const lines: string[] = []

  if (style === 'needs_foundation_first') {
    lines.push('START WITH PREREQUISITES: Begin holiday plan with foundational concepts before introducing new topics.')
  }

  if (style === 'confidence_building') {
    lines.push('CONFIDENCE FIRST: Begin with topics the learner has previously succeeded in before tackling gaps.')
  }

  if (gaps.length > 0) {
    const gapLabels = gaps.slice(0, 2).map(g => g.split(':').pop()?.replace(/_/g, ' ') ?? g)
    lines.push(`PRIORITY GAPS: Focus holiday plan on ${gapLabels.join(' and ')} — these have been confirmed across multiple assessments.`)
  }

  if (careerTopics.length > 0) {
    lines.push(`CAREER ALIGNMENT: Weave in ${careerTopics.join(' and ')} content to reinforce career pathway interest.`)
  }

  return lines.join(' | ') || 'Standard holiday learning plan — balance revision with exploration.'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEmptyContext(grade: number): EILSCoordinationContext {
  return {
    student_id:              'class',
    grade,
    risk_level:              'normal',
    confirmed_gaps:          [],
    persistent_gaps:         [],
    top_weak_substrands:     [],
    top_strong_substrands:   [],
    learning_style:          'standard',
    career_direction:        null,
    pathway:                 null,
    recommended_approach:    'standard_progression',
    prerequisite_gaps:       [],
    context_note:            'No learner model data available — use standard curriculum progression.',
  }
}

function countFreq<T>(arr: T[]): Map<T, number> {
  const map = new Map<T, number>()
  for (const item of arr) map.set(item, (map.get(item) ?? 0) + 1)
  return map
}
