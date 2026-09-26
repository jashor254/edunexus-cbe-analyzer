// lib/kiswahili/inshaBilling.test.ts
//
// Proves the Insha Marking Pack: KES 100 marks 40 essays, the 41st opens a new
// pack, covered teachers are never metered, and nothing is charged or counted
// until feedback succeeds. No real DB — access and repositories mocked.
//
// Run with: npm test -- lib/kiswahili/inshaBilling.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Access =
  | { allowed: true; tier: 'teacher' | 'subscriber'; deductTokens: false; userId: string }
  | { allowed: true; tier: 'token'; deductTokens: true; cost: number; userId: string }
  | { allowed: false; reason: 'unauthenticated' | 'insufficient_tokens' | 'no_access' }

let access: Access
let usage: Record<string, number> = {}
let deducted: Array<{ feature: string; cost: number }> = []
let recorded: string[] = []

mock.module('@/lib/payments/access', {
  namedExports: {
    checkFeatureAccess: async () => access,
    deductFeatureTokens: async (_userId: string, feature: string, cost: number) => { deducted.push({ feature, cost }) },
  },
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      billing: {
        countTokenUsage: async (_userId: string, action: string) => usage[action] ?? 0,
        recordFreeUsage: async (_userId: string, action: string) => { recorded.push(action) },
      },
    },
  },
})

let essaysRemaining: typeof import('./inshaBilling').essaysRemaining
let resolveInshaCharge: typeof import('./inshaBilling').resolveInshaCharge
let recordInshaEssay: typeof import('./inshaBilling').recordInshaEssay

before(async () => {
  ;({ essaysRemaining, resolveInshaCharge, recordInshaEssay } = await import('./inshaBilling'))
})

const PAID: Access = { allowed: true, tier: 'token', deductTokens: true, cost: 2, userId: 'u' }
const BROKE: Access = { allowed: false, reason: 'insufficient_tokens' }

beforeEach(() => {
  usage = {}
  deducted = []
  recorded = []
})

test('essaysRemaining: one pack is 40 essays, never negative', () => {
  assert.equal(essaysRemaining(1, 0, 40), 40)
  assert.equal(essaysRemaining(1, 39, 40), 1)
  assert.equal(essaysRemaining(1, 40, 40), 0)
  assert.equal(essaysRemaining(0, 5, 40), 0)
  assert.equal(essaysRemaining(2, 41, 40), 39)
})

test('a school-covered teacher is never metered', async () => {
  access = { allowed: true, tier: 'teacher', deductTokens: false, userId: 'u' }
  const charge = await resolveInshaCharge('u')
  assert.deepEqual(charge, { allowed: true, userId: 'u', metered: false })
  if (charge.allowed) await recordInshaEssay(charge)
  assert.deepEqual(deducted, [])
  assert.deepEqual(recorded, [])
})

test('the first essay with a paid balance opens a pack — charged once, then counted', async () => {
  access = PAID
  const charge = await resolveInshaCharge('u')
  assert.equal(charge.allowed && charge.metered && charge.opensPack, true)
  if (charge.allowed) await recordInshaEssay(charge)
  assert.deepEqual(deducted, [{ feature: 'kiswahili_insha_pack', cost: 2 }])
  assert.deepEqual(recorded, ['kiswahili_insha_essay'])
})

test('essays 2–40 of an open pack cost nothing more, even with no balance left', async () => {
  access = BROKE
  usage = { kiswahili_insha_pack: 1, kiswahili_insha_essay: 39 }
  const charge = await resolveInshaCharge('u')
  assert.equal(charge.allowed && charge.metered && !charge.opensPack, true)
  if (charge.allowed) await recordInshaEssay(charge)
  assert.deepEqual(deducted, [])
  assert.deepEqual(recorded, ['kiswahili_insha_essay'])
})

test('essay 41 with no balance asks for payment', async () => {
  access = BROKE
  usage = { kiswahili_insha_pack: 1, kiswahili_insha_essay: 40 }
  assert.deepEqual(await resolveInshaCharge('u'), { allowed: false, reason: 'payment_required' })
})

test('essay 41 with a balance opens a second pack', async () => {
  access = PAID
  usage = { kiswahili_insha_pack: 1, kiswahili_insha_essay: 40 }
  const charge = await resolveInshaCharge('u')
  assert.equal(charge.allowed && charge.metered && charge.opensPack, true)
})

test('a brand-new teacher with no pack and no balance asks for payment', async () => {
  access = BROKE
  assert.deepEqual(await resolveInshaCharge('u'), { allowed: false, reason: 'payment_required' })
})

test('an unauthenticated request is refused, not sent to the paywall', async () => {
  access = { allowed: false, reason: 'unauthenticated' }
  assert.deepEqual(await resolveInshaCharge('u'), { allowed: false, reason: 'unauthenticated' })
})
