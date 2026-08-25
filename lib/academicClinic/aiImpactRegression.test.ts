// lib/academicClinic/aiImpactRegression.test.ts
//
// Phase 2 (Learner Report Architecture — Clinic engine reconciliation)
// regression proof for the AI-impact fix. Before this phase,
// generateSeniorGuidance() stripped the real, already-computed
// CareerData.aiImpact field when building topCareers, so
// buildCareerInsightCards()'s getCareerMeta() had no choice but to
// re-guess futureOutlook/aiImpact from the career's NAME STRING via keyword
// matching — silently discarding real canonical data for careers sourced
// through lib/academicClinic/canonicalCareerAdapter.ts.
//
// This test proves the real value now survives generateSeniorGuidance() and
// is preferred by buildCareerInsightCards() over the keyword guess, using a
// career name ("Career Forty Four") that getCareerMeta's keyword matching
// cannot classify (falls to its generic 'Stable'/'Medium' default) paired
// with a canonical ai_impact.level ('transforming') that maps to a
// deliberately DIFFERENT label ('Booming'/'High') — so a passing test proves
// the canonical value was actually used, not a coincidental match.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/aiImpactRegression.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSeniorGuidance, buildCareerInsightCards } from './reportGenerator'
import { adaptCanonicalCareersForClinic } from './canonicalCareerAdapter'
import type { Career } from '@/lib/career/types'
import type { SubjectProgress } from './types'

function makeCanonicalCareer(overrides: Partial<Career> = {}): Career {
  return {
    id: 'test-id-ai-impact', slug: 'career-forty-four', title: 'Career Forty Four',
    category: 'technology',
    description: 'A brand new canonical career published after the one-off migration.',
    ai_impact: { level: 'transforming', replacing: [], creating: [], human_advantage: [], timeline: '', honest_summary: '' },
    ai_impact_level: 'transforming',
    kenya_market_outlook: 'Emerging field.',
    kenya_demand: 'critical_shortage', // guarantees a top-3 slot on merit, same technique as careerConvergence.test.ts
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

const SUBJECTS: SubjectProgress[] = [
  { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'computer_studies', displayName: 'Computer Studies', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'english', displayName: 'English', level: 3, trend: 'stable', velocity: 0, previousScores: [] },
]

test('generateSeniorGuidance() carries the real CareerData.aiImpact through onto CareerMatch instead of dropping it', () => {
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const guidance = generateSeniorGuidance(SUBJECTS, 'Test Student', 11, 'STEM', newCareer)
  const found = guidance.topCareers.find(c => c.name === 'Career Forty Four')
  assert.ok(found, `fixture career must qualify for topCareers — got: ${guidance.topCareers.map(c => c.name).join(', ')}`)
  assert.deepEqual(found!.aiImpact, { disruptionRisk: 'very_high', growthOutlook: 'booming' },
    'the real canonical aiImpact must survive generateSeniorGuidance(), not be dropped')
})

test('buildCareerInsightCards() uses the real canonical aiImpact, not a keyword-guessed value from the career name', () => {
  const newCareer = adaptCanonicalCareersForClinic([makeCanonicalCareer()])
  const guidance = generateSeniorGuidance(SUBJECTS, 'Test Student', 11, 'STEM', newCareer)
  const cards = buildCareerInsightCards(guidance)
  const card = cards.find(c => c.name === 'Career Forty Four')
  assert.ok(card, `fixture career must appear in insight cards — got: ${cards.map(c => c.name).join(', ')}`)

  // getCareerMeta('Career Forty Four') hits no keyword branch and falls to
  // its generic default: { futureOutlook: 'Stable', aiImpact: 'Medium' }.
  // If this test saw those values, the fix regressed back to the guess.
  assert.notEqual(card!.futureOutlook, 'Stable', 'must not have fallen back to getCareerMeta\'s generic guess')
  assert.notEqual(card!.aiImpact, 'Medium', 'must not have fallen back to getCareerMeta\'s generic guess')

  // The real canonical mapping: level 'transforming' -> growthOutlook
  // 'booming' -> 'Booming', disruptionRisk 'very_high' -> 'High'.
  assert.equal(card!.futureOutlook, 'Booming')
  assert.equal(card!.aiImpact, 'High')
})

test('a legacy CAREER_DATABASE-only career (no canonical adapter involved) still gets a sensible aiImpact via getCareerMeta', () => {
  // No additionalCareers supplied — every match comes from the hardcoded
  // CAREER_DATABASE, which also populates a real (hand-authored) aiImpact on
  // every entry, so this should NOT fall back to the generic guess either.
  const guidance = generateSeniorGuidance(SUBJECTS, 'Test Student', 11, 'STEM')
  assert.ok(guidance.topCareers.length > 0, 'expected at least one legacy-database match for this strong STEM fixture')
  const cards = buildCareerInsightCards(guidance)
  assert.ok(cards.length > 0)
  for (const card of cards) {
    assert.ok(card.futureOutlook.length > 0)
    assert.ok(card.aiImpact.length > 0)
  }
})
