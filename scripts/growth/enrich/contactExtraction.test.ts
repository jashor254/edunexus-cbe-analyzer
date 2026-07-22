// Run: npx tsx --test scripts/growth/enrich/contactExtraction.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractEmails, extractPhones, extractWhatsAppNumbers,
  extractFacebookUrl, extractInstagramUrl, extractLinkedinUrl,
  extractLabeledName, LABEL_PATTERNS, extractAll,
} from './contactExtraction'

test('extractEmails: finds a real email and excludes denylisted tracker/library domains', () => {
  const html = `<p>Contact us: admissions@kerugoyagirls.ac.ke</p><script src="x.sentry.io/y@sentry.io"></script>`
  assert.deepEqual(extractEmails(html), ['admissions@kerugoyagirls.ac.ke'])
})

test('extractEmails: dedupes and lowercases', () => {
  const html = `Info@School.ac.ke and info@school.ac.ke`
  assert.deepEqual(extractEmails(html), ['info@school.ac.ke'])
})

test('extractPhones: matches +254 and local 07xx formats, dedupes and strips separators', () => {
  const html = `Call +254 722 858224 or 0722-858224`
  assert.deepEqual(extractPhones(html), ['+254722858224'])
})

test('extractWhatsAppNumbers: only from wa.me / api.whatsapp.com links, not bare numbers near the word', () => {
  const html = `<a href="https://wa.me/254722858224">WhatsApp us</a> or call 0722858224`
  assert.deepEqual(extractWhatsAppNumbers(html), ['254722858224'])
})

test('extractWhatsAppNumbers: api.whatsapp.com/send?phone= form', () => {
  const html = `<a href="https://api.whatsapp.com/send?phone=254722858224">Chat</a>`
  assert.deepEqual(extractWhatsAppNumbers(html), ['254722858224'])
})

test('extractFacebookUrl: excludes share/sharer links', () => {
  const html = `<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a><a href="https://www.facebook.com/kerugoyagirls">Follow us</a>`
  assert.equal(extractFacebookUrl(html), 'https://www.facebook.com/kerugoyagirls')
})

test('extractInstagramUrl / extractLinkedinUrl', () => {
  assert.equal(extractInstagramUrl(`<a href="https://instagram.com/kerugoyagirls">IG</a>`), 'https://instagram.com/kerugoyagirls')
  assert.equal(extractLinkedinUrl(`<a href="https://linkedin.com/company/kerugoyagirls">LI</a>`), 'https://linkedin.com/company/kerugoyagirls')
})

test('extractLabeledName: finds a name immediately after a label', () => {
  assert.equal(extractLabeledName('Principal: Jane Wanjiru Muthoni', LABEL_PATTERNS.principal), 'Jane Wanjiru Muthoni')
  assert.equal(extractLabeledName('Deputy Principal - John Kamau', LABEL_PATTERNS.deputy), 'John Kamau')
})

test('extractLabeledName: returns null rather than guessing when no name follows the label', () => {
  assert.equal(extractLabeledName('Our Principal leads with excellence.', LABEL_PATTERNS.principal), null)
  assert.equal(extractLabeledName('<h2>Principal</h2><p>No name given here.</p>', LABEL_PATTERNS.principal), null)
})

test('extractLabeledName: never invents a person for a page that never mentions the role', () => {
  assert.equal(extractLabeledName('Welcome to our school website.', LABEL_PATTERNS.ict), null)
})

test('extractAll: runs every extractor in one pass', () => {
  const html = `
    <p>Email: info@school.ac.ke</p>
    <p>Phone: +254722858224</p>
    <a href="https://wa.me/254722858224">WhatsApp</a>
    <a href="https://www.facebook.com/school">FB</a>
    <p>Principal: Jane Wanjiru</p>
  `
  const result = extractAll(html)
  assert.deepEqual(result.emails, ['info@school.ac.ke'])
  assert.deepEqual(result.phones, ['+254722858224'])
  assert.deepEqual(result.whatsapp, ['254722858224'])
  assert.deepEqual(result.facebookUrls, ['https://www.facebook.com/school'])
  assert.equal(result.principalName, 'Jane Wanjiru')
  assert.equal(result.deputyName, null)
})
