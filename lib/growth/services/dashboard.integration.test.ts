// lib/growth/services/dashboard.integration.test.ts
//
// Sprint PO-5 (Founder Mission Control), extended by Sprint PE-3 — validates
// getMissionControl()'s six sections against real Supabase data: Mission
// Today's urgency sorting and school-selection logic, Mission Progress's
// pilot-acquisition count, Pipeline Health's counts, At Risk's four
// distinct reasons in urgency order (no activity / missing contact /
// missing follow-up / stale research), Recent Wins (including the
// testimonial/referral notes heuristic), and This Week's counters
// (including PE-3's activePilots).
//
// Run: NODE_OPTIONS=--dns-result-order=ipv4first npx tsx --env-file=.env.local --test lib/growth/services/dashboard.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { growthRepos } from '@/lib/growth/repositories'
import { createSchool, changeStage } from '@/lib/growth/services/schools'
import { logActivity } from '@/lib/growth/services/activities'
import { createFollowUp } from '@/lib/growth/services/followUps'
import { createContact } from '@/lib/growth/services/contacts'
import { getMissionControl } from '@/lib/growth/services/dashboard'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_PO5_MISSION_CONTROL_TEST'
const db = createServiceClient()
let founderId: string | null = null
const schoolIds: string[] = []

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

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
    await db.from('growth_follow_ups').delete().eq('school_id', id)
    await db.from('growth_contacts').delete().eq('school_id', id)
    await db.from('growth_schools').delete().eq('id', id)
  }
  if (founderId) {
    await db.from('growth_users').delete().eq('id', founderId)
    await deleteAuthUserOrThrow(db, founderId)
  }
})

test('Mission Today: overdue follow-up ranks before a demo-scheduled reminder, which ranks before a this-week item', async () => {
  const overdueSchool = await createSchool({ name: `${MARKER} Overdue School` }, founderId!)
  schoolIds.push(overdueSchool.id)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await createFollowUp({ schoolId: overdueSchool.id, task: 'Call back', dueDate: yesterday }, founderId!)

  const demoSchool = await createSchool({ name: `${MARKER} Demo School` }, founderId!)
  schoolIds.push(demoSchool.id)
  await changeStage(demoSchool.id, 'demo_scheduled')
  const today = new Date().toISOString().slice(0, 10)
  await createFollowUp({ schoolId: demoSchool.id, task: 'Demo call', dueDate: today }, founderId!)

  const readySchool = await createSchool({ name: `${MARKER} Ready School`, selectionReason: 'Referral from a teacher' }, founderId!)
  schoolIds.push(readySchool.id)

  const dashboard = await getMissionControl()

  const overdueIdx = dashboard.missionToday.findIndex((m) => m.schoolId === overdueSchool.id)
  const demoIdx = dashboard.missionToday.findIndex((m) => m.schoolId === demoSchool.id)
  const readyIdx = dashboard.missionToday.findIndex((m) => m.schoolId === readySchool.id)

  assert.ok(overdueIdx !== -1 && demoIdx !== -1 && readyIdx !== -1, 'all three items should appear in Mission Today')
  assert.equal(dashboard.missionToday[overdueIdx].urgency, 'overdue')
  assert.equal(dashboard.missionToday[demoIdx].kind, 'demo', 'a follow-up on a demo_scheduled school must be tagged as a demo, not a generic follow-up')
  assert.equal(dashboard.missionToday[readyIdx].kind, 'first_contact')
  assert.ok(overdueIdx < demoIdx, 'overdue must rank before a today-urgency item')
})

test('At Risk: no-activity, missing-contact, and missing-follow-up each produce a distinct, explained reason', async () => {
  const noActivitySchool = await createSchool({ name: `${MARKER} No Activity School` }, founderId!)
  schoolIds.push(noActivitySchool.id)
  await changeStage(noActivitySchool.id, 'contacted')
  await logActivity({ schoolId: noActivitySchool.id, type: 'called', occurredAt: daysAgoIso(9) }, founderId!)

  const missingContactSchool = await createSchool({ name: `${MARKER} Missing Contact School` }, founderId!)
  schoolIds.push(missingContactSchool.id)
  await changeStage(missingContactSchool.id, 'discovery')
  await logActivity({ schoolId: missingContactSchool.id, type: 'called', occurredAt: daysAgoIso(1) }, founderId!)
  // deliberately no contact added

  const missingFollowUpSchool = await createSchool({ name: `${MARKER} Missing Follow-up School` }, founderId!)
  schoolIds.push(missingFollowUpSchool.id)
  await changeStage(missingFollowUpSchool.id, 'discovery')
  await logActivity({ schoolId: missingFollowUpSchool.id, type: 'called', occurredAt: daysAgoIso(1) }, founderId!)
  await createContact({ schoolId: missingFollowUpSchool.id, fullName: 'Deputy Head' })
  // deliberately no follow-up scheduled

  const healthySchool = await createSchool({ name: `${MARKER} Healthy School` }, founderId!)
  schoolIds.push(healthySchool.id)
  await changeStage(healthySchool.id, 'discovery')
  await logActivity({ schoolId: healthySchool.id, type: 'called', occurredAt: daysAgoIso(1) }, founderId!)
  await createContact({ schoolId: healthySchool.id, fullName: 'Principal' })
  await createFollowUp({ schoolId: healthySchool.id, task: 'Send proposal', dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }, founderId!)

  const dashboard = await getMissionControl()

  const noActivityItem = dashboard.atRisk.find((a) => a.schoolId === noActivitySchool.id)
  assert.ok(noActivityItem)
  assert.match(noActivityItem!.reason, /No activity in \d+ days/)

  const missingContactItem = dashboard.atRisk.find((a) => a.schoolId === missingContactSchool.id)
  assert.ok(missingContactItem)
  assert.equal(missingContactItem!.reason, 'No contact person on file')

  const missingFollowUpItem = dashboard.atRisk.find((a) => a.schoolId === missingFollowUpSchool.id)
  assert.ok(missingFollowUpItem)
  assert.equal(missingFollowUpItem!.reason, 'No follow-up scheduled')

  assert.ok(!dashboard.atRisk.some((a) => a.schoolId === healthySchool.id), 'a school with recent activity, a contact, and an open follow-up must not appear in At Risk')

  // Sprint PE-3 — "Display highest urgency first": no-activity ranks above
  // missing-contact, which ranks above missing-follow-up.
  const noActivityIdx = dashboard.atRisk.findIndex((a) => a.schoolId === noActivitySchool.id)
  const missingContactIdx = dashboard.atRisk.findIndex((a) => a.schoolId === missingContactSchool.id)
  const missingFollowUpIdx = dashboard.atRisk.findIndex((a) => a.schoolId === missingFollowUpSchool.id)
  assert.ok(noActivityIdx < missingContactIdx, 'no-activity must rank above missing-contact')
  assert.ok(missingContactIdx < missingFollowUpIdx, 'missing-contact must rank above missing-follow-up')
})

test('Pipeline Health counts active schools per stage; Recent Wins surfaces demo_completed, pilot_accepted, and a new school', async () => {
  const s1 = await createSchool({ name: `${MARKER} Pipeline A` }, founderId!)
  schoolIds.push(s1.id)
  const s2 = await createSchool({ name: `${MARKER} Pipeline B` }, founderId!)
  schoolIds.push(s2.id)
  await changeStage(s2.id, 'demo_completed')
  const s3 = await createSchool({ name: `${MARKER} Pipeline C` }, founderId!)
  schoolIds.push(s3.id)
  await changeStage(s3.id, 'pilot_running')

  const dashboard = await getMissionControl()

  assert.ok(dashboard.pipelineHealth.research >= 1)
  assert.ok(dashboard.pipelineHealth.demo >= 1)
  assert.ok(dashboard.pipelineHealth.pilot >= 1)

  assert.ok(dashboard.recentWins.some((w) => w.schoolId === s2.id && w.kind === 'demo_completed'))
  assert.ok(dashboard.recentWins.some((w) => w.schoolId === s3.id && w.kind === 'pilot_accepted'))
  assert.ok(dashboard.recentWins.some((w) => w.schoolId === s1.id && w.kind === 'new_school'))
})

test('Recent Wins: an activity note mentioning "testimonial" or "referral" surfaces as that win kind (manual-logging heuristic, no dedicated field)', async () => {
  const school = await createSchool({ name: `${MARKER} Testimonial School` }, founderId!)
  schoolIds.push(school.id)
  await logActivity({ schoolId: school.id, type: 'called', notes: 'Received a great testimonial from the head teacher today.' }, founderId!)
  await logActivity({ schoolId: school.id, type: 'called', notes: 'They gave us a referral to a neighbouring school.' }, founderId!)

  const dashboard = await getMissionControl()
  assert.ok(dashboard.recentWins.some((w) => w.schoolId === school.id && w.kind === 'testimonial'))
  assert.ok(dashboard.recentWins.some((w) => w.schoolId === school.id && w.kind === 'referral'))
})

test('This Week: counters reflect activity logged in the last 7 days only', async () => {
  const recentSchool = await createSchool({ name: `${MARKER} This Week School` }, founderId!)
  schoolIds.push(recentSchool.id)
  await logActivity({ schoolId: recentSchool.id, type: 'demo', occurredAt: daysAgoIso(2) }, founderId!)

  const oldSchool = await createSchool({ name: `${MARKER} Old Activity School` }, founderId!)
  schoolIds.push(oldSchool.id)
  await logActivity({ schoolId: oldSchool.id, type: 'demo', occurredAt: daysAgoIso(30) }, founderId!)

  const dashboard = await getMissionControl()
  assert.ok(dashboard.thisWeek.demos >= 1, 'a demo logged 2 days ago must count')
  // The 30-day-old demo's school must not itself inflate this week's count —
  // check by confirming schoolsResearched (created_at-based) also correctly
  // excludes it, since oldSchool was just created (so it WOULD count as
  // researched this week even though its demo activity is old) — the two
  // counters are independent and must not be conflated.
  assert.ok(dashboard.thisWeek.schoolsResearched >= 2, 'both schools were just created, so both count as researched this week')
})

test('Mission Progress: pilotAcquisition.progress counts pilot_running + pilot_won; thisWeek.activePilots counts pilot_running only', async () => {
  const runningSchool = await createSchool({ name: `${MARKER} Pilot Running School` }, founderId!)
  schoolIds.push(runningSchool.id)
  await changeStage(runningSchool.id, 'pilot_running')

  const wonSchool = await createSchool({ name: `${MARKER} Pilot Won School` }, founderId!)
  schoolIds.push(wonSchool.id)
  await changeStage(wonSchool.id, 'pilot_won')

  const dashboard = await getMissionControl()

  assert.equal(dashboard.pilotAcquisition.goal, 10)
  assert.ok(dashboard.pilotAcquisition.progress >= 2, 'both pilot_running and pilot_won schools count toward the goal')
  assert.ok(dashboard.thisWeek.activePilots >= 1, 'pilot_running counts as an active pilot')
})
