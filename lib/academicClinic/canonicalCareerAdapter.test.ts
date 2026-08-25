// lib/academicClinic/canonicalCareerAdapter.test.ts
//
// Phase 9.1.6 — pure unit tests for the Postgres Career -> Academic Clinic
// CareerData adapter. No DB, no mocks needed: adaptCanonicalCareersForClinic
// and toClinicCareerData are pure functions of their arguments.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/canonicalCareerAdapter.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toClinicCareerData,
  adaptCanonicalCareersForClinic,
  clinicRepresentedSlugs,
  _internal,
} from './canonicalCareerAdapter'
import type { Career } from '@/lib/career/types'

function makeCareer(overrides: Partial<Career> = {}): Career {
  return {
    id: 'test-id',
    slug: 'test-new-canonical-career',
    title: 'Test New Canonical Career',
    category: 'technology',
    description: 'A synthetic canonical career for testing.',
    ai_impact: { level: 'medium', replacing: [], creating: [], human_advantage: ['adaptability'], timeline: 'Changing over 5 years.', honest_summary: 'AI assists but does not replace this role.' },
    ai_impact_level: 'medium',
    kenya_market_outlook: 'Growing demand in Nairobi and Mombasa.',
    salary_range_kes: { entry: { min: 40000, max: 60000, label: 'Entry' }, mid: { min: 60000, max: 100000, label: 'Mid' }, senior: { min: 100000, max: 200000, label: 'Senior' }, note: '' },
    required_subjects: ['mathematics', 'computer_studies'],
    subject_importance: { mathematics: 'critical', computer_studies: 'important' },
    skill_timeline: [],
    future_skills: ['cloud computing', 'data literacy'],
    kenya_examples: null,
    pathway: 'STEM',
    university_courses: ['BSc Computer Science'],
    disclaimer: 'test',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Career
}

test('toClinicPathway normalizes "Arts & Sports Science" to the Clinic enum, passes STEM/Social Sciences through unchanged', () => {
  assert.equal(_internal.toClinicPathway('Arts & Sports Science'), 'Arts & Sports')
  assert.equal(_internal.toClinicPathway('STEM'), 'STEM')
  assert.equal(_internal.toClinicPathway('Social Sciences'), 'Social Sciences')
})

test('toShortageScore derives a real, documented value from kenya_demand — 0 (not a guessed middle) when unknown', () => {
  assert.equal(_internal.toShortageScore('critical_shortage'), 90)
  assert.equal(_internal.toShortageScore('undersupplied'), 65)
  assert.equal(_internal.toShortageScore('balanced'), 40)
  assert.equal(_internal.toShortageScore('saturated'), 15)
  assert.equal(_internal.toShortageScore(null), 0)
  assert.equal(_internal.toShortageScore(undefined), 0)
})

test('toMinimumLevels omits subjects with no subject_importance entry rather than guessing a default', () => {
  const levels = _internal.toMinimumLevels(
    ['mathematics', 'computer_studies', 'geography'],
    { mathematics: 'critical', computer_studies: 'important' },
  )
  assert.deepEqual(levels, { mathematics: 4, computer_studies: 3 })
  assert.ok(!('geography' in levels), 'geography has no subject_importance entry and must be omitted, not defaulted')
})

test('toMinimumLevels maps "helpful" to a real (low, not zero) level', () => {
  const levels = _internal.toMinimumLevels(['art'], { art: 'helpful' })
  assert.equal(levels.art, 1)
})

test('toDisruptionRisk mirrors the migration script\'s aiLevel mapping, inverted', () => {
  assert.equal(_internal.toDisruptionRisk('low'), 'low')
  assert.equal(_internal.toDisruptionRisk('medium'), 'moderate')
  assert.equal(_internal.toDisruptionRisk('high'), 'high')
  assert.equal(_internal.toDisruptionRisk('transforming'), 'very_high')
})

test('toClinicCareerData produces a fully-shaped CareerData with no undefined required fields', () => {
  const data = toClinicCareerData(makeCareer())
  assert.equal(data.id, 'test-new-canonical-career')
  assert.equal(data.name, 'Test New Canonical Career')
  assert.equal(data.pathway, 'STEM')
  assert.equal(data.kenyaShortageScore, 0) // makeCareer() sets no kenya_demand
  assert.deepEqual(data.matchRequirements.primarySubjects, ['mathematics', 'computer_studies'])
  assert.deepEqual(data.matchRequirements.minimumLevels, { mathematics: 4, computer_studies: 3 })
  assert.equal(data.marketReality.kenyanContext, 'Growing demand in Nairobi and Mombasa.')
  assert.equal(data.aiImpact.disruptionRisk, 'moderate')
  assert.equal(data.realityCheck.typicalDay, 'A synthetic canonical career for testing.')
  assert.deepEqual(data.cbeReadiness.universities, ['BSc Computer Science'])
  assert.deepEqual(data.cbeReadiness.tvetOptions, [], 'no canonical TVET field exists — must stay an honest empty array')
})

test('adaptCanonicalCareersForClinic excludes any career CAREER_DATABASE already represents (no duplicates)', () => {
  const represented = clinicRepresentedSlugs()
  assert.ok(represented.has('software-engineer'), 'software-engineer is a known ALIAS_MAP target — sanity check the exclusion set is non-empty and correct')

  const alreadyRepresented = makeCareer({ slug: 'software-engineer', title: 'Software Engineer' })
  const genuinelyNew = makeCareer({ slug: 'test-new-canonical-career-2', title: 'Genuinely New Career' })

  const result = adaptCanonicalCareersForClinic([alreadyRepresented, genuinelyNew])
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'test-new-canonical-career-2')
})

test('adaptCanonicalCareersForClinic is pure — same input, same output, no mutation of the input array', () => {
  const input = [makeCareer()]
  const inputCopy = JSON.parse(JSON.stringify(input))
  const first = adaptCanonicalCareersForClinic(input)
  const second = adaptCanonicalCareersForClinic(input)
  assert.deepEqual(first, second)
  assert.deepEqual(input, inputCopy, 'adaptCanonicalCareersForClinic must not mutate its input')
})
