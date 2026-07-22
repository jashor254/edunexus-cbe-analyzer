// Run: npx tsx --test lib/growth/messaging/strategy.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { determineChannelStrategy } from './strategy'
import type { GrowthSchool, GrowthContact } from '@/lib/growth/types'

function school(overrides: Partial<GrowthSchool>): GrowthSchool {
  return {
    id: 'school-1', name: 'Test School', county: 'Kirinyaga', category: 'Mixed',
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

test('prefers WhatsApp when the school has a verified WhatsApp number', () => {
  const result = determineChannelStrategy(school({ whatsapp_number: '0712345678', phone: '0700000000', email: 'a@b.com' }), [])
  assert.equal(result.channel, 'whatsapp')
  assert.match(result.reason, /Verified WhatsApp/)
})

test('prefers WhatsApp when a contact recorded it as their preference', () => {
  const result = determineChannelStrategy(school({}), [contact({ preferred_contact: 'whatsapp', phone: '0712345678' })])
  assert.equal(result.channel, 'whatsapp')
  assert.match(result.reason, /Jane Doe/)
})

test('falls back to call when only a phone number is on file', () => {
  const result = determineChannelStrategy(school({ phone: '0712345678' }), [])
  assert.equal(result.channel, 'call')
})

test('falls back to email when only an email is on file', () => {
  const result = determineChannelStrategy(school({ email: 'head@school.ac.ke' }), [])
  assert.equal(result.channel, 'email')
})

test('falls back to visit when nothing is on file', () => {
  const result = determineChannelStrategy(school({}), [])
  assert.equal(result.channel, 'visit')
})

test('contact phone/email outrank a strategy that would otherwise land on visit', () => {
  const result = determineChannelStrategy(school({}), [contact({ email: 'jane@school.ac.ke' })])
  assert.equal(result.channel, 'email')
  assert.match(result.reason, /Jane Doe/)
})
