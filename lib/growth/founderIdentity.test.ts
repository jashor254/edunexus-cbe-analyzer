import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFounderIdentity } from './founderIdentity'

test('matches the configured founder, ignoring case and surrounding whitespace', () => {
  assert.equal(isFounderIdentity('Founder@Example.invalid', ' founder@example.invalid '), true)
})
test('a different identity never matches', () => {
  assert.equal(isFounderIdentity('teacher@example.invalid', 'founder@example.invalid'), false)
})
test('fails closed when the founder email is unset, empty or blank', () => {
  for (const unset of [undefined, null, '', '   ']) {
    assert.equal(isFounderIdentity('founder@example.invalid', unset), false)
  }
})
test('fails closed when the caller has no email, even if the founder email is unset too', () => {
  for (const none of [undefined, null, '', ' ']) {
    assert.equal(isFounderIdentity(none, 'founder@example.invalid'), false)
    assert.equal(isFounderIdentity(none, none), false)
  }
})
test('no partial, prefix or sub-address matching', () => {
  assert.equal(isFounderIdentity('founder@example.invalid.evil.test', 'founder@example.invalid'), false)
  assert.equal(isFounderIdentity('founder+x@example.invalid', 'founder@example.invalid'), false)
  assert.equal(isFounderIdentity('xfounder@example.invalid', 'founder@example.invalid'), false)
})
