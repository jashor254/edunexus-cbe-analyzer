// lib/eils/careerIntelligence.ts
// Layer 5 — Career Intelligence
//
// Wraps lib/career to add continuous update logic:
//   - After each assessment: re-score capability profile, re-rank career matches
//   - Track emerging interests from compass/learn behavior
//   - Generate career confidence delta ("you moved closer to Engineering this term")
//   - Detect career readiness surges worthy of milestone recording
//
// Does not duplicate career engine logic — delegates to lib/career.

import { createServiceClient } from '@/utils/supabase/service'
import { addGrowthMilestone } from '@/lib/learnerModel/queries'
import type { LearnerProfile } from '@/lib/learnerModel/types'

// ── Career Readiness Delta ────────────────────────────────────────────────────

export type CareerReadinessDelta = {
  career_slug:       string
  career_title:      string
  previous_score:    number
  current_score:     number
  delta:             number
  direction:         'improving' | 'stable' | 'declining'
  milestone_crossed: boolean   // crossed a meaningful threshold (25%, 50%, 75%)
  narrative:         string    // plain English for parent/teacher
}

export async function computeCareerReadinessDelta(
  studentId:     string,
  profile:       LearnerProfile,
  prevReadiness: Record<string, number>,  // careerSlug → previous score
): Promise<CareerReadinessDelta[]> {
  const currentReadiness = profile.career_signals?.readiness_scores ?? {}
  const deltas: CareerReadinessDelta[] = []

  const thresholds = [25, 50, 75]

  for (const [slug, currentScore] of Object.entries(currentReadiness)) {
    const prevScore = prevReadiness[slug] ?? 0
    const delta     = currentScore - prevScore
    const direction = delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'

    // Check for threshold crossing
    let milestoneCrossed = false
    for (const threshold of thresholds) {
      if (prevScore < threshold && currentScore >= threshold) {
        milestoneCrossed = true
        // Record as growth milestone
        await addGrowthMilestone(studentId, {
          type:       'pathway_readiness_cross',
          pathway:    slug,
          from_level: `${prevScore}%`,
          to_level:   `${currentScore}%`,
          achieved_at: new Date().toISOString(),
          notified:   false,
        })
      }
    }

    deltas.push({
      career_slug:       slug,
      career_title:      formatCareerTitle(slug),
      previous_score:    prevScore,
      current_score:     currentScore,
      delta,
      direction,
      milestone_crossed: milestoneCrossed,
      narrative:         buildCareerNarrative(slug, currentScore, delta, direction),
    })
  }

  return deltas
    .filter(d => Math.abs(d.delta) > 1 || d.milestone_crossed)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
}

// ── Emerging Interest Detection ───────────────────────────────────────────────

export type EmergingInterest = {
  topic:       string
  subject:     string
  signals:     string[]  // what evidence triggered this
  career_hint: string    // e.g. "This interest aligns with Medicine and Biology"
  strength:    'emerging' | 'growing' | 'strong'
}

export function detectEmergingInterests(profile: LearnerProfile): EmergingInterest[] {
  const interests: EmergingInterest[] = []
  const compassTopics = profile.engagement_patterns?.compass_topics_explored ?? []

  // Topics explored 3+ times in Compass suggest genuine interest
  const topicFreq = new Map<string, number>()
  for (const topic of compassTopics) {
    topicFreq.set(topic, (topicFreq.get(topic) ?? 0) + 1)
  }

  for (const [topic, count] of topicFreq) {
    if (count < 2) continue
    const strength: EmergingInterest['strength'] = count >= 5 ? 'strong' : count >= 3 ? 'growing' : 'emerging'
    const subject  = inferSubjectFromTopic(topic)
    const careers  = inferCareersFromTopic(topic)

    interests.push({
      topic,
      subject,
      signals:     [`Explored ${count}× in Compass`],
      career_hint: careers.length > 0 ? `This interest aligns with ${careers.join(' and ')}` : 'Explore careers in this area',
      strength,
    })
  }

  // Also check formative 'got_it' signals — consistent success suggests interest
  const gotItSubjects = (profile.formative_signals ?? [])
    .filter(s => s.outcome === 'got_it')
    .map(s => s.subject)
  const subjectFreq = new Map<string, number>()
  for (const subj of gotItSubjects) {
    subjectFreq.set(subj, (subjectFreq.get(subj) ?? 0) + 1)
  }
  for (const [subject, count] of subjectFreq) {
    if (count < 3) continue
    const alreadyAdded = interests.some(i => i.subject === subject)
    if (!alreadyAdded) {
      interests.push({
        topic:      subject,
        subject,
        signals:    [`${count} "got it" signals in formative checks`],
        career_hint: inferCareersFromTopic(subject).length > 0
          ? `Success in ${subject} opens paths in ${inferCareersFromTopic(subject).join(', ')}`
          : '',
        strength:   count >= 5 ? 'strong' : 'growing',
      })
    }
  }

  return interests
    .sort((a, b) => strengthOrder(b.strength) - strengthOrder(a.strength))
    .slice(0, 5)
}

// ── Career Intelligence Summary ───────────────────────────────────────────────

export type CareerIntelligenceSummary = {
  student_id:         string
  top_pathway:        string | null
  pathway_score:      number
  top_career:         string | null
  career_confidence:  number    // 0–100
  emerging_interests: EmergingInterest[]
  missing_competencies: string[]
  recommended_action: string
  generated_at:       string
}

export function buildCareerIntelligenceSummary(
  studentId: string,
  profile:   LearnerProfile,
): CareerIntelligenceSummary {
  const r = profile.pathway_readiness
  const pathways = [
    { name: 'STEM',            score: r.stem.score },
    { name: 'Social Sciences', score: r.social_sciences.score },
    { name: 'Arts & Sports',   score: r.arts_sports.score },
    { name: 'Technical/TVET',  score: r.technical_tvet.score },
  ].sort((a, b) => b.score - a.score)

  const topPathway  = pathways[0]
  const topCareer   = profile.career_signals?.top_career_slugs?.[0] ?? null
  const interests   = detectEmergingInterests(profile)

  // Missing competencies: dimensions below 'developing'
  const dims  = profile.capability_dimensions as Record<string, { level?: string }>
  const missingComps = Object.entries(dims)
    .filter(([, d]) => d?.level === 'emerging')
    .map(([k]) => k.replace(/_/g, ' '))

  return {
    student_id:           studentId,
    top_pathway:          topPathway?.name ?? null,
    pathway_score:        topPathway?.score ?? 0,
    top_career:           topCareer ? formatCareerTitle(topCareer) : null,
    career_confidence:    Math.round((topPathway?.score ?? 0) * 0.6 + (topCareer ? 20 : 0)),
    emerging_interests:   interests,
    missing_competencies: missingComps.slice(0, 3),
    recommended_action:   buildCareerAction(topPathway?.score ?? 0, topCareer, missingComps),
    generated_at:         new Date().toISOString(),
  }
}

// ── Record Career Readiness Surge Milestone ───────────────────────────────────

export async function detectAndRecordCareerMilestones(
  studentId:     string,
  profile:       LearnerProfile,
  db:            ReturnType<typeof createServiceClient>,
): Promise<void> {
  const dims  = profile.capability_dimensions as Record<string, { level?: string; previous_level?: string }>
  const now   = new Date().toISOString()

  // Detect multiple simultaneous capability improvements — that's a "career readiness surge"
  const newCapabilities = Object.entries(dims)
    .filter(([, d]) => {
      const levels = ['emerging', 'developing', 'capable', 'strong', 'exceptional']
      const prevIdx = levels.indexOf(d?.previous_level ?? '')
      const nextIdx = levels.indexOf(d?.level ?? '')
      return nextIdx > prevIdx && nextIdx >= 2  // crossed to 'capable' or above
    })
    .map(([k]) => k)

  if (newCapabilities.length >= 2) {
    await db.from('eils_milestones').insert({
      student_id:       studentId,
      milestone_type:   'career_readiness_surge',
      title:            `${newCapabilities.length} capabilities reached new levels`,
      description:      `${newCapabilities.map(c => c.replace(/_/g, ' ')).join(', ')} all crossed a capability threshold in the same assessment cycle — a strong career readiness signal.`,
      evidence:         { capabilities: newCapabilities },
      celebrated:       false,
      notified_teacher: false,
      notified_parent:  false,
      achieved_at:      now,
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCareerTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildCareerNarrative(
  slug:      string,
  score:     number,
  delta:     number,
  direction: string,
): string {
  const title = formatCareerTitle(slug)
  if (direction === 'improving') return `Readiness for ${title} improved by ${delta}% — now at ${score}%`
  if (direction === 'declining') return `Readiness for ${title} decreased by ${Math.abs(delta)}% — now at ${score}%`
  return `Readiness for ${title} is stable at ${score}%`
}

function inferSubjectFromTopic(topic: string): string {
  const lower = topic.toLowerCase()
  if (lower.includes('algebra') || lower.includes('geometry') || lower.includes('number')) return 'mathematics'
  if (lower.includes('cell') || lower.includes('atom') || lower.includes('force')) return 'integrated_science'
  if (lower.includes('essay') || lower.includes('grammar') || lower.includes('comprehension')) return 'english'
  if (lower.includes('historia') || lower.includes('mazingira')) return 'kiswahili'
  if (lower.includes('map') || lower.includes('environment') || lower.includes('civic')) return 'social_studies'
  return 'general'
}

function inferCareersFromTopic(topic: string): string[] {
  const lower = topic.toLowerCase()
  if (lower.includes('math') || lower.includes('algebra')) return ['Engineering', 'Finance', 'Data Science']
  if (lower.includes('science') || lower.includes('biology')) return ['Medicine', 'Research', 'Agriculture']
  if (lower.includes('art') || lower.includes('creative')) return ['Design', 'Architecture', 'Media']
  if (lower.includes('social') || lower.includes('civic')) return ['Law', 'Public Service', 'Teaching']
  if (lower.includes('tech') || lower.includes('computer')) return ['Software Engineering', 'ICT', 'Cybersecurity']
  return []
}

function strengthOrder(s: EmergingInterest['strength']): number {
  return { emerging: 0, growing: 1, strong: 2 }[s]
}

function buildCareerAction(
  pathwayScore: number,
  topCareer:    string | null,
  missingComps: string[],
): string {
  if (pathwayScore < 30) return 'Build foundational subject competencies before pathway selection'
  if (missingComps.length >= 2) return `Develop ${missingComps[0]} and ${missingComps[1]} to strengthen career readiness`
  if (!topCareer) return 'Explore career options in the highest-scoring pathway'
  if (pathwayScore >= 70) return `Ready to deepen specialisation toward ${formatCareerTitle(topCareer)}`
  return `Continue building ${formatCareerTitle(topCareer)} readiness — ${pathwayScore}% pathway score`
}
