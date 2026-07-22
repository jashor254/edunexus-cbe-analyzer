// Run: npx tsx --test scripts/growth/enrich/report.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEnrichmentReport, type EnrichedRowSummary } from './report'

function row(overrides: Partial<EnrichedRowSummary>): EnrichedRowSummary {
  return {
    name: 'Test School',
    hadEmailBefore: false,
    hasEmailAfter: false,
    hadPhoneBefore: false,
    hasPhoneAfter: false,
    hasWhatsapp: false,
    hasFacebook: false,
    hasPrincipal: false,
    hasIctContact: false,
    contactConfidence: 'Unknown',
    contactChannelCount: 0,
    ...overrides,
  }
}

test('buildEnrichmentReport: counts emails/phones added only when gained (not already present)', () => {
  const rows = [
    row({ name: 'A', hadEmailBefore: false, hasEmailAfter: true, contactConfidence: 'High', contactChannelCount: 1 }),
    row({ name: 'B', hadEmailBefore: true, hasEmailAfter: true, contactConfidence: 'Verified', contactChannelCount: 1 }),
  ]
  const report = buildEnrichmentReport(rows)
  assert.equal(report.emailsAdded, 1, 'B already had an email — not a new addition')
  assert.equal(report.afterEmailCount, 2)
  assert.equal(report.beforeEmailCount, 1)
})

test('buildEnrichmentReport: a row with no contact method at all is zero-contact, not manual-review', () => {
  const rows = [row({ name: 'Zero Contact School' })]
  const report = buildEnrichmentReport(rows)
  assert.equal(report.zeroContactMethods, 1)
  assert.deepEqual(report.zeroContactSchools, ['Zero Contact School'])
  assert.equal(report.manualReviewRequired, 0)
})

test('buildEnrichmentReport: some contact info but Low/Unknown confidence is manual-review, not zero-contact', () => {
  const rows = [row({ name: 'Uncertain School', hasEmailAfter: true, contactConfidence: 'Low', contactChannelCount: 1 })]
  const report = buildEnrichmentReport(rows)
  assert.equal(report.manualReviewRequired, 1)
  assert.equal(report.zeroContactMethods, 0)
})

test('buildEnrichmentReport: top50 ranks by contact channel count, then confidence', () => {
  const rows = [
    row({ name: 'Low channels, high confidence', contactChannelCount: 1, contactConfidence: 'Verified' }),
    row({ name: 'High channels, low confidence', contactChannelCount: 3, contactConfidence: 'Low' }),
    row({ name: 'Same channels, better confidence', contactChannelCount: 1, contactConfidence: 'High' }),
  ]
  const report = buildEnrichmentReport(rows)
  assert.equal(report.top50[0].name, 'High channels, low confidence', 'more channels ranks first regardless of confidence')
  assert.equal(report.top50[1].name, 'Low channels, high confidence', 'ties in channel count broken by stronger confidence')
})

test('buildEnrichmentReport: schoolsEnriched only counts rows that actually gained something new', () => {
  const rows = [
    row({ name: 'Gained whatsapp', hasWhatsapp: true }),
    row({ name: 'Gained nothing (already had everything, nothing new found)', hadEmailBefore: true, hasEmailAfter: true }),
  ]
  const report = buildEnrichmentReport(rows)
  assert.equal(report.schoolsEnriched, 1)
})
