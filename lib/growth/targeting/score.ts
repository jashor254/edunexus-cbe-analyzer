import type { GrowthSchool } from '@/lib/growth/types'
import type { FounderPriorityScore, PriorityBucket, ScoreFactor, SchoolTargetingContext } from './types'

/**
 * Sprint PE-6 — the Founder Priority Score. Every point is a named,
 * documented constant below — "no hidden scoring" is enforced by
 * construction: computeFounderPriorityScore() cannot award a point that
 * doesn't appear in this table, and every awarded/not-awarded factor is
 * returned to the caller, not just the total.
 *
 * Deliberately NOT machine-learned, NOT probabilistic, NOT weighted by
 * anything the founder can't see and restate themselves. A factor here
 * that overlaps another (e.g. `discovery_score`/`contact_quality` were
 * themselves computed from phone/website/email at discovery time) is kept
 * anyway because PE-6 names it as an explicit input — the overlap is
 * accepted and labeled, not hidden.
 */
export const SCORE_POINTS = {
  hasPhone: 15,
  hasWhatsapp: 15,
  hasEmail: 5,
  hasWebsite: 5,
  selectionReasonRecorded: 10,
  existingIctActivityNoted: 10,
  researchGenuinelyComplete: 5, // bonus on top of the two above, when both are present
  strongDiscoveryScore: 10, // discovery_score >= 60 — a marginal signal (Google rating + review volume) not otherwise counted
  highContactQuality: 5,
  freshOpportunity: 10, // no outreach logged yet at all
  followUpOverdue: 20,
  inDiscoveryStage: 10,
  demoScheduledOrCompleted: 15,
  pilotInterestExpressed: 20,
  starred: 25,
} as const

const STRONG_DISCOVERY_SCORE_THRESHOLD = 60

// Rule-based, deterministic thresholds — no ML, no percentages shown to the
// founder, just a bucket. Named constants so they're inspectable, not magic
// numbers buried in a comparison.
const BUCKET_THRESHOLDS = { contactToday: 70, scheduleThisWeek: 45, waiting: 20 } as const

function computeBucket(score: number, starred: boolean): PriorityBucket {
  // Manual Boost: "these always appear near the top" — a star forces the
  // top bucket regardless of the numeric score, and the score itself still
  // reflects reality (the ⭐ factor line explains the override so a lower
  // number next to "Contact Today" is never a mystery).
  if (starred) return '🔥 Contact Today'
  if (score >= BUCKET_THRESHOLDS.contactToday) return '🔥 Contact Today'
  if (score >= BUCKET_THRESHOLDS.scheduleThisWeek) return '📅 Schedule This Week'
  if (score >= BUCKET_THRESHOLDS.waiting) return '⏳ Waiting'
  return '🚫 Low Priority'
}

export function computeFounderPriorityScore(school: GrowthSchool, context: SchoolTargetingContext): FounderPriorityScore {
  const hasPhone = !!school.phone?.trim()
  const hasWhatsapp = !!school.whatsapp_number?.trim()
  const hasEmail = !!school.email?.trim()
  const hasWebsite = !!school.website?.trim()
  const hasSelectionReason = !!school.selection_reason?.trim()
  const hasIctActivity = !!school.existing_ict_activity?.trim()
  const researchComplete = hasSelectionReason && hasIctActivity
  const strongDiscoveryScore = (school.discovery_score ?? 0) >= STRONG_DISCOVERY_SCORE_THRESHOLD
  const highContactQuality = school.contact_quality === 'High'
  const freshOpportunity = !context.hasAnyActivity
  const inDiscovery = school.pipeline_stage === 'discovery'
  const demoStage = school.pipeline_stage === 'demo_scheduled' || school.pipeline_stage === 'demo_completed'
  const pilotStage = ['pilot_offered', 'pilot_running', 'pilot_won'].includes(school.pipeline_stage)

  const factors: ScoreFactor[] = [
    { label: 'Verified phone on file', points: SCORE_POINTS.hasPhone, satisfied: hasPhone },
    { label: 'WhatsApp available', points: SCORE_POINTS.hasWhatsapp, satisfied: hasWhatsapp },
    { label: 'Email on file', points: SCORE_POINTS.hasEmail, satisfied: hasEmail },
    { label: 'Website exists', points: SCORE_POINTS.hasWebsite, satisfied: hasWebsite },
    { label: 'Selection reason recorded', points: SCORE_POINTS.selectionReasonRecorded, satisfied: hasSelectionReason },
    { label: 'Existing ICT activity noted', points: SCORE_POINTS.existingIctActivityNoted, satisfied: hasIctActivity },
    { label: 'Research complete (reason + ICT activity both on file)', points: SCORE_POINTS.researchGenuinelyComplete, satisfied: researchComplete },
    { label: `High discovery score (>= ${STRONG_DISCOVERY_SCORE_THRESHOLD})`, points: SCORE_POINTS.strongDiscoveryScore, satisfied: strongDiscoveryScore },
    { label: 'High contact quality at discovery', points: SCORE_POINTS.highContactQuality, satisfied: highContactQuality },
    { label: 'No outreach yet — fresh opportunity', points: SCORE_POINTS.freshOpportunity, satisfied: freshOpportunity },
    { label: `Follow-up overdue${context.followUpTask ? `: ${context.followUpTask}` : ''}`, points: SCORE_POINTS.followUpOverdue, satisfied: context.followUpOverdue },
    { label: 'Currently in discovery stage', points: SCORE_POINTS.inDiscoveryStage, satisfied: inDiscovery },
    { label: 'Demo scheduled or completed', points: SCORE_POINTS.demoScheduledOrCompleted, satisfied: demoStage },
    { label: 'Pilot interest expressed', points: SCORE_POINTS.pilotInterestExpressed, satisfied: pilotStage },
    { label: '⭐ Founder starred this school', points: SCORE_POINTS.starred, satisfied: school.starred },
  ]

  const rawScore = factors.reduce((sum, f) => sum + (f.satisfied ? f.points : 0), 0)
  const score = Math.min(100, rawScore)

  return { score, bucket: computeBucket(score, school.starred), factors }
}
