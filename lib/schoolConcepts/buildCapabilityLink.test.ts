// Run: npx tsx --test lib/schoolConcepts/buildCapabilityLink.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCapabilityLink } from './buildCapabilityLink'
import { CAPABILITY_REGISTRY } from '@/data/schoolConcepts/capabilityRegistry'

test('enabled capability builds the registry-canonical destination', () => {
  const href = buildCapabilityLink({ state: 'enabled', id: 'parentPortal', label: 'Parent Portal', destination: CAPABILITY_REGISTRY.parentPortal.route })
  assert.equal(href, CAPABILITY_REGISTRY.parentPortal.route)
})

test('disabled capability builds no link', () => {
  const href = buildCapabilityLink({ state: 'disabled', id: 'parentPortal' })
  assert.equal(href, null)
})
