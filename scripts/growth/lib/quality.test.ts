// Run: npx tsx --test scripts/growth/lib/quality.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySchool,
  computeContactQuality,
  computeDiscoveryScore,
  normalizeSchoolName,
  dedupKey,
  buildResearchNotes,
  summarizeDiscovery,
} from './quality'
import { newDiscoveryRow, type DiscoveryCsvRow } from './schema'

// ── classifySchool ────────────────────────────────────────────────────────

test('classifySchool: junior beats every other signal', () => {
  assert.equal(classifySchool('Kerugoya Girls Junior Secondary School'), 'Junior Secondary')
})

test('classifySchool: academy/preparatory/montessori', () => {
  assert.equal(classifySchool('Bright Kids Academy'), 'Academy')
  assert.equal(classifySchool('Sunrise Preparatory School'), 'Academy')
})

test('classifySchool: girls and boys', () => {
  assert.equal(classifySchool('Kerugoya Girls High School'), 'Girls')
  assert.equal(classifySchool('Kutus Boys Secondary'), 'Boys')
})

test('classifySchool: mixed day', () => {
  assert.equal(classifySchool('Sagana Mixed Day Secondary School'), 'Mixed Day')
})

test('classifySchool: private/international', () => {
  assert.equal(classifySchool('Kirinyaga International School'), 'Private Secondary')
})

test('classifySchool: generic secondary/high school falls back to Public Secondary', () => {
  assert.equal(classifySchool('Baricho Secondary School'), 'Public Secondary')
})

test('classifySchool: nothing recognizable is Unknown', () => {
  assert.equal(classifySchool('Wanguru Centre'), 'Unknown')
})

// ── computeDiscoveryScore ─────────────────────────────────────────────────

test('computeDiscoveryScore: all five signals present scores 100', () => {
  const score = computeDiscoveryScore({ website: 'https://x.ac.ke', phone: '0700000000', email: 'a@x.ac.ke', googleRating: '4.2', reviewCount: '25' })
  assert.equal(score, 100)
})

test('computeDiscoveryScore: nothing present scores 0', () => {
  const score = computeDiscoveryScore({ website: '', phone: '', email: '', googleRating: '', reviewCount: '' })
  assert.equal(score, 0)
})

test('computeDiscoveryScore: review count at or below threshold does not add the review-volume signal', () => {
  const score = computeDiscoveryScore({ website: '', phone: '', email: '', googleRating: '', reviewCount: '10' })
  assert.equal(score, 0)
  const scoreAbove = computeDiscoveryScore({ website: '', phone: '', email: '', googleRating: '', reviewCount: '11' })
  assert.equal(scoreAbove, 20)
})

// ── computeContactQuality ─────────────────────────────────────────────────

test('computeContactQuality: all three present is High', () => {
  assert.equal(computeContactQuality({ phone: '0700000000', website: 'https://x.ac.ke', email: 'a@x.ac.ke' }), 'High')
})

test('computeContactQuality: two present is Medium', () => {
  assert.equal(computeContactQuality({ phone: '0700000000', website: 'https://x.ac.ke', email: '' }), 'Medium')
})

test('computeContactQuality: one present is Low', () => {
  assert.equal(computeContactQuality({ phone: '0700000000', website: '', email: '' }), 'Low')
})

test('computeContactQuality: none present is Unknown', () => {
  assert.equal(computeContactQuality({ phone: '', website: '', email: '' }), 'Unknown')
})

// ── dedup ─────────────────────────────────────────────────────────────────

test('normalizeSchoolName: strips punctuation and collapses whitespace', () => {
  assert.equal(normalizeSchoolName("St. Mary's  Girls  Secondary!"), 'st marys girls secondary')
})

test('dedupKey: prefers phone over website over name', () => {
  assert.equal(dedupKey({ name: 'A School', phone: '0700000000', website: 'https://a.ac.ke' }), 'phone:0700000000')
  assert.equal(dedupKey({ name: 'A School', phone: '', website: 'https://a.ac.ke/' }), 'website:https://a.ac.ke')
  assert.equal(dedupKey({ name: 'A School', phone: '', website: '' }), 'name:a school')
})

test('dedupKey: two entries with the same phone under different names collide (catches a duplicate Place ID)', () => {
  const keyA = dedupKey({ name: 'Kerugoya Girls High School', phone: '0700000000', website: '' })
  const keyB = dedupKey({ name: 'Kerugoya Girls Sec. School (branch)', phone: '0700000000', website: '' })
  assert.equal(keyA, keyB)
})

// ── buildResearchNotes ────────────────────────────────────────────────────

test('buildResearchNotes: generates specific notes, not one generic line', () => {
  const notes = buildResearchNotes({ website: '', phone: '', emailSource: 'none', websiteUnreachable: false, openNow: null })
  assert.equal(notes, 'No website; Phone missing')
})

test('buildResearchNotes: inferred email and unreachable website both surface', () => {
  const notes = buildResearchNotes({ website: 'https://x.ac.ke', phone: '0700000000', emailSource: 'inferred', websiteUnreachable: true, openNow: false })
  assert.equal(notes, 'Website unreachable; Email inferred; Currently closed (per Google)')
})

test('buildResearchNotes: a fully-formed row produces no notes', () => {
  const notes = buildResearchNotes({ website: 'https://x.ac.ke', phone: '0700000000', emailSource: 'mailto', websiteUnreachable: false, openNow: true })
  assert.equal(notes, '')
})

// ── summarizeDiscovery ────────────────────────────────────────────────────

function row(overrides: Partial<DiscoveryCsvRow>): DiscoveryCsvRow {
  return {
    ...newDiscoveryRow({
      name: 'Test School',
      county: 'Kirinyaga',
      town: 'Kerugoya',
      category_guess: 'Unknown',
      address: '',
      phone: '',
      website: '',
      email: '',
      google_rating: '',
      review_count: '',
      business_status: '',
      contact_source: 'google_places',
      google_maps_url: '',
      place_id: '',
      contact_quality: 'Unknown',
      discovery_score: '0',
      notes: '',
    }),
    ...overrides,
  }
}

test('summarizeDiscovery: counts missing phone/email, contact quality distribution, and ready-for-import', () => {
  const rows = [
    row({ name: 'A', phone: '0700000000', contact_quality: 'Low', ready_for_import: 'TRUE' }),
    row({ name: 'B', contact_quality: 'Unknown' }),
  ]
  const summary = summarizeDiscovery(rows)
  assert.equal(summary.schoolsDiscovered, 2)
  assert.equal(summary.missingPhone, 1)
  assert.equal(summary.missingEmail, 2)
  assert.equal(summary.readyForImportCount, 1)
  assert.deepEqual(summary.contactQuality, { High: 0, Medium: 0, Low: 1, Unknown: 1 })
})

test('summarizeDiscovery: never drops a closed school, only flags it', () => {
  const rows = [row({ name: 'Closed School', business_status: 'CLOSED_PERMANENTLY' })]
  const summary = summarizeDiscovery(rows)
  assert.equal(summary.schoolsDiscovered, 1)
  assert.deepEqual(summary.closedSchools, ['Closed School'])
})

test('summarizeDiscovery: flags duplicate phone numbers still present in a CSV', () => {
  const rows = [row({ name: 'A', phone: '0700000000' }), row({ name: 'B', phone: '0700000000' })]
  const summary = summarizeDiscovery(rows)
  assert.equal(summary.duplicatePhones.length, 1)
  assert.deepEqual(summary.duplicatePhones[0], ['0700000000', 'A', 'B'])
})
