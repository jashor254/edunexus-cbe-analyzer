import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeNextActions, topNextAction, type NextActionFacts } from './nextAction'

const empty: NextActionFacts = { attendanceGaps: [], pendingAssessments: [], teachingGaps: [] }

test('no facts -> no actions, top action is null', () => {
  assert.deepEqual(composeNextActions(empty), [])
  assert.equal(topNextAction(empty), null)
})

test('attendance gaps come before teaching gaps and assessments', () => {
  const facts: NextActionFacts = {
    attendanceGaps: [{ classId: 'c1', className: 'Grade 8 North' }],
    teachingGaps: [{ schemeId: 's1', label: 'Grade 8 · Maths', track: 'lp', done: 2, total: 5 }],
    pendingAssessments: [{ id: 'a1', classId: 'c1', title: 'CAT 1', className: 'Grade 8 North' }],
  }
  const actions = composeNextActions(facts)
  assert.equal(actions.length, 3)
  assert.equal(actions[0].kind, 'attendance')
  assert.equal(actions[1].kind, 'teaching')
  assert.equal(actions[2].kind, 'assessment')
})

test('top next action is the first attendance gap when one exists', () => {
  const facts: NextActionFacts = {
    attendanceGaps: [{ classId: 'c1', className: 'Grade 8 North' }],
    teachingGaps: [],
    pendingAssessments: [{ id: 'a1', classId: 'c1', title: 'CAT 1', className: 'Grade 8 North' }],
  }
  const top = topNextAction(facts)
  assert.equal(top?.kind, 'attendance')
  assert.equal(top?.title, 'Complete attendance for Grade 8 North')
})

test('attendance action links to the Attendance workspace, not a fabricated deep link', () => {
  const facts: NextActionFacts = { ...empty, attendanceGaps: [{ classId: 'c1', className: 'Grade 8 North' }] }
  assert.equal(composeNextActions(facts)[0].href, '/teacher/attendance')
})

test('teaching action links lesson-plans track to the right sowId, row track to record-of-work', () => {
  const facts: NextActionFacts = {
    ...empty,
    teachingGaps: [
      { schemeId: 's1', label: 'Grade 8 · Maths', track: 'lp', done: 1, total: 4 },
      { schemeId: 's2', label: 'Grade 8 · English', track: 'row', done: 3, total: 4 },
    ],
  }
  const actions = composeNextActions(facts)
  assert.equal(actions[0].href, '/teacher/lesson-plans?sowId=s1')
  assert.equal(actions[1].href, '/teacher/record-of-work')
})

test('multiple attendance gaps all surface, in input order', () => {
  const facts: NextActionFacts = {
    ...empty,
    attendanceGaps: [
      { classId: 'c1', className: 'Grade 8 North' },
      { classId: 'c2', className: 'Grade 8 South' },
    ],
  }
  const actions = composeNextActions(facts)
  assert.equal(actions.length, 2)
  assert.equal(actions[0].title, 'Complete attendance for Grade 8 North')
  assert.equal(actions[1].title, 'Complete attendance for Grade 8 South')
})
