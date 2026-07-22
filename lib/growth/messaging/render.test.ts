// Run: npx tsx --test lib/growth/messaging/render.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTemplate } from './render'

test('substitutes known variables', () => {
  const { text, unresolved } = renderTemplate('Hello {{school_name}}', { school_name: 'Mwatate Ridge' })
  assert.equal(text, 'Hello Mwatate Ridge')
  assert.deepEqual(unresolved, [])
})

test('collapses an unknown _greeting token to empty string, not left visible', () => {
  const { text, unresolved } = renderTemplate('Good day{{contact_name_greeting}},', { contact_name_greeting: null })
  assert.equal(text, 'Good day,')
  assert.deepEqual(unresolved, [])
})

test('leaves a non-greeting unknown token in place and reports it as unresolved', () => {
  const { text, unresolved } = renderTemplate('Meet on {{meeting_date}}', { meeting_date: null })
  assert.equal(text, 'Meet on {{meeting_date}}')
  assert.deepEqual(unresolved, ['meeting_date'])
})

test('reports each unresolved token only once even if it repeats', () => {
  const { unresolved } = renderTemplate('{{meeting_date}} and again {{meeting_date}}', { meeting_date: null })
  assert.deepEqual(unresolved, ['meeting_date'])
})
