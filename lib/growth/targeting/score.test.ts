// Run: npx tsx --test lib/growth/targeting/score.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFounderPriorityScore, SCORE_POINTS } from './score'
import type { GrowthSchool } from '@/lib/growth/types'
import type { SchoolTargetingContext } from './types'

function school(overrides: Partial<GrowthSchool>): GrowthSchool {
  return {
    id: 'school-1',
    name: 'Test School',
    county: 'Kirinyaga',
    category: 'Girls',
    students_count: null,
    status: 'active',
    pipeline_stage: 'research',
    next_action: null,
    next_action_date: null,
    owner_id: null,
    notes: null,
    contact_source: null,
    existing_ict_activity: null,
    selection_reason: null,
    phone: null,
    website: null,
    email: null,
    google_place_id: null,
    google_maps_url: null,
    google_rating: null,
    google_review_count: null,
    business_status: null,
    whatsapp_number: null,
    discovery_score: null,
    contact_quality: null,
    starred: false,
    last_contact_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function context(overrides: Partial<SchoolTargetingContext> = {}): SchoolTargetingContext {
  return {
    hasContact: false,
    contactName: null,
    contactRole: null,
    hasAnyActivity: false,
    hasOpenFollowUp: false,
    followUpOverdue: false,
    followUpTask: null,
    ...overrides,
  }
}

test('verification requirement: a school with verified phone + WhatsApp scores strictly higher than one with no usable contact method', () => {
  const wellContacted = school({ phone: '+254700000001', whatsapp_number: '+254700000001' })
  const noContact = school({ phone: null, whatsapp_number: null, email: null, website: null })

  const scoredGood = computeFounderPriorityScore(wellContacted, context())
  const scoredBad = computeFounderPriorityScore(noContact, context())

  assert.ok(scoredGood.score > scoredBad.score, `expected ${scoredGood.score} > ${scoredBad.score}`)
})

test('every point on the score is traceable to a named factor — no hidden scoring', () => {
  const s = school({ phone: '+254700000001', whatsapp_number: '+254700000001', email: 'a@b.ac.ke' })
  const result = computeFounderPriorityScore(s, context())
  const satisfiedTotal = result.factors.filter((f) => f.satisfied).reduce((sum, f) => sum + f.points, 0)
  assert.equal(result.score, Math.min(100, satisfiedTotal))
})

test('score caps at 100 even when every factor is satisfied', () => {
  const s = school({
    phone: '+254700000001', whatsapp_number: '+254700000001', email: 'a@b.ac.ke', website: 'https://b.ac.ke',
    selection_reason: 'Referral', existing_ict_activity: 'Has a computer lab',
    discovery_score: 100, contact_quality: 'High', pipeline_stage: 'pilot_won', starred: true,
  })
  const result = computeFounderPriorityScore(s, context({ followUpOverdue: true, followUpTask: 'Call back' }))
  assert.equal(result.score, 100)
})

test('bucket thresholds: high score is Contact Today, mid is Schedule This Week, low is Waiting, none is Low Priority', () => {
  const hot = computeFounderPriorityScore(
    school({
      phone: '+254700000001', whatsapp_number: '+254700000001', email: 'a@b.ac.ke', website: 'https://b.ac.ke',
      selection_reason: 'x', existing_ict_activity: 'y',
    }),
    context(),
  )
  assert.equal(hot.bucket, '🔥 Contact Today')

  const mid = computeFounderPriorityScore(
    school({ phone: '+254700000001', whatsapp_number: '+254700000001', email: 'a@b.ac.ke', discovery_score: 80 }),
    context({ hasAnyActivity: true }),
  )
  assert.equal(mid.bucket, '📅 Schedule This Week')

  const nothing = computeFounderPriorityScore(school({}), context({ hasAnyActivity: true }))
  assert.equal(nothing.score, 0)
  assert.equal(nothing.bucket, '🚫 Low Priority')
})

test('Manual Boost: a starred school is always Contact Today, even with a low raw score', () => {
  const starredButBare = school({ starred: true })
  // hasAnyActivity: true isolates the starred contribution from the separate "fresh opportunity" factor.
  const result = computeFounderPriorityScore(starredButBare, context({ hasAnyActivity: true }))
  assert.equal(result.bucket, '🔥 Contact Today')
  assert.equal(result.score, SCORE_POINTS.starred, 'score itself is not inflated beyond the starred factor\'s own points')
  const starFactor = result.factors.find((f) => f.label.includes('starred'))
  assert.equal(starFactor?.satisfied, true)
})

test('a follow-up overdue factor includes the task in its label so the reason is specific, not generic', () => {
  const result = computeFounderPriorityScore(school({}), context({ followUpOverdue: true, followUpTask: 'Send proposal' }))
  const factor = result.factors.find((f) => f.label.startsWith('Follow-up overdue'))
  assert.equal(factor?.label, 'Follow-up overdue: Send proposal')
  assert.equal(factor?.satisfied, true)
})

test('research-complete bonus only applies when BOTH selection reason and ICT activity are present', () => {
  const onlyOne = computeFounderPriorityScore(school({ selection_reason: 'Referral' }), context())
  const both = computeFounderPriorityScore(school({ selection_reason: 'Referral', existing_ict_activity: 'Has lab' }), context())
  const bonus = both.factors.find((f) => f.label.startsWith('Research complete'))
  const bonusOnlyOne = onlyOne.factors.find((f) => f.label.startsWith('Research complete'))
  assert.equal(bonusOnlyOne?.satisfied, false)
  assert.equal(bonus?.satisfied, true)
})

test('fresh-opportunity factor fires only when no activity has ever been logged', () => {
  const fresh = computeFounderPriorityScore(school({}), context({ hasAnyActivity: false }))
  const alreadyWorked = computeFounderPriorityScore(school({}), context({ hasAnyActivity: true }))
  assert.equal(fresh.factors.find((f) => f.label.includes('fresh opportunity'))?.satisfied, true)
  assert.equal(alreadyWorked.factors.find((f) => f.label.includes('fresh opportunity'))?.satisfied, false)
})
