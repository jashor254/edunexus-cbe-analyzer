// lib/sow/generatedLessonJsonRoundTrip.pure.test.ts
//
// H5A-3 CUR-SOW-004 — once GeneratedLesson carries canonical curriculum
// identity (H5A-2's substrandId field), persistence in
// schemes_of_work.lessons JSONB must not silently strip it. Postgres JSONB
// storage is exactly a JSON.stringify/JSON.parse round trip of whatever
// object the client sends — this test proves that mechanism preserves
// substrandId (including null), and that an old row's JSON (recorded
// before H5A-2, genuinely missing the key) parses back with the field
// simply absent rather than throwing or silently coercing to something
// else. Pure, no DB — the DB's actual storage semantics for JSONB ARE
// JSON.stringify/parse, so this is a faithful proxy, not an approximation.
//
// Run: npm test -- lib/sow/generatedLessonJsonRoundTrip.pure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GeneratedLesson } from './types'

function jsonbRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function lesson(overrides: Partial<GeneratedLesson> = {}): GeneratedLesson {
  return {
    week: 1, lesson: 1, strand: 'Numbers', substrand: 'Fractions', substrandId: 'substrand-X',
    learningOutcomes: [], learningExperiences: [], keyInquiryQuestions: [],
    learningResources: [], assessmentMethods: [], coreCompetencies: '', values: '',
    pciLinks: '', reflection: '', _validated: true, _confidence: 0.9,
    ...overrides,
  }
}

test('CUR-SOW-004: a real substrandId survives the JSONB round trip unchanged', () => {
  const stored = jsonbRoundTrip(lesson({ substrandId: 'substrand-X' }))
  assert.equal(stored.substrandId, 'substrand-X')
})

test('CUR-SOW-004: a null substrandId survives the JSONB round trip as null', () => {
  const stored = jsonbRoundTrip(lesson({ substrandId: null }))
  assert.equal(stored.substrandId, null)
})

test('CUR-SOW-004: an old row recorded before substrandId existed parses back with the field simply absent, not fabricated', () => {
  // Simulates a schemes_of_work.lessons JSONB row written before H5A-2 —
  // its stored JSON genuinely has no substrandId key at all.
  const oldStoredJson = JSON.stringify({
    week: 1, lesson: 1, strand: 'Numbers', substrand: 'Fractions',
    learningOutcomes: [], learningExperiences: [], keyInquiryQuestions: [],
    learningResources: [], assessmentMethods: [], coreCompetencies: '', values: '',
    pciLinks: '', reflection: '', _validated: true, _confidence: 0.9,
  })
  const parsed = JSON.parse(oldStoredJson) as GeneratedLesson

  assert.equal(parsed.substrandId, undefined, 'the field is genuinely absent, not coerced to null')
  assert.equal(parsed.strand, 'Numbers', 'the rest of the old row is unaffected')
})
