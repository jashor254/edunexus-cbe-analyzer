// Run: npx tsx --test data/schoolConcepts/capabilityRegistry.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAPABILITY_REGISTRY } from './capabilityRegistry'

test('parentPortal resolves from one canonical registry definition', () => {
  const def = CAPABILITY_REGISTRY.parentPortal
  assert.equal(def.id, 'parentPortal')
  assert.equal(def.category, 'operational')
  assert.equal(def.delivery, 'edunexus-route')
  assert.equal(def.visibility, 'authenticated')
  assert.deepEqual(def.allowedRoles, ['parent'])
  assert.equal(def.contentOwner, 'edunexus')
})

test('every registry entry keys itself consistently (id matches its map key)', () => {
  for (const [key, def] of Object.entries(CAPABILITY_REGISTRY)) {
    assert.equal(def.id, key, `registry entry "${key}" has mismatched id "${def.id}"`)
  }
})

test('every edunexus-route capability has a non-empty canonical route', () => {
  for (const def of Object.values(CAPABILITY_REGISTRY)) {
    if (def.delivery === 'edunexus-route') {
      assert.ok(def.route && def.route.length > 0, `"${def.id}" is edunexus-route but has no route`)
    }
  }
})

test('every authenticated capability is not indexable by default', () => {
  for (const def of Object.values(CAPABILITY_REGISTRY)) {
    if (def.visibility === 'authenticated') {
      assert.equal(def.indexableByDefault, false, `"${def.id}" is authenticated but indexableByDefault is true`)
    }
  }
})

test('every capability declares at least one allowed role', () => {
  for (const def of Object.values(CAPABILITY_REGISTRY)) {
    assert.ok(def.allowedRoles.length > 0, `"${def.id}" has no allowed roles`)
  }
})
