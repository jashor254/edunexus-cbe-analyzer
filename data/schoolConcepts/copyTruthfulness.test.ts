// Run: npx tsx --test data/schoolConcepts/copyTruthfulness.test.ts
//
// Scans every string field in the real Kutus config for exaggerated,
// fabricated, or SaaS-marketing language the Phase 1 and Phase 5 briefs both
// rule out. This is a config-content check, not a rendering check — it
// catches the mistake at the source rather than downstream in every
// component that might display it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSchoolConcept } from './index'

const FORBIDDEN_PHRASES = [
  /\bwe believe\b/i,
  /\bthe best\b/i,
  /\bleading (institution|school)\b/i,
  /\bworld[- ]class\b/i,
  /\baward[- ]winning\b/i,
  /\branked\b/i,
  /\bnumber one\b/i,
  /\btop school\b/i,
  /\bexcellence\b/i,
  /\bempowering tomorrow/i,
  /\bunlock\b/i,
  /\bpremium\b/i,
]

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out)
  }
  return out
}

test('no field in the Kutus config contains fabricated or SaaS-marketing language', () => {
  const config = getSchoolConcept('kutus-municipality')
  assert.ok(config)
  const strings = collectStrings(config)
  for (const s of strings) {
    for (const pattern of FORBIDDEN_PHRASES) {
      assert.doesNotMatch(s, pattern, `Forbidden phrase ${pattern} found in: "${s}"`)
    }
  }
})

test('unverified content fields stay explicitly labelled as sample, pending, or to-be-confirmed', () => {
  const config = getSchoolConcept('kutus-municipality')
  assert.ok(config)
  const labelPattern = /sample|to be (provided|confirmed)|pending|will be confirmed|once confirmed|will appear here|not a verified/i

  assert.match(config!.about.storyNote, /can be added here/i)
  assert.match(config!.about.missionNote, labelPattern)
  for (const doc of config!.admissions.documents) assert.match(doc, labelPattern)
  for (const item of config!.parentInfo) assert.match(item.status, labelPattern)
  for (const news of config!.sampleNews) assert.match(news.title, /sample/i)
})
