// lib/learnerBlueprint/legacyBridgeAccess.pure.test.ts
//
// Resilience regression lock for the one read that runs *before* the
// composer layer: the Core<->legacy bridge resolution. Every composer
// already degrades its own failure into an `unavailable` section (ADR-0008
// failure model, exercised by composeBlueprint.integration.test.ts's
// "one domain failing never throws"), but that guarantee only begins once
// the composers run. A rejected bridge *lookup* happens before them and, if
// unguarded, throws the whole Blueprint away before a single section is
// composed — a 500 where a degraded-but-useful Blueprint should have been.
//
// Genuinely pure: mock.module replaces `@/lib/core/identity` wholesale, so
// the real module (and its repositories/env boot) is never loaded. This
// file imports only legacyBridgeAccess, which imports only identity — hence
// zero Supabase credentials required, STANDARD-safe.
//
// Run: npm test -- lib/learnerBlueprint/legacyBridgeAccess.pure.test.ts

import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { asLearnerId, asStudentId } from '@/lib/core/identityTypes'

let resolveBehavior: 'throws' | 'null' | 'resolves' = 'throws'

mock.module('@/lib/core/identity', {
  namedExports: {
    resolveLegacyStudentId: async () => {
      if (resolveBehavior === 'throws') {
        throw new Error('simulated bridge-lookup query failure')
      }
      if (resolveBehavior === 'null') {
        return null
      }
      return asStudentId('student-legacy-1')
    },
  },
})

// Imported after the mock is registered, via before() rather than a
// top-level await (unsupported under the CJS transform the test runner uses).
let resolveLegacyStudentIdOrDegrade: typeof import('./legacyBridgeAccess')['resolveLegacyStudentIdOrDegrade']
before(async () => {
  ;({ resolveLegacyStudentIdOrDegrade } = await import('./legacyBridgeAccess'))
})

const learner = asLearnerId('11111111-1111-4111-8111-111111111111')

test('returns null (does not reject) when the bridge lookup throws', async () => {
  resolveBehavior = 'throws'
  // Must resolve, never reject — the whole point: a failed lookup must not
  // propagate out of the Blueprint's pre-composer phase.
  const result = await resolveLegacyStudentIdOrDegrade(learner)
  assert.equal(result, null)
})

test('passes through null for the ordinary "no bridge yet" case', async () => {
  resolveBehavior = 'null'
  const result = await resolveLegacyStudentIdOrDegrade(learner)
  assert.equal(result, null)
})

test('passes through a resolved legacy id unchanged', async () => {
  resolveBehavior = 'resolves'
  const result = await resolveLegacyStudentIdOrDegrade(learner)
  assert.equal(result, asStudentId('student-legacy-1'))
})
