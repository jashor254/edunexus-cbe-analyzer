// lib/learnerIntelligence/careerJuniorFamilies.test.ts
//
// Junior alignment (2026-10-06): familiesFromMatches — the one canonical
// Junior grouping — carries no career title anywhere (list, action, evidence)
// and points each family at its usual Senior pathway instead. Pure, env-free.
//
// Run: npm test -- lib/learnerIntelligence/careerJuniorFamilies.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { familiesFromMatches } from './careerIntelligence'
import type { CapabilityCareerMatch, CareerPathway } from '@/lib/career/types'

function match(title: string, category: CapabilityCareerMatch['career_category'], pathway: CareerPathway, score: number): CapabilityCareerMatch {
  return {
    career_slug: title.toLowerCase().replace(/\s+/g, '-'), career_title: title, career_category: category, pathway,
    tier: 'stretch', alignment_score: score, confidence: 'Medium', dimension_scores: {},
    gaps: [{ dimension: 'creative_thinking', student_level: 'developing', student_score: 0.4, required_minimum: 0.5, required_ideal: 0.7,
             gap_severity: 'moderate', narrative: `Your Creative Thinking is at developing — ${title} typically needs capable.` }],
    strengths: [{ dimension: 'analytical_reasoning', level: 'strong', narrative: `Analytical Reasoning is a genuine asset for ${title}` }],
    reality_check: { kcse_achievable: true, cost_barrier: 'low', time_to_income_years: 4, risk_level: 'medium', difficulty: 'moderate', kenya_demand: 'balanced' },
    narrative: `Current evidence suggests ${title} is within reach.`, disclaimer: 'd',
  } as CapabilityCareerMatch
}

const MATCHES = [
  match('Medical Doctor', 'health', 'STEM', 0.66),
  match('Pharmacist', 'health', 'STEM', 0.61),
  match('Counselling Psychologist', 'health', 'Social Sciences', 0.55),
  match('Accountant', 'finance', 'Social Sciences', 0.6),
  match('Actuary', 'finance', 'STEM', 0.58),
]

test('no family string contains a career title — even though match narratives do', () => {
  const families = familiesFromMatches(MATCHES)
  const text = JSON.stringify(families).toLowerCase()
  for (const m of MATCHES) assert.ok(!text.includes(m.career_title.toLowerCase()), `leaked "${m.career_title}"`)
  assert.ok(families.every(f => !('exampleCareerTitles' in f)))
})

test('each family points to its usual Senior pathway; a tie gives null, not a guess', () => {
  const families = familiesFromMatches(MATCHES)
  const health = families.find(f => f.category === 'health')!
  const finance = families.find(f => f.category === 'finance')!
  assert.equal(health.usualPathway, 'STEM', '2 of 3 health careers are STEM')
  assert.match(health.insight.action, /usually continue through the STEM pathway/)
  assert.equal(finance.usualPathway, null, '1 STEM vs 1 Social Sciences is a tie')
  assert.doesNotMatch(finance.insight.action, /pathway in Senior School/)
})

test('evidence is rebuilt from capability dimensions', () => {
  const [first] = familiesFromMatches(MATCHES)
  assert.ok(first.insight.evidence.some(e => e.startsWith('Analytical Reasoning is a clear strength')))
  assert.ok(first.insight.evidence.some(e => e.startsWith('Creative Thinking is still developing')))
})
