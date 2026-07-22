// Run: npx tsx --test lib/growth/targeting/nextAction.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveNextAction } from './nextAction'
import type { GrowthSchool } from '@/lib/growth/types'
import type { SchoolTargetingContext } from './types'

function school(overrides: Partial<GrowthSchool>): GrowthSchool {
  return {
    id: 'school-1', name: 'Test School', county: 'Kirinyaga', category: 'Girls', students_count: null,
    status: 'active', pipeline_stage: 'research', next_action: null, next_action_date: null, owner_id: null,
    notes: null, contact_source: null, existing_ict_activity: null, selection_reason: null, phone: null,
    website: null, email: null, google_place_id: null, google_maps_url: null, google_rating: null,
    google_review_count: null, business_status: null, whatsapp_number: null, discovery_score: null,
    contact_quality: null, starred: false, last_contact_at: null, created_by: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function context(overrides: Partial<SchoolTargetingContext> = {}): SchoolTargetingContext {
  return {
    hasContact: false, contactName: null, contactRole: null, hasAnyActivity: false,
    hasOpenFollowUp: false, followUpOverdue: false, followUpTask: null,
    ...overrides,
  }
}

test('overdue follow-up wins over everything else, and names the specific task', () => {
  const action = deriveNextAction(school({ whatsapp_number: '+254700000001' }), context({ followUpOverdue: true, followUpTask: 'Send proposal' }))
  assert.equal(action, 'Complete the overdue follow-up: Send proposal.')
})

test('pilot-stage schools get a pilot-specific action', () => {
  assert.equal(deriveNextAction(school({ pipeline_stage: 'pilot_running' }), context()), 'Follow up on pilot interest — keep momentum going.')
})

test('demo-stage schools get demo-specific actions', () => {
  assert.equal(deriveNextAction(school({ pipeline_stage: 'demo_scheduled' }), context()), 'Confirm details ahead of the scheduled demo.')
  assert.equal(deriveNextAction(school({ pipeline_stage: 'demo_completed' }), context()), 'Follow up after the demo — ask for a decision.')
})

test('fresh opportunity (no activity yet): WhatsApp beats call beats email beats research', () => {
  assert.equal(deriveNextAction(school({ whatsapp_number: '+254700000001', phone: '+254700000002' }), context()), 'WhatsApp the school today.')
  assert.equal(deriveNextAction(school({ phone: '+254700000002' }), context()), 'Call today.')
  assert.equal(deriveNextAction(school({ email: 'a@b.ac.ke' }), context()), 'Send an introductory email.')
  assert.equal(deriveNextAction(school({}), context()), 'Research contact info before reaching out.')
})

test('a known contact name is used by name, a known role falls back to a role label, otherwise "the school"', () => {
  assert.equal(
    deriveNextAction(school({ whatsapp_number: '+254700000001' }), context({ contactName: 'Jane Wanjiru' })),
    'WhatsApp Jane Wanjiru today.',
  )
  assert.equal(
    deriveNextAction(school({ whatsapp_number: '+254700000001' }), context({ contactRole: 'deputy' })),
    'WhatsApp the deputy today.',
  )
})

test('already contacted (has activity) shifts to a follow-up phrasing, not a first-contact one', () => {
  assert.equal(deriveNextAction(school({ whatsapp_number: '+254700000001' }), context({ hasAnyActivity: true })), 'Follow up with the school on WhatsApp.')
  assert.equal(deriveNextAction(school({ phone: '+254700000001' }), context({ hasAnyActivity: true })), 'Call to check in.')
})
