// lib/compass/nextSubject.test.ts
//
// Covers the three next-subject defects fixed alongside this file. Each test
// is written so that it fails against the previous behaviour, not just so it
// passes against the new behaviour:
//
//  1. Rotation never rotated. `getNextSubject` excluded the last subject using
//     a lookup that only saw sessions still `active`. A finished session is
//     `completed`, so in the normal case nothing was excluded and the learner
//     was handed the same weakest subject every time.
//  2. `subject_rest_until` was written by the end-of-session eval and read by
//     nothing. The rest window is now honoured.
//  3. `session_goal` is a single per-student column authored for one specific
//     subject, but was attached as the subtopic of whatever subject rotation
//     picked — a Maths goal on a Kiswahili session.
//
// Repository reads are stubbed: this is the decision logic, and the queries
// underneath it are covered by the integration tests.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/nextSubject.test.ts

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { repos } from '@/lib/repositories'
import { getNextSubject } from './session'
import type { StudentLearningContextRow } from '@/lib/repositories/compass.repository'

const STUDENT = 'student-under-test'

const realGetContext           = repos.compass.getStudentLearningContext.bind(repos.compass)
const realGetLastSessionSubject = repos.compass.getLastSessionSubject.bind(repos.compass)

function context(overrides: Partial<StudentLearningContextRow> = {}): StudentLearningContextRow {
  return {
    subject_tiers:       {},
    compass_bridge:      {},
    recommended_pathway: null,
    grade:               8,
    session_goal:        null,
    first_subject:       null,
    subject_rest_until:  null,
    ...overrides,
  }
}

function stub(ctx: StudentLearningContextRow | null, lastSubject: string | null): void {
  repos.compass.getStudentLearningContext = async () => ctx
  repos.compass.getLastSessionSubject     = async () => lastSubject
}

afterEach(() => {
  repos.compass.getStudentLearningContext = realGetContext
  repos.compass.getLastSessionSubject     = realGetLastSessionSubject
})

// ── 1. Rotation ──────────────────────────────────────────────────────────────

test('does not recommend the subject the learner just finished', async () => {
  stub(
    context({ subject_tiers: { mathematics: 'remedial', english: 'reinforcement' } }),
    // The previous session is COMPLETED, not active — the case the old
    // active-only lookup could never see.
    'mathematics',
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'english',
    'weakest subject was just studied; rotation must move on rather than repeat it')
})

test('still recommends the weakest subject when it is not the last one studied', async () => {
  stub(
    context({ subject_tiers: { mathematics: 'remedial', english: 'standard' } }),
    'english',
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'mathematics')
  assert.equal(next.reason, 'weakest_gap')
})

test('falls back to the last subject when it is the only candidate', async () => {
  stub(context({ subject_tiers: { mathematics: 'remedial' } }), 'mathematics')

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'mathematics',
    'recommending the repeat beats recommending nothing when no rest is in force')
})

// ── 2. Rest window ───────────────────────────────────────────────────────────

const inTwoDays = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

test('an active rest window blocks the fallback to the rested subject', async () => {
  stub(
    context({ subject_tiers: { mathematics: 'remedial' }, subject_rest_until: inTwoDays() }),
    'mathematics',
  )

  const next = await getNextSubject(STUDENT)

  assert.notEqual(next.subject, 'mathematics',
    'the eval asked for a break from this subject; the fallback must not hand it straight back')
})

test('an active rest window still allows a different subject', async () => {
  stub(
    context({
      subject_tiers:      { mathematics: 'remedial', english: 'reinforcement' },
      subject_rest_until: inTwoDays(),
    }),
    'mathematics',
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'english')
})

test('an expired rest window is ignored', async () => {
  stub(
    context({ subject_tiers: { mathematics: 'remedial' }, subject_rest_until: yesterday() }),
    'mathematics',
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'mathematics')
})

// ── 3. session_goal belongs to one subject ───────────────────────────────────

test('session_goal is not attached to an unrelated subject', async () => {
  stub(
    context({
      subject_tiers:  { kiswahili: 'remedial', mathematics: 'standard' },
      session_goal:   'Master linear equations',
      first_subject:  'mathematics',
    }),
    null,
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'kiswahili')
  assert.equal(next.subtopic, null,
    'a Maths goal must not become the subtopic of a Kiswahili session')
  assert.notEqual(next.reason, 'holiday_plan',
    'reason must not claim a holiday plan that does not apply to this subject')
})

test('session_goal is used when the picked subject is the one it was written for', async () => {
  stub(
    context({
      subject_tiers:  { mathematics: 'remedial' },
      session_goal:   'Master linear equations',
      first_subject:  'mathematics',
    }),
    null,
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'mathematics')
  assert.equal(next.subtopic, 'Master linear equations')
  assert.equal(next.reason, 'holiday_plan')
})

test('compass_bridge.firstSubject identifies the goal subject too', async () => {
  stub(
    context({
      subject_tiers:  { english: 'remedial' },
      compass_bridge: { firstSubject: 'english' },
      session_goal:   'Build paragraph structure',
    }),
    null,
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subtopic, 'Build paragraph structure')
  assert.equal(next.reason, 'holiday_plan')
})

// ── Teacher recommendation still wins ────────────────────────────────────────

test('a teacher-suggested topic outranks rotation, rest and goals', async () => {
  stub(
    context({
      subject_tiers:      { mathematics: 'remedial' },
      compass_bridge:     { teacherSuggested: true, firstSubject: 'chemistry', firstConcept: 'Ionic bonding' },
      subject_rest_until: inTwoDays(),
    }),
    'chemistry',
  )

  const next = await getNextSubject(STUDENT)

  assert.equal(next.subject, 'chemistry')
  assert.equal(next.subtopic, 'Ionic bonding')
  assert.equal(next.reason, 'teacher_recommendation')
})
