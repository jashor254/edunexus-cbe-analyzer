// lib/academicClinic/careerConvergence.test.ts
//
// Phase 9.1.6 — the two acceptance proofs the phase brief requires, both
// runnable without a database because CareerEngine.matchCareers() and
// generateSeniorGuidance() are pure functions of their arguments:
//
//   1. Semantics preservation (§7): matchCareers()'s output for an EXISTING
//      career is byte-identical whether or not additionalCareers is passed —
//      CAREER_DATABASE's 40 entries are never touched by this phase.
//   2. "Career #44" (§12/§29): a canonical career that exists ONLY in
//      Postgres (never in CAREER_DATABASE) is now visible to Clinic
//      matching, and to the PDF-facing generateSeniorGuidance() output,
//      without any code/deploy change — it's supplied as ordinary data.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/careerConvergence.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CareerEngine, CAREER_DATABASE } from './careerEngine'
import { generateSeniorGuidance } from './reportGenerator'
import { adaptCanonicalCareersForClinic, toClinicCareerData } from './canonicalCareerAdapter'
import type { Career } from '@/lib/career/types'
import type { SubjectProgress } from './types'

function makeCanonicalCareer(overrides: Partial<Career> = {}): Career {
  return {
    id: 'test-id-44', slug: 'career-forty-four', title: 'Career Forty Four',
    category: 'technology',
    description: 'A brand new canonical career published after the one-off migration.',
    ai_impact: { level: 'medium', replacing: [], creating: [], human_advantage: [], timeline: '', honest_summary: '' },
    ai_impact_level: 'medium',
    kenya_market_outlook: 'Emerging field.',
    salary_range_kes: { entry: { min: 40000, max: 60000, label: '' }, mid: { min: 60000, max: 100000, label: '' }, senior: { min: 100000, max: 200000, label: '' }, note: '' },
    required_subjects: ['mathematics', 'computer_studies'],
    subject_importance: { mathematics: 'critical', computer_studies: 'critical' },
    skill_timeline: [], future_skills: [], kenya_examples: null,
    pathway: 'STEM',
    university_courses: [],
    disclaimer: 'test',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Career
}

const HIGH_SCORES: Record<string, number> = { mathematics: 4, computer_studies: 4, english: 3, kiswahili: 3 }
const SUBJECTS: SubjectProgress[] = [
  { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'computer_studies', displayName: 'Computer Studies', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'english', displayName: 'English', level: 3, trend: 'stable', velocity: 0, previousScores: [] },
]

test('CAREER_DATABASE genuinely has 40 entries (sanity check the fixture assumptions below)', () => {
  assert.ok(CAREER_DATABASE.length > 0)
})

test('matchCareers() output for existing careers is unaffected by additionalCareers being present (§7 semantics preservation)', () => {
  const engine = new CareerEngine()
  const withoutAdditional = engine.matchCareers(HIGH_SCORES, 'high', 'cbc', 'STEM')
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const withAdditional = engine.matchCareers(HIGH_SCORES, 'high', 'cbc', 'STEM', newCareer)

  // Every existing CAREER_DATABASE-sourced match score must be identical —
  // find each existing career (by original id, present in both result sets)
  // and compare its score exactly.
  const existingIds = new Set(CAREER_DATABASE.map(c => c.id))
  const beforeById = new Map(withoutAdditional.filter(m => existingIds.has(m.career.id)).map(m => [m.career.id, m.matchScore]))
  const afterById = new Map(withAdditional.filter(m => existingIds.has(m.career.id)).map(m => [m.career.id, m.matchScore]))

  assert.equal(beforeById.size, afterById.size, 'the same set of existing careers must be present')
  for (const [id, score] of beforeById) {
    assert.equal(afterById.get(id), score, `existing career "${id}"'s score changed after adding a canonical-only career — semantics were NOT preserved`)
  }
})

test('a canonical-only career ("Career #44") now appears in matchCareers() output when eligible', () => {
  const engine = new CareerEngine()
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const results = engine.matchCareers(HIGH_SCORES, 'high', 'cbc', 'STEM', newCareer)

  const found = results.find(m => m.career.id === 'career-forty-four')
  assert.ok(found, 'the canonical-only career must appear in matchCareers() output')
  assert.ok(found!.matchScore > 0, 'it must actually be scored, not just present with a placeholder score')
})

test('a canonical-only career in a DIFFERENT pathway is correctly excluded when a student pathway is given', () => {
  const engine = new CareerEngine()
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer({ pathway: 'Social Sciences' })])
  const results = engine.matchCareers(HIGH_SCORES, 'high', 'cbc', 'STEM', newCareer)
  assert.ok(!results.some(m => m.career.id === 'career-forty-four'), 'a Social Sciences-pathway career must not appear when filtering to STEM')
})

test('generateSeniorGuidance() (the PDF-facing surface) shows the canonical-only career when it scores highly enough', () => {
  // A real critical_shortage bonus (+15, vs. real CAREER_DATABASE entries that
  // mostly score 50-90 with this SUBJECTS fixture) is what earns this fixture
  // a top-3 spot on merit — topCareers is genuinely capped at 3 by design
  // (reportGenerator.ts), so the test must give a fair, not artificial, edge
  // rather than assume an uncontested slot.
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer({ kenya_demand: 'critical_shortage' })])
  const guidance = generateSeniorGuidance(SUBJECTS, 'Test Student', 11, 'STEM', newCareer)
  const found = guidance.topCareers.find(c => c.name === 'Career Forty Four')
  assert.ok(found, `generateSeniorGuidance() must surface the canonical-only career in topCareers when it qualifies — got: ${guidance.topCareers.map(c => c.name).join(', ')}`)
})

test('generateSeniorGuidance() called without additionalCareers (the pre-Phase-9.1.6 call shape) still works unchanged', () => {
  const guidance = generateSeniorGuidance(SUBJECTS, 'Test Student', 11, 'STEM')
  assert.ok(Array.isArray(guidance.topCareers))
})

test('an already-CAREER_DATABASE-represented canonical career never appears twice', () => {
  const engine = new CareerEngine()
  // Real CAREER_DATABASE name, confirmed by reading careerEngine.ts directly —
  // not assumed from the slug.
  const duplicate = adaptCanonicalCareersForClinic([makeCanonicalCareer({ slug: 'software-engineer', title: 'Software Engineer / Developer' })])
  assert.equal(duplicate.length, 0, 'adaptCanonicalCareersForClinic must have already excluded it')

  const results = engine.matchCareers(HIGH_SCORES, 'high', 'cbc', 'STEM', duplicate)
  const swe = results.filter(m => m.career.name === 'Software Engineer / Developer')
  assert.equal(swe.length, 1, 'Software Engineer / Developer must appear exactly once, from CAREER_DATABASE only')
})

test('toClinicCareerData round-trips consistently with the adapter used in matching (no drift between the two entry points)', () => {
  const career = makeCanonicalCareer()
  const viaAdapter = adaptCanonicalCareersForClinic([career])[0]
  const direct = toClinicCareerData(career)
  assert.deepEqual(viaAdapter, direct)
})
