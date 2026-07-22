// Run: npx tsx --test lib/growth/messaging/links.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeKenyanPhone, buildWhatsAppLink, buildTelLink, buildMailtoLink } from './links'

test('normalizes a 07... number to 2547...', () => {
  assert.equal(normalizeKenyanPhone('0712345678'), '254712345678')
})

test('normalizes a +254... number by stripping non-digits', () => {
  assert.equal(normalizeKenyanPhone('+254 712 345 678'), '254712345678')
})

test('leaves an already-bare 254... number as-is', () => {
  assert.equal(normalizeKenyanPhone('254712345678'), '254712345678')
})

test('builds a wa.me link with the message URL-encoded', () => {
  const link = buildWhatsAppLink('0712345678', 'Hello there')
  assert.equal(link, 'https://wa.me/254712345678?text=Hello%20there')
})

test('builds a tel: link with a leading +', () => {
  assert.equal(buildTelLink('0712345678'), 'tel:+254712345678')
})

test('builds a mailto: link with subject and body params', () => {
  const link = buildMailtoLink('head@school.ac.ke', 'Hi', 'Body text')
  assert.equal(link, 'mailto:head@school.ac.ke?subject=Hi&body=Body+text')
})
