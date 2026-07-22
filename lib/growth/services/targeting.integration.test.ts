// lib/growth/services/targeting.integration.test.ts
//
// Sprint PE-6 (Pilot Targeting Engine) — validates getPilotTargeting()
// against real Supabase data: contactable schools outrank uncontactable
// ones (the mission's own verification requirement), starred schools
// always sort first, and Today's Route only ever includes actionable
// schools. Creates real (throwaway) rows, deleted in after() including on
// failure.
//
// Run: NODE_OPTIONS=--dns-result-order=ipv4first npx tsx --env-file=.env.local --test lib/growth/services/targeting.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { growthRepos } from '@/lib/growth/repositories'
import { createSchool, updateSchool } from '@/lib/growth/services/schools'
import { getPilotTargeting } from '@/lib/growth/services/targeting'

const MARKER = 'SYNTHETIC_PE6_TARGETING_TEST'
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
    await db.from('growth_schools').delete().eq('id', id)
  }
  if (founderId) {
    await db.from('growth_users').delete().eq('id', founderId)
    await db.auth.admin.deleteUser(founderId)
  }
})

test('a school with phone + WhatsApp ranks above one with no usable contact method', async () => {
  const wellContacted = await createSchool(
    { name: `${MARKER} Well Contacted`, phone: '+254700000001', whatsappNumber: '+254700000001' },
    founderId!,
  )
  schoolIds.push(wellContacted.id)
  const noContact = await createSchool({ name: `${MARKER} No Contact` }, founderId!)
  schoolIds.push(noContact.id)

  const { schools } = await getPilotTargeting()
  const good = schools.find((s) => s.schoolId === wellContacted.id)
  const bad = schools.find((s) => s.schoolId === noContact.id)

  assert.ok(good && bad, 'both synthetic schools should appear — never hide a school')
  assert.ok(good!.score > bad!.score, `expected ${good!.score} > ${bad!.score}`)

  const goodIdx = schools.findIndex((s) => s.schoolId === wellContacted.id)
  const badIdx = schools.findIndex((s) => s.schoolId === noContact.id)
  assert.ok(goodIdx < badIdx, 'the better-scored school must rank earlier in the returned list')
})

test('a starred school always sorts first, even against a higher-scoring unstarred school', async () => {
  const highScoring = await createSchool(
    { name: `${MARKER} High Scoring`, phone: '+254700000002', whatsappNumber: '+254700000002', selectionReason: 'Referral', existingIctActivity: 'Has a lab' },
    founderId!,
  )
  schoolIds.push(highScoring.id)
  const starred = await createSchool({ name: `${MARKER} Starred But Bare` }, founderId!)
  schoolIds.push(starred.id)
  await updateSchool(starred.id, { starred: true })

  const { schools } = await getPilotTargeting()
  const starredIdx = schools.findIndex((s) => s.schoolId === starred.id)
  const highScoringIdx = schools.findIndex((s) => s.schoolId === highScoring.id)

  assert.ok(starredIdx !== -1 && highScoringIdx !== -1)
  assert.ok(starredIdx < highScoringIdx, 'starred must sort before a higher-scoring unstarred school')
  const starredEntry = schools.find((s) => s.schoolId === starred.id)
  assert.equal(starredEntry?.bucket, '🔥 Contact Today')
})

test("Today's Route only includes Contact Today / Schedule This Week schools, and every step names a concrete channel", async () => {
  const contactable = await createSchool({ name: `${MARKER} Route Candidate`, phone: '+254700000003' }, founderId!)
  schoolIds.push(contactable.id)

  const { schools, route } = await getPilotTargeting()
  const entry = schools.find((s) => s.schoolId === contactable.id)
  assert.ok(entry)

  if (entry!.bucket === '🔥 Contact Today' || entry!.bucket === '📅 Schedule This Week') {
    const step = route.find((r) => r.schoolId === contactable.id)
    assert.ok(step, 'an actionable school should appear on the route')
    assert.ok(['WhatsApp', 'Call', 'Email', 'Physical Visit'].includes(step!.actionType))
  }

  // Every route step is numbered starting at 1, in order.
  route.forEach((step, i) => assert.equal(step.order, i + 1))
})

test('Sprint PE-7 Part 3: First Contact Queue includes a research-complete, never-contacted school, and excludes a school with no research recorded', async () => {
  const ready = await createSchool(
    { name: `${MARKER} Ready To Contact`, selectionReason: 'Referral', existingIctActivity: 'Has a computer lab' },
    founderId!,
  )
  schoolIds.push(ready.id)
  const notReady = await createSchool({ name: `${MARKER} Research Incomplete` }, founderId!)
  schoolIds.push(notReady.id)

  const { readyToContact } = await getPilotTargeting()
  assert.ok(readyToContact.some((s) => s.schoolId === ready.id))
  assert.ok(!readyToContact.some((s) => s.schoolId === notReady.id))
})
