// Run: npx tsx --test lib/growth/targeting/route.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTodaysRoute } from './route'
import type { TargetedSchool } from './types'

function targeted(overrides: Partial<TargetedSchool>): TargetedSchool {
  return {
    schoolId: 'id-1', schoolName: 'Test School', category: null, pipelineStage: 'research', starred: false,
    hasWhatsapp: false, hasPhone: false, hasEmail: false, hasWebsite: false,
    score: 50, bucket: '📅 Schedule This Week', factors: [], nextAction: 'Call today.',
    ...overrides,
  }
}

test('picks WhatsApp over Call over Email over Physical Visit, per school', () => {
  const schools = [
    targeted({ schoolId: '1', schoolName: 'Has WhatsApp', hasWhatsapp: true, hasPhone: true, bucket: '🔥 Contact Today' }),
    targeted({ schoolId: '2', schoolName: 'Has Phone Only', hasPhone: true, bucket: '🔥 Contact Today' }),
    targeted({ schoolId: '3', schoolName: 'Has Email Only', hasEmail: true, bucket: '🔥 Contact Today' }),
    targeted({ schoolId: '4', schoolName: 'Nothing Digital', bucket: '🔥 Contact Today' }),
  ]
  const route = buildTodaysRoute(schools)
  assert.deepEqual(route.map((r) => r.actionType), ['WhatsApp', 'Call', 'Email', 'Physical Visit'])
  assert.deepEqual(route.map((r) => r.estimatedMinutes), [2, 5, 3, 20])
})

test('only includes 🔥 Contact Today and 📅 Schedule This Week — never ⏳ Waiting or 🚫 Low Priority', () => {
  const schools = [
    targeted({ schoolId: '1', bucket: '🔥 Contact Today' }),
    targeted({ schoolId: '2', bucket: '📅 Schedule This Week' }),
    targeted({ schoolId: '3', bucket: '⏳ Waiting' }),
    targeted({ schoolId: '4', bucket: '🚫 Low Priority' }),
  ]
  const route = buildTodaysRoute(schools)
  assert.deepEqual(route.map((r) => r.schoolId), ['1', '2'])
})

test('numbers steps in order starting at 1, and respects the max-steps cap', () => {
  const schools = Array.from({ length: 12 }, (_, i) => targeted({ schoolId: `${i}`, bucket: '🔥 Contact Today' }))
  const route = buildTodaysRoute(schools, 5)
  assert.equal(route.length, 5)
  assert.deepEqual(route.map((r) => r.order), [1, 2, 3, 4, 5])
})

test('this is sequencing, not navigation — no distance/travel-time field exists on a route step', () => {
  const route = buildTodaysRoute([targeted({ bucket: '🔥 Contact Today' })])
  assert.deepEqual(Object.keys(route[0]).sort(), ['actionType', 'estimatedMinutes', 'order', 'schoolId', 'schoolName'])
})
