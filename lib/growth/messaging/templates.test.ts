// Run: npx tsx --test lib/growth/messaging/templates.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MESSAGE_TEMPLATES, findTemplate, coldIntroTemplateForCategory } from './templates'
import { generateMessage } from './generate'
import type { GrowthSchool } from '@/lib/growth/types'

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

test('every template generates a non-empty WhatsApp draft with no unresolved required fields other than meeting info', () => {
  for (const t of MESSAGE_TEMPLATES) {
    const draft = generateMessage({
      school: school({}), contact: null, founderName: 'Dennis', pilotSchoolsCount: 0,
      templateId: t.id, channel: 'whatsapp',
    })
    assert.ok(draft.body.length > 0, `${t.id} produced an empty body`)
    const unexpected = draft.unresolvedVariables.filter((v) => v !== 'meeting_date' && v !== 'meeting_time')
    assert.deepEqual(unexpected, [], `${t.id} left unexpected unresolved variables: ${unexpected.join(', ')}`)
  }
})

test('coldIntroTemplateForCategory maps known category strings to the right variant', () => {
  assert.equal(coldIntroTemplateForCategory('Junior Secondary').id, 'cold_intro_junior_secondary')
  assert.equal(coldIntroTemplateForCategory('Private').id, 'cold_intro_private')
  assert.equal(coldIntroTemplateForCategory('Public Secondary').id, 'cold_intro_public_secondary')
  assert.equal(coldIntroTemplateForCategory('Mixed').id, 'cold_intro_mixed')
  assert.equal(coldIntroTemplateForCategory(null).id, 'cold_intro_mixed')
})

test('findTemplate returns undefined for an unknown id', () => {
  assert.equal(findTemplate('does_not_exist'), undefined)
})
