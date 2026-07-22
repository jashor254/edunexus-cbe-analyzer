import { growthRepos } from '@/lib/growth/repositories'
import { REPLY_TAG } from '@/lib/growth/services/activities'
import { PILOT_ACQUISITION_GOAL, WEEKLY_CONTACT_GOAL } from '@/lib/growth/constants'

/**
 * Sprint PE-7 (Pilot Campaign Launch) Parts 6-7 — deterministic, fact-only
 * counters and a founder-facing end-of-day digest. Nothing here is
 * generated or summarized by AI ("no AI summaries, only facts") — every
 * number is a plain count over real growth_activities/growth_schools/
 * growth_follow_ups rows, computed the same way dashboard.ts's Mission
 * Control sections always have been.
 */

function todayDateStr(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function tomorrowDateStr(now: Date): string {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export type DailyCounters = {
  todaysContacts: number
  todaysReplies: number
  discoveryMeetings: number
  demos: number
  pilots: number
  weeklyContactGoal: number
  monthlyPilotGoal: number
}

export async function getDailyCounters(): Promise<DailyCounters> {
  const now = new Date()
  const today = todayDateStr(now)
  const startOfTodayIso = `${today}T00:00:00.000Z`

  const [todaysActivities, allSchools] = await Promise.all([
    growthRepos.activities.listSince(startOfTodayIso),
    growthRepos.schools.list(),
  ])
  const todaysOnly = todaysActivities.filter((a) => a.occurred_at.slice(0, 10) === today)

  const contactedSchoolIds = new Set(todaysOnly.map((a) => a.school_id))
  const repliedSchoolIds = new Set(todaysOnly.filter((a) => a.notes?.includes(REPLY_TAG)).map((a) => a.school_id))
  const pilotStageSchools = allSchools.filter((s) => ['pilot_offered', 'pilot_running', 'pilot_won'].includes(s.pipeline_stage))

  return {
    todaysContacts: contactedSchoolIds.size,
    todaysReplies: repliedSchoolIds.size,
    discoveryMeetings: todaysOnly.filter((a) => a.type === 'meeting').length,
    demos: todaysOnly.filter((a) => a.type === 'demo').length,
    pilots: pilotStageSchools.length,
    weeklyContactGoal: WEEKLY_CONTACT_GOAL,
    monthlyPilotGoal: PILOT_ACQUISITION_GOAL,
  }
}

export type EndOfDayReview = {
  schoolsContacted: string[]
  responses: string[]
  noResponses: string[]
  followUpsDueTomorrow: { schoolName: string; task: string }[]
  discoveryMeetingsBooked: string[]
  demoSchedule: string[]
  pilotOpportunities: string[]
}

export async function getEndOfDayReview(): Promise<EndOfDayReview> {
  const now = new Date()
  const today = todayDateStr(now)
  const tomorrow = tomorrowDateStr(now)
  const startOfTodayIso = `${today}T00:00:00.000Z`

  const [todaysActivities, allSchools, openFollowUps] = await Promise.all([
    growthRepos.activities.listSince(startOfTodayIso),
    growthRepos.schools.list(),
    growthRepos.followUps.listOpen(),
  ])
  const todaysOnly = todaysActivities.filter((a) => a.occurred_at.slice(0, 10) === today)
  const schoolById = new Map(allSchools.map((s) => [s.id, s]))

  const contactedIds = new Set(todaysOnly.map((a) => a.school_id))
  const repliedIds = new Set(todaysOnly.filter((a) => a.notes?.includes(REPLY_TAG)).map((a) => a.school_id))
  const meetingIds = new Set(todaysOnly.filter((a) => a.type === 'meeting').map((a) => a.school_id))

  const nameOf = (schoolId: string): string => schoolById.get(schoolId)?.name ?? 'Unknown school'

  return {
    schoolsContacted: Array.from(contactedIds).map(nameOf),
    responses: Array.from(repliedIds).map(nameOf),
    noResponses: Array.from(contactedIds).filter((id) => !repliedIds.has(id)).map(nameOf),
    followUpsDueTomorrow: openFollowUps.filter((f) => f.due_date === tomorrow).map((f) => ({ schoolName: nameOf(f.school_id), task: f.task })),
    discoveryMeetingsBooked: Array.from(meetingIds).map(nameOf),
    demoSchedule: allSchools.filter((s) => s.pipeline_stage === 'demo_scheduled').map((s) => s.name),
    pilotOpportunities: allSchools.filter((s) => ['pilot_offered', 'pilot_running'].includes(s.pipeline_stage)).map((s) => s.name),
  }
}
