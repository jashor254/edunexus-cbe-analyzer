// lib/learnerIntelligence/careerPathwayHonesty.test.ts
//
// FIX 4 — Senior pathway honesty. Senior matching is partly circular
// (pathway → subjects → dimensions → matches), so matches mostly confirm the
// chosen pathway. Not redesigned; instead matches are tagged within/cross
// pathway, the strongest cross-pathway match reaching at least the stretch
// tier is surfaced, and a one-line note explains the circularity. Pure,
// deterministic, env-free.
//
// Run: npm test -- lib/learnerIntelligence/careerPathwayHonesty.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  asCareerPathway, pathwayRelationFor, selectCrossPathwayHighlight,
  crossPathwayInsight, seniorPathwayNote,
} from './careerIntelligence'
import type { CareerMatchInsight } from './careerIntelligence'
import type { CareerPathway } from '@/lib/career/types'

function match(
  slug: string,
  careerPathway: CareerPathway,
  learnerPathway: CareerPathway | null,
  tier: CareerMatchInsight['tier'],
  alignmentPct: number,
): CareerMatchInsight {
  return {
    careerSlug: slug, careerTitle: slug, careerCategory: 'technology', tier, alignmentPct,
    insight: { observation: 'o', evidence: ['e'], confidence: 'High', action: 'a' },
    careerPathway, pathwayRelation: pathwayRelationFor(careerPathway, learnerPathway),
  }
}

test('pathway labelling is correct, and unknown learner pathway makes no claim', () => {
  assert.equal(pathwayRelationFor('STEM', 'STEM'), 'within_pathway')
  assert.equal(pathwayRelationFor('Social Sciences', 'STEM'), 'cross_pathway')
  assert.equal(pathwayRelationFor('STEM', null), null)
  assert.equal(pathwayRelationFor(null, 'STEM'), null)
})

test('stored pathway strings are validated against the canonical list', () => {
  assert.equal(asCareerPathway('Arts & Sports Science'), 'Arts & Sports Science')
  assert.equal(asCareerPathway('stem'), null, 'no case-folding guess')
  assert.equal(asCareerPathway('Science'), null)
  assert.equal(asCareerPathway(null), null)
})

test('only within-pathway matches → no outside-pathway highlight', () => {
  const ms = [match('a', 'STEM', 'STEM', 'primary', 82), match('b', 'STEM', 'STEM', 'stretch', 60)]
  assert.ok(ms.every(m => m.pathwayRelation === 'within_pathway'))
  assert.equal(selectCrossPathwayHighlight(ms), null)
})

test('a cross-pathway match at stretch tier is surfaced', () => {
  const ms = [match('a', 'STEM', 'STEM', 'primary', 82), match('law', 'Social Sciences', 'STEM', 'stretch', 58)]
  assert.equal(selectCrossPathwayHighlight(ms)?.careerSlug, 'law')
})

test('a cross-pathway match that outranks a weak within-pathway option is the highlight; below-stretch cross matches are not', () => {
  const ms = [
    match('weak-within', 'STEM', 'STEM', 'alternative', 35),
    match('cross-alt', 'Arts & Sports Science', 'STEM', 'alternative', 45),
    match('cross-strong', 'Social Sciences', 'STEM', 'primary', 76),
    match('cross-stretch', 'Social Sciences', 'STEM', 'stretch', 61),
  ]
  assert.equal(selectCrossPathwayHighlight(ms)?.careerSlug, 'cross-strong')
  assert.equal(selectCrossPathwayHighlight(ms.filter(m => m.careerSlug !== 'cross-strong' && m.careerSlug !== 'cross-stretch')), null,
    'an alternative-tier cross match must not be surfaced')
})

test('the entrepreneurial-tier duplicate is never the highlight', () => {
  const ms = [match('entrepreneur-business', 'Social Sciences', 'STEM', 'entrepreneurial', 90)]
  assert.equal(selectCrossPathwayHighlight(ms), null)
})

test('the outside-pathway insight names the pathway without implying the pathway career is better', () => {
  const m = match('law', 'Social Sciences', 'STEM', 'stretch', 58)
  const i = crossPathwayInsight(m, 'STEM')
  assert.match(i.observation, /outside your STEM pathway/)
  assert.match(i.observation, /58% alignment/)
  assert.deepEqual(i.evidence, m.insight.evidence)
  assert.equal(i.confidence, m.insight.confidence)
})

test('the circularity note explains subject shaping, and is honest when the pathway is unknown', () => {
  assert.match(seniorPathwayNote('STEM'), /shaped by the subjects you take in your STEM pathway/)
  assert.match(seniorPathwayNote('STEM'), /not which careers would suit you best/)
  assert.match(seniorPathwayNote(null), /not on record/)
})
