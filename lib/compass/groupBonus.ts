// lib/compass/groupBonus.ts
//
// The study-group participation bonus a learner earns for completing a Compass
// session in a subject they study with a group. Extracted from
// app/api/learn/end/route.ts, which held it inline against CLAUDE.md's
// thin-route rule.
//
// The daily cap this replaces was checking the wrong table: it looked for a
// `study_group_answers` row from today, but this path only ever writes
// `study_group_members.points` and never inserts an answer. Nothing recorded
// the bonus, so nothing capped it (a learner could complete sessions all day
// and collect +5 each time), and the one case it *did* block was the wrong
// one — a learner who had answered a group challenge that day was the only
// learner denied their Compass bonus.
//
// The cap is now derived from the fact that actually determines it: whether
// this learner has already completed a Compass session today. Combined with
// the caller's once-per-session gate (endSession only returns true for the
// call that transitions the session out of 'active'), that yields exactly one
// bonus per group per day.

import { repos } from '@/lib/repositories'

/** Points awarded to each of the learner's matching study groups. */
export const COMPASS_GROUP_BONUS_POINTS = 5

function startOfTodayIso(now: Date): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Matches `study_groups.subject` ('Integrated Science') against a
 * `compass_sessions.subject` slug ('integrated_science') on the first word,
 * preserving the existing matching behaviour.
 */
function subjectFilter(sessionSubject: string): string {
  const firstWord = sessionSubject.replace(/_/g, ' ').trim().split(' ')[0] ?? ''
  return `%${firstWord}%`
}

export type GroupBonusResult = {
  awarded: boolean
  /** Number of groups credited — 0 when the daily bonus was already taken. */
  groupsAwarded: number
}

/**
 * Awards the once-per-day group bonus for a just-completed Compass session.
 * Safe to call only once per session — the caller must have won the
 * end-session transition first.
 */
export async function awardCompassGroupBonus(input: {
  studentId: string
  sessionId: string
  subject: string
  now?: Date
}): Promise<GroupBonusResult> {
  const now = input.now ?? new Date()

  const earlierToday = await repos.compass.countCompletedSessionsSince(
    input.studentId,
    startOfTodayIso(now),
    input.sessionId,
  )
  if (earlierToday > 0) return { awarded: false, groupsAwarded: 0 }

  const memberships = await repos.compass.findStudyGroupMemberships(
    input.studentId,
    subjectFilter(input.subject),
  )
  if (memberships.length === 0) return { awarded: false, groupsAwarded: 0 }

  for (const m of memberships) {
    await repos.compass.addStudyGroupPoints(m.id, m.points + COMPASS_GROUP_BONUS_POINTS)
  }

  return { awarded: true, groupsAwarded: memberships.length }
}
