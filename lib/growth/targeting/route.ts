import type { RouteActionType, RouteStep, TargetedSchool } from './types'

// Minutes are rough, static estimates per channel — not a scheduling
// system, just enough to plan a morning (mission's own worked example uses
// these exact numbers: Call 5, WhatsApp 2, Physical Visit 20).
const ESTIMATED_MINUTES: Record<RouteActionType, number> = {
  WhatsApp: 2,
  Call: 5,
  Email: 3,
  'Physical Visit': 20,
}

const DEFAULT_MAX_STEPS = 8

function pickActionType(school: TargetedSchool): RouteActionType {
  if (school.hasWhatsapp) return 'WhatsApp'
  if (school.hasPhone) return 'Call'
  if (school.hasEmail) return 'Email'
  return 'Physical Visit'
}

/**
 * Sprint PE-6 "Today's Route" — sequencing only, explicitly not navigation
 * (no maps, no travel time between stops). Takes the already-ranked
 * 🔥/📅 schools and turns them into a short numbered list: what to do,
 * roughly how long it takes, in priority order.
 */
export function buildTodaysRoute(rankedSchools: TargetedSchool[], maxSteps = DEFAULT_MAX_STEPS): RouteStep[] {
  const actionable = rankedSchools.filter((s) => s.bucket === '🔥 Contact Today' || s.bucket === '📅 Schedule This Week')
  return actionable.slice(0, maxSteps).map((school, i) => {
    const actionType = pickActionType(school)
    return {
      order: i + 1,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      actionType,
      estimatedMinutes: ESTIMATED_MINUTES[actionType],
    }
  })
}
