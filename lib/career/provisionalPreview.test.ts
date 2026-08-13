// lib/career/provisionalPreview.test.ts
//
// Run: npx tsx --test lib/career/provisionalPreview.test.ts
//
// The invariant under test: an unreviewed, AI-generated career profile may be
// shown to a learner as orientation, but never as figures. Salary bands, entry
// grades, course costs, time-to-income and capability minimums are precisely
// what a language model produces fluently and wrongly, and precisely what a
// Kenyan family will act on.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProvisionalPreview } from './provisionalPreview'
import type { Career } from './types'

// A generated profile with every dangerous field populated, as the model would
// return it. The preview must drop all of them.
function generatedProfile(): Omit<Career, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: 'quantum-systems-technician',
    title: 'Quantum Systems Technician',
    category: 'technology',
    pathway: 'STEM',
    description: 'Maintains and calibrates quantum computing hardware.',
    required_subjects: ['mathematics', 'physics'],
    subject_importance: { mathematics: 'critical', physics: 'critical' },
    salary_range_kes: {
      entry:  { min: 180000, max: 320000, label: 'Entry level' },
      mid:    { min: 320000, max: 600000, label: 'Mid level' },
      senior: { min: 600000, max: 1200000, label: 'Senior' },
    },
    doors: [],
    ai_impact: {
      level: 'medium',
      replacing: [], creating: [], human_advantage: [],
      timeline: '', honest_summary: '',
    },
    kenya_market_outlook: 'Critical shortage across East Africa.',
    future_skills: [],
    skill_timeline: [],
    kenya_examples: null,
    disclaimer: 'test',
    required_capabilities: {
      analytical_reasoning: { minimum: 0.7, ideal: 0.9, weight: 0.4, note: '' },
    },
    capability_cluster: ['analytical_reasoning'],
    difficulty: 'very_hard',
    kenya_demand: 'critical_shortage',
    saturation_note: null,
    kcse_minimum: { overall_grade: 'A-', subject_grades: {}, alternative_routes: [], note: '' },
    time_to_income_years: 6,
    cost_to_qualify: { min: 900000, max: 2400000, note: 'university' },
    risk_level: 'high',
    prestige_level: 5,
    social_reality: null,
    alternative_career_slugs: [],
    complementary_career_slugs: [],
  } as unknown as Omit<Career, 'id' | 'created_at' | 'updated_at'>
}

test('the preview carries the orientation fields a learner can safely read', () => {
  const preview = buildProvisionalPreview(generatedProfile())
  assert.equal(preview.title, 'Quantum Systems Technician')
  assert.equal(preview.slug, 'quantum-systems-technician')
  assert.equal(preview.pathway, 'STEM')
  assert.equal(preview.description, 'Maintains and calibrates quantum computing hardware.')
  assert.deepEqual(preview.requiredSubjects, ['mathematics', 'physics'])
})

// The core safety assertion. Written as a whole-object scan rather than a list
// of per-field checks so that adding a numeric field to the preview type fails
// here automatically, instead of passing until someone remembers to test it.
test('no unreviewed figure survives into the preview', () => {
  const preview = buildProvisionalPreview(generatedProfile())
  const serialized = JSON.stringify(preview)

  const leakedFigures = ['180000', '320000', '600000', '1200000', '900000', '2400000']
  for (const figure of leakedFigures) {
    assert.equal(
      serialized.includes(figure), false,
      `preview leaked the unreviewed figure ${figure}`,
    )
  }
})

test('no unreviewed gate or grade survives into the preview', () => {
  const preview = buildProvisionalPreview(generatedProfile()) as unknown as Record<string, unknown>

  for (const forbidden of [
    'salary_range_kes', 'salaryRange',
    'kcse_minimum', 'kcseMinimum',
    'cost_to_qualify', 'costToQualify',
    'required_capabilities', 'requiredCapabilities',
    'kenya_demand', 'kenyaDemand',
    'time_to_income_years', 'timeToIncomeYears',
    'difficulty', 'prestige_level', 'risk_level',
  ]) {
    assert.equal(forbidden in preview, false, `preview exposed the unreviewed field ${forbidden}`)
  }
})

test('the preview always tells the reader it is unverified', () => {
  const preview = buildProvisionalPreview(generatedProfile())
  assert.match(preview.provisionalNotice, /do not have a verified profile/i)
  assert.match(preview.provisionalNotice, /left out salary figures/i)
})

test('the preview shape is exactly the six agreed fields, no more', () => {
  const preview = buildProvisionalPreview(generatedProfile())
  assert.deepEqual(
    Object.keys(preview).sort(),
    ['description', 'pathway', 'provisionalNotice', 'requiredSubjects', 'slug', 'title'],
  )
})
