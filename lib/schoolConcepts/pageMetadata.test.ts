// Run: npx tsx --test lib/schoolConcepts/pageMetadata.test.ts
//
// Tests the actual generated Metadata objects (not source-string scans)
// against the real Kutus config, and against a synthetic "approved" school
// fixture to prove indexing behaviour is deterministic and driven by
// publicationStatus rather than hardcoded per school.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Metadata } from 'next'
import { buildHomeMetadata, buildPageMetadata } from './pageMetadata'
import { getSchoolConcept } from '@/data/schoolConcepts'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

const kutus = getSchoolConcept('kutus-municipality')!

function asApproved(config: SchoolConceptConfig): SchoolConceptConfig {
  return { ...config, publicationStatus: 'approved' }
}

// title is `{ absolute: string }` (not a plain string) so that no ancestor
// layout's title.template — including the root app/layout.tsx's
// '%s | EduNexus Kenya' — is applied on top of it. Tests read `.absolute`.
function titleText(title: Metadata['title']): string {
  return typeof title === 'object' && title && 'absolute' in title ? String(title.absolute) : String(title)
}

// ── 1 & 2: title ─────────────────────────────────────────────────────────

test('Kutus home title does not contain "EduNexus Kenya"', () => {
  const { title } = buildHomeMetadata(kutus)
  assert.doesNotMatch(titleText(title), /EduNexus Kenya/)
})

test('Kutus home title contains a clear website-concept qualifier', () => {
  const { title } = buildHomeMetadata(kutus)
  assert.match(titleText(title), /Website Concept/)
})

// ── 3 & 4: description ──────────────────────────────────────────────────

test('description does not contain unrelated EduNexus CBC marketing copy', () => {
  const { description } = buildHomeMetadata(kutus)
  assert.doesNotMatch(description!, /CBC|mustakabali|taaluma/i)
})

test('description does not imply the school approved or commissioned the content', () => {
  const { description } = buildHomeMetadata(kutus)
  assert.doesNotMatch(description!, /school (has )?(approved|commissioned|confirmed)/i)
  assert.match(description!, /not an official or approved website/i)
})

// ── 5: canonical ─────────────────────────────────────────────────────────

test('canonical does not point to the EduNexus homepage', () => {
  const { alternates } = buildHomeMetadata(kutus)
  const canonical = alternates?.canonical
  assert.notEqual(String(canonical ?? ''), 'https://edunexus.co.ke')
  assert.equal(canonical, undefined)
})

// ── 6: robots ────────────────────────────────────────────────────────────

test('robots explicitly prevents indexing for a concept-status school', () => {
  const { robots } = buildHomeMetadata(kutus)
  assert.equal((robots as { index: boolean }).index, false)
  assert.equal((robots as { follow: boolean }).follow, false)
})

test('robots allows indexing once publicationStatus is approved', () => {
  const { robots } = buildHomeMetadata(asApproved(kutus))
  assert.equal((robots as { index: boolean }).index, true)
  assert.equal((robots as { follow: boolean }).follow, true)
})

// ── 7: Open Graph ────────────────────────────────────────────────────────

test('Open Graph title and description match the concept-safe values, not EduNexus product copy', () => {
  const meta = buildHomeMetadata(kutus)
  const og = meta.openGraph as { title?: string; description?: string }
  assert.equal(og.title, titleText(meta.title))
  assert.equal(og.description, meta.description)
  assert.doesNotMatch(og.title ?? '', /EduNexus Kenya/)
})

// ── 8: inner pages produce page-specific titles ─────────────────────────

test('inner pages produce distinct, page-specific titles', () => {
  const about = buildPageMetadata(kutus, 'About')
  const admissions = buildPageMetadata(kutus, 'Admissions')
  assert.notEqual(titleText(about.title), titleText(admissions.title))
  assert.match(titleText(about.title), /^About —/)
  assert.match(titleText(admissions.title), /^Admissions —/)
  assert.match(titleText(about.title), /Website Concept/)
})

// ── 9: deterministic approved vs concept behaviour ──────────────────────

test('an approved school gets no "Website Concept" qualifier and a plain page title', () => {
  const approvedAbout = buildPageMetadata(asApproved(kutus), 'About')
  assert.doesNotMatch(titleText(approvedAbout.title), /Website Concept/)
  assert.equal(titleText(approvedAbout.title), `About — ${kutus.schoolName}`)
})

// ── 10: no capability metadata appears ──────────────────────────────────

test('no capability, portal, or sign-in language appears in any generated metadata', () => {
  const all = [buildHomeMetadata(kutus), buildPageMetadata(kutus, 'Admissions'), buildPageMetadata(kutus, 'Contact')]
  for (const meta of all) {
    const text = `${titleText(meta.title)} ${meta.description}`
    assert.doesNotMatch(text, /portal|sign in|parentPortal/i)
  }
})
