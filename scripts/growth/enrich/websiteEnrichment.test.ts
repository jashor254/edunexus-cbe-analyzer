// Run: npx tsx --test scripts/growth/enrich/websiteEnrichment.test.ts
// Only the pure URL-building logic is tested here — crawlWebsite() itself makes
// real network calls and is exercised via the sample-run verification instead.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { candidateContactUrls } from './websiteEnrichment'

test('candidateContactUrls: homepage + contact/contact-us/about/about-us, trailing slash stripped', () => {
  assert.deepEqual(candidateContactUrls('https://school.ac.ke/'), [
    'https://school.ac.ke',
    'https://school.ac.ke/contact',
    'https://school.ac.ke/contact-us',
    'https://school.ac.ke/about',
    'https://school.ac.ke/about-us',
  ])
})

test('candidateContactUrls: a blank website yields no candidates (never fabricates a URL to try)', () => {
  assert.deepEqual(candidateContactUrls(''), [])
  assert.deepEqual(candidateContactUrls('   '), [])
})
