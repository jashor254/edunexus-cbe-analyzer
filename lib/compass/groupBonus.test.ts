// lib/compass/groupBonus.test.ts
//
// The study-group bonus previously capped itself by looking for a
// `study_group_answers` row from today — a table this path never writes. The
// cap therefore never fired (unlimited +5 per completed session) and the one
// case it did catch was inverted: a learner who had answered a group challenge
// that day was the only learner denied their Compass bonus.
//
// These tests pin the replacement rule: one bonus per group, on the first
// Compass session a learner completes each day, derived from the sessions
// themselves. Group-challenge activity is deliberately not consulted at all.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/groupBonus.test.ts

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { repos } from '@/lib/repositories'
import { awardCompassGroupBonus, COMPASS_GROUP_BONUS_POINTS } from './groupBonus'

const STUDENT = 'student-under-test'
const SESSION = 'session-under-test'

const realCount       = repos.compass.countCompletedSessionsSince.bind(repos.compass)
const realMemberships = repos.compass.findStudyGroupMemberships.bind(repos.compass)
const realAddPoints   = repos.compass.addStudyGroupPoints.bind(repos.compass)

type Awarded = { memberId: string; points: number }

function stub(input: {
  earlierSessionsToday: number
  memberships?: Array<{ id: string; points: number; group_id: string }>
}): { awarded: Awarded[]; subjectFilters: string[] } {
  const awarded: Awarded[] = []
  const subjectFilters: string[] = []

  repos.compass.countCompletedSessionsSince = async () => input.earlierSessionsToday
  repos.compass.findStudyGroupMemberships = async (_studentId, subjectFilter) => {
    subjectFilters.push(subjectFilter)
    return input.memberships ?? []
  }
  repos.compass.addStudyGroupPoints = async (memberId, points) => {
    awarded.push({ memberId, points })
  }

  return { awarded, subjectFilters }
}

afterEach(() => {
  repos.compass.countCompletedSessionsSince = realCount
  repos.compass.findStudyGroupMemberships   = realMemberships
  repos.compass.addStudyGroupPoints         = realAddPoints
})

test('awards the bonus on the first completed session of the day', async () => {
  const { awarded } = stub({
    earlierSessionsToday: 0,
    memberships: [{ id: 'member-1', points: 20, group_id: 'group-1' }],
  })

  const result = await awardCompassGroupBonus({
    studentId: STUDENT, sessionId: SESSION, subject: 'mathematics',
  })

  assert.equal(result.awarded, true)
  assert.equal(result.groupsAwarded, 1)
  assert.deepEqual(awarded, [{ memberId: 'member-1', points: 20 + COMPASS_GROUP_BONUS_POINTS }])
})

test('does not award a second bonus later the same day', async () => {
  const { awarded } = stub({
    earlierSessionsToday: 1,
    memberships: [{ id: 'member-1', points: 20, group_id: 'group-1' }],
  })

  const result = await awardCompassGroupBonus({
    studentId: STUDENT, sessionId: SESSION, subject: 'mathematics',
  })

  assert.equal(result.awarded, false, 'the bonus is once per day, not once per session')
  assert.deepEqual(awarded, [], 'no points may be written on a repeat session')
})

test('credits every matching group exactly once', async () => {
  const { awarded } = stub({
    earlierSessionsToday: 0,
    memberships: [
      { id: 'member-1', points: 0,  group_id: 'group-1' },
      { id: 'member-2', points: 15, group_id: 'group-2' },
    ],
  })

  const result = await awardCompassGroupBonus({
    studentId: STUDENT, sessionId: SESSION, subject: 'mathematics',
  })

  assert.equal(result.groupsAwarded, 2)
  assert.deepEqual(awarded, [
    { memberId: 'member-1', points: COMPASS_GROUP_BONUS_POINTS },
    { memberId: 'member-2', points: 15 + COMPASS_GROUP_BONUS_POINTS },
  ])
})

test('no groups for the subject means no award and no writes', async () => {
  const { awarded } = stub({ earlierSessionsToday: 0, memberships: [] })

  const result = await awardCompassGroupBonus({
    studentId: STUDENT, sessionId: SESSION, subject: 'mathematics',
  })

  assert.equal(result.awarded, false)
  assert.deepEqual(awarded, [])
})

test('matches group subjects on the first word of the session subject slug', async () => {
  const { subjectFilters } = stub({ earlierSessionsToday: 0, memberships: [] })

  await awardCompassGroupBonus({
    studentId: STUDENT, sessionId: SESSION, subject: 'integrated_science',
  })

  assert.deepEqual(subjectFilters, ['%integrated%'],
    "'Integrated Science' groups must still match the 'integrated_science' slug")
})
