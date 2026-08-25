// lib/academicClinic/dreamCareerConvergence.test.ts
//
// Phase 9.1.7 — analyzeDreamCareer()/findCareerByName() previously searched
// CAREER_DATABASE only (confirmed by reading careerEngine.ts directly), so a
// canonical-only career ("Career #44") returned `found: false` — "not yet in
// our database" — even after Phase 9.1.6 made it visible to normal
// matchCareers(). This file proves that gap existed and is now closed for
// callers that pass additionalCareers, without adding any alias/fuzzy
// semantics (still exact/substring name resolution only).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/dreamCareerConvergence.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeDreamCareer, findCareerByName } from './careerEngine'
import { adaptCanonicalCareersForClinic } from './canonicalCareerAdapter'
import type { Career } from '@/lib/career/types'

function makeCanonicalCareer(overrides: Partial<Career> = {}): Career {
  return {
    id: 'test-id-44', slug: 'dream-career-forty-four', title: 'Dream Career Forty Four',
    category: 'technology',
    description: 'A brand new canonical career.',
    ai_impact: { level: 'medium', replacing: [], creating: [], human_advantage: [], timeline: '', honest_summary: '' },
    ai_impact_level: 'medium',
    kenya_market_outlook: '',
    salary_range_kes: null,
    required_subjects: ['mathematics'],
    subject_importance: { mathematics: 'critical' },
    skill_timeline: [], future_skills: [], kenya_examples: null,
    pathway: 'STEM',
    university_courses: [],
    disclaimer: 'test',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Career
}

test('findCareerByName cannot find a canonical-only career without additionalCareers (proves the pre-existing gap)', () => {
  const found = findCareerByName('Dream Career Forty Four')
  assert.equal(found, null)
})

test('findCareerByName finds a canonical-only career when additionalCareers is supplied', () => {
  const additional = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const found = findCareerByName('Dream Career Forty Four', additional)
  assert.ok(found)
  assert.equal(found!.id, 'dream-career-forty-four')
})

test('analyzeDreamCareer() returns found:false for a canonical-only career without additionalCareers (pre-Phase-9.1.7 behavior preserved when omitted)', () => {
  const result = analyzeDreamCareer('Dream Career Forty Four', { mathematics: 4 })
  assert.equal(result.found, false)
  assert.equal(result.readinessLabel, 'Career not yet in our database')
})

test('analyzeDreamCareer() returns found:true and a real readiness score for a canonical-only career when additionalCareers is supplied', () => {
  const additional = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const result = analyzeDreamCareer('Dream Career Forty Four', { mathematics: 4 }, 'STEM', additional)
  assert.equal(result.found, true)
  assert.equal(result.dreamCareer, 'Dream Career Forty Four')
  assert.equal(result.readinessScore, 100)
  assert.equal(result.allGapsClosed, true)
})

test('analyzeDreamCareer()\'s "alternative careers" list also includes canonical-only careers in the same pathway', () => {
  const secondCanonical = makeCanonicalCareer({ slug: 'dream-career-forty-five', title: 'Dream Career Forty Five', pathway: 'STEM' })
  const additional = adaptCanonicalCareersForClinic([makeCanonicalCareer(), secondCanonical])
  const result = analyzeDreamCareer('Dream Career Forty Four', { mathematics: 4 }, 'STEM', additional)
  assert.ok(result.alternativeCareers.some(a => a.name === 'Dream Career Forty Five'))
})

test('exact name resolution is unchanged for existing CAREER_DATABASE careers — no aliases/fuzzy semantics were introduced', () => {
  const found = findCareerByName('Medical Doctor')
  assert.ok(found)
  assert.equal(found!.id, 'medical_doctor')
})
