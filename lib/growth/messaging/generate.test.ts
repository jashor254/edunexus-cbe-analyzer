// Run: npx tsx --test lib/growth/messaging/generate.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateMessage } from './generate'
import type { GrowthSchool, GrowthContact } from '@/lib/growth/types'

function school(overrides: Partial<GrowthSchool>): GrowthSchool {
  return {
    id: 'school-1', name: 'Mwatate Ridge Senior School', county: 'Taita Taveta', category: 'Public',
    students_count: null, status: 'active', pipeline_stage: 'research',
    next_action: null, next_action_date: null, owner_id: null, notes: null,
    contact_source: null, existing_ict_activity: null, selection_reason: null,
    phone: null, website: null, email: null, google_place_id: null,
    google_maps_url: null, google_rating: null, google_review_count: null,
    business_status: null, whatsapp_number: null, discovery_score: null,
    contact_quality: null, starred: false, last_contact_at: null,
    created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function contact(overrides: Partial<GrowthContact>): GrowthContact {
  return {
    id: 'contact-1', school_id: 'school-1', role: 'principal', full_name: 'Jane Doe',
    phone: null, email: null, preferred_contact: null, relationship_score: null,
    notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  }
}

test('personalizes the WhatsApp body with real school/contact/founder data', () => {
  const draft = generateMessage({
    school: school({}),
    contact: contact({}),
    founderName: 'Dennis',
    pilotSchoolsCount: 0,
    templateId: 'cold_intro_public_secondary',
    channel: 'whatsapp',
  })
  assert.match(draft.body, /Mwatate Ridge Senior School/)
  assert.match(draft.body, /Jane Doe/)
  assert.match(draft.body, /Dennis/)
  assert.equal(draft.subject, null)
  assert.deepEqual(draft.unresolvedVariables, [])
})

test('degrades gracefully to "Good day," when there is no contact on file', () => {
  const draft = generateMessage({
    school: school({}),
    contact: null,
    founderName: 'Dennis',
    pilotSchoolsCount: 0,
    templateId: 'cold_intro_public_secondary',
    channel: 'whatsapp',
  })
  assert.match(draft.body, /Good day, I'm Dennis/)
})

test('email channel uses the subject line and falls back to the whatsapp body only if no email body exists', () => {
  const draft = generateMessage({
    school: school({}),
    contact: contact({}),
    founderName: 'Dennis',
    pilotSchoolsCount: 0,
    templateId: 'cold_intro_public_secondary',
    channel: 'email',
  })
  assert.ok(draft.subject)
  assert.match(draft.subject!, /Mwatate Ridge Senior School/)
})

test('pilot_slots_remaining is computed from real pipeline counts, never fabricated', () => {
  const draft = generateMessage({
    school: school({}),
    contact: contact({}),
    founderName: 'Dennis',
    pilotSchoolsCount: 4,
    templateId: 'pilot_invitation',
    channel: 'whatsapp',
  })
  assert.match(draft.body, /6 pilot slots remaining/) // PILOT_ACQUISITION_GOAL (10) - 4
})

test('reports meeting_date/meeting_time as unresolved when not supplied', () => {
  const draft = generateMessage({
    school: school({}),
    contact: contact({}),
    founderName: 'Dennis',
    pilotSchoolsCount: 0,
    templateId: 'demo_reminder',
    channel: 'whatsapp',
  })
  assert.deepEqual(draft.unresolvedVariables.sort(), ['meeting_date', 'meeting_time'])
})

test('throws on an unknown template id', () => {
  assert.throws(() =>
    generateMessage({
      school: school({}), contact: null, founderName: 'Dennis', pilotSchoolsCount: 0,
      templateId: 'not_a_real_template', channel: 'whatsapp',
    }),
  )
})
