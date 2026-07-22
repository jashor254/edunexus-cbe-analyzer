// Sprint PE-6 — Pilot Targeting Engine. Shared vocabulary for score.ts,
// nextAction.ts, route.ts, and the orchestrating service.

export type PriorityBucket = '🔥 Contact Today' | '📅 Schedule This Week' | '⏳ Waiting' | '🚫 Low Priority'

/** One line of the "why" — every point on the Founder Priority Score must be traceable to exactly one of these, visible to the founder, never hidden. */
export type ScoreFactor = {
  label: string
  points: number
  satisfied: boolean
}

export type FounderPriorityScore = {
  score: number
  bucket: PriorityBucket
  factors: ScoreFactor[]
}

/**
 * Everything the scorer needs about one school, beyond the growth_schools
 * row itself — pulled from growth_contacts/growth_follow_ups/
 * growth_activities so the score can consider "already contacted,"
 * "follow-up overdue," etc. without querying inside a loop (the caller
 * batches these once for every school).
 */
export type SchoolTargetingContext = {
  hasContact: boolean
  contactName: string | null
  contactRole: string | null
  hasAnyActivity: boolean
  hasOpenFollowUp: boolean
  followUpOverdue: boolean
  followUpTask: string | null
}

/** One school, fully scored and ready to render — what the API/UI actually consumes. */
export type TargetedSchool = {
  schoolId: string
  schoolName: string
  category: string | null
  pipelineStage: string
  starred: boolean
  hasWhatsapp: boolean
  hasPhone: boolean
  hasEmail: boolean
  hasWebsite: boolean
  score: number
  bucket: PriorityBucket
  factors: ScoreFactor[]
  nextAction: string
}

export type RouteActionType = 'WhatsApp' | 'Call' | 'Email' | 'Physical Visit'

export type RouteStep = {
  order: number
  schoolId: string
  schoolName: string
  actionType: RouteActionType
  estimatedMinutes: number
}
