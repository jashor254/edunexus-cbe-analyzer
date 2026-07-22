// lib/growth/services/pilotCampaignLaunch.integration.test.ts
//
// Sprint PE-7 (Pilot Campaign Launch) — validates the shared CSV import
// (Parts 1-2), one-click activity logging (Part 5), and the daily
// counters/end-of-day review (Parts 6-7) against real Supabase data.
// Creates real (throwaway) rows, deleted in after() including on failure.
//
// Run: NODE_OPTIONS=--dns-result-order=ipv4first npx tsx --env-file=.env.local --test lib/growth/services/pilotCampaignLaunch.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { growthRepos } from '@/lib/growth/repositories'
import { createSchool, getSchool } from '@/lib/growth/services/schools'
import { runImport, type ImportRow } from '@/lib/growth/services/csvImport'
import { logQuickAction, REPLY_TAG } from '@/lib/growth/services/activities'
import { getDailyCounters, getEndOfDayReview } from '@/lib/growth/services/campaignProgress'

const MARKER = 'SYNTHETIC_PE7_CAMPAIGN_TEST'
const db = createServiceClient()
let founderId: string | null = null
const schoolIds: string[] = []

before(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: `${MARKER.toLowerCase()}-${Date.now()}@example.com`,
    password: 'synthetic-test-password-1',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`setup: could not create synthetic founder: ${error?.message}`)
  founderId = data.user.id
  await growthRepos.users.ensure(founderId, 'Synthetic Founder')
})

after(async () => {
  for (const id of schoolIds) {
    await db.from('growth_activities').delete().eq('school_id', id)
    await db.from('growth_schools').delete().eq('id', id)
  }
  if (founderId) {
    await db.from('growth_users').delete().eq('id', founderId)
    await db.auth.admin.deleteUser(founderId)
  }
})

function importRow(overrides: Partial<ImportRow>): ImportRow {
  return {
    name: `${MARKER} School`, county: 'Kirinyaga', category_guess: 'Girls', phone: '', website: '', email: '',
    google_rating: '', review_count: '', business_status: '', contact_source: 'google_places',
    google_maps_url: '', place_id: '', contact_quality: 'Unknown', discovery_score: '0', notes: '',
    ready_for_import: 'FALSE', whatsapp_number: '',
    ...overrides,
  }
}

test('runImport: imports a ready row, skips a not-ready row, and skips a duplicate on a second run', async () => {
  const placeId = `${MARKER}-place-1`
  const rows: ImportRow[] = [
    importRow({ name: `${MARKER} Ready School`, place_id: placeId, phone: '+254700000001', ready_for_import: 'TRUE' }),
    importRow({ name: `${MARKER} Not Ready School`, place_id: `${MARKER}-place-2`, ready_for_import: 'FALSE' }),
  ]

  const summary = await runImport(rows, founderId!)
  assert.equal(summary.schoolsImported, 1)
  assert.equal(summary.duplicatesSkipped, 0)
  assert.deepEqual(summary.importedNames, [`${MARKER} Ready School`])

  const imported = await growthRepos.schools.findByPlaceId(placeId)
  assert.ok(imported)
  schoolIds.push(imported!.id)
  assert.equal(imported!.phone, '+254700000001')

  // Second run over the same CSV must skip the now-existing school as a duplicate, not re-import it.
  const secondSummary = await runImport(rows, founderId!)
  assert.equal(secondSummary.schoolsImported, 0)
  assert.equal(secondSummary.duplicatesSkipped, 1)
})

test('logQuickAction: "Called" advances research -> contacted; never regresses on a later, earlier-stage action', async () => {
  const school = await createSchool({ name: `${MARKER} Quick Action School`, phone: '+254700000099' }, founderId!)
  schoolIds.push(school.id)

  const { newStage } = await logQuickAction({ schoolId: school.id, actionKey: 'called', currentStage: 'research' }, founderId!)
  assert.equal(newStage, 'contacted')

  const afterCall = await getSchool(school.id)
  assert.equal(afterCall.pipeline_stage, 'contacted')

  // A "Called" action fired again from 'contacted' must not regress or error.
  const { newStage: secondStage } = await logQuickAction({ schoolId: school.id, actionKey: 'called', currentStage: 'contacted' }, founderId!)
  assert.equal(secondStage, null)
})

test('logQuickAction: Pilot Declined forces the terminal `lost` stage, and the reply tag is recorded in notes', async () => {
  const school = await createSchool({ name: `${MARKER} Pilot Declined School` }, founderId!)
  schoolIds.push(school.id)

  const { activity, newStage } = await logQuickAction(
    { schoolId: school.id, actionKey: 'pilot_declined', currentStage: 'pilot_running', gotReply: true },
    founderId!,
  )
  assert.equal(newStage, 'lost')
  assert.ok(activity.notes?.includes('Pilot declined'))
  assert.ok(activity.notes?.includes(REPLY_TAG))

  const afterDecline = await getSchool(school.id)
  assert.equal(afterDecline.pipeline_stage, 'lost')
})

test('getDailyCounters / getEndOfDayReview: reflect real activity logged today, including the reply tag', async () => {
  const school = await createSchool({ name: `${MARKER} Daily Counter School`, whatsappNumber: '+254700000077' }, founderId!)
  schoolIds.push(school.id)

  await logQuickAction({ schoolId: school.id, actionKey: 'whatsapp_sent', currentStage: 'research', gotReply: true }, founderId!)

  const counters = await getDailyCounters()
  assert.ok(counters.todaysContacts >= 1)
  assert.ok(counters.todaysReplies >= 1)
  assert.equal(counters.weeklyContactGoal, 15)
  assert.equal(counters.monthlyPilotGoal, 10)

  const review = await getEndOfDayReview()
  assert.ok(review.schoolsContacted.includes(school.name))
  assert.ok(review.responses.includes(school.name))
  assert.ok(!review.noResponses.includes(school.name), 'a school that replied must not also show as a no-response')
})
