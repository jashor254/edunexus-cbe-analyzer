// lib/academy/aiJudge.test.ts
//
// Sprint 2 (Pilot Hardening): AI Fallback Integrity.
// Proves scoreReflection()/scoreMissionComparison() correctly flag isFallback
// on every non-genuine path (too-short-to-judge, AI call failure/timeout,
// malformed AI response) and never flag it on a real, successfully parsed
// judgement. DeepSeek and the AI call logger are mocked — no real AI calls,
// no DB writes. See lib/academy/reflections.persist.test.ts for the separate
// "is_fallback persists correctly" test against the real database.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/academy/aiJudge.test.ts
import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { ReflectionInput, ReflectionFeedback, MissionInput, MissionVerdict, AcademyMission } from './types'

const VALID_REFLECTION_RESPONSE = JSON.stringify({
  quality_score: 4,
  feedback_text: 'Mwalimu, umeonyesha ushahidi mzuri wa majaribio darasani.',
  growth_indicator: 'deep',
  suggested_next_action: 'Jaribu somo lingine la Academy wiki hii.',
})

const VALID_MISSION_RESPONSE = JSON.stringify({
  ai_score: 4,
  ai_verdict: 'Ulinganisho wako ni wa kina na unaonyesha ufahamu mzuri.',
  key_insight: 'AI inasaidia lakini haichukui nafasi ya tathmini ya mwalimu.',
  suggested_next_action: 'Tumia zana ya EduNexus kwa somo lingine.',
})

let deepSeekBehavior: 'success' | 'reject' | 'malformed' = 'success'

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      if (deepSeekBehavior === 'reject') throw new Error('DeepSeek request timed out')
      if (deepSeekBehavior === 'malformed') return 'not json {{{'
      return deepSeekBehavior === 'success' && currentTarget === 'mission'
        ? VALID_MISSION_RESPONSE
        : VALID_REFLECTION_RESPONSE
    },
  },
})
mock.module('@/lib/ai/logger', {
  namedExports: { logAICall: async () => {} }, // no-op — a real DB-backed logging test is out of scope here
})

let currentTarget: 'reflection' | 'mission' = 'reflection'
let scoreReflection: (input: ReflectionInput, userId?: string) => Promise<ReflectionFeedback>
let scoreMissionComparison: (
  mission: Pick<AcademyMission, 'title' | 'mission_type' | 'description'>,
  input: MissionInput,
  userId?: string
) => Promise<MissionVerdict>

before(async () => {
  ;({ scoreReflection, scoreMissionComparison } = await import('./aiJudge'))
})

const LONG_REFLECTION: ReflectionInput = {
  lesson_id: '00000000-0000-0000-0000-000000000001',
  module_id: '00000000-0000-0000-0000-000000000002',
  tried: 'I tried the AI lesson planner with my Grade 8 Mathematics class on fractions this week.',
  worked: 'Learners engaged well with the visual examples and asked follow-up questions I had not anticipated.',
  failed: 'Some learners struggled to connect the abstract fraction rules to the visual representation.',
  surprised: 'One quiet learner who rarely participates gave the clearest explanation of equivalent fractions.',
  next_action: 'I will build in more paired discussion time before moving to independent practice.',
}

const MISSION_STUB: Pick<AcademyMission, 'title' | 'mission_type' | 'description'> = {
  title: 'Compare two lesson planners',
  mission_type: 'compare',
  description: 'Compare EduNexus output against a generic AI tool for the same CBC topic.',
}

const LONG_MISSION_INPUT: MissionInput = {
  mission_id: '00000000-0000-0000-0000-000000000003',
  tool_a_output: 'Generic tool gave a generic five-paragraph lesson plan with no CBC strand references at all.',
  tool_b_output: 'EduNexus gave a CBC-aligned plan referencing the specific strand and sub-strand for this topic.',
  comparison_notes: 'EduNexus was clearly more curriculum-aligned and saved me real planning time this week.',
  self_scores: { relevance: 4, depth: 4 },
}

test('reflection — AI success → isFallback is false and the real judgement is returned', async () => {
  currentTarget = 'reflection'
  deepSeekBehavior = 'success'
  const feedback = await scoreReflection(LONG_REFLECTION)
  assert.equal(feedback.isFallback, false)
  assert.equal(feedback.quality_score, 4)
  assert.equal(feedback.growth_indicator, 'deep')
})

test('reflection — AI timeout → isFallback is true, heuristic score kept but flagged', async () => {
  currentTarget = 'reflection'
  deepSeekBehavior = 'reject'
  const feedback = await scoreReflection(LONG_REFLECTION)
  assert.equal(feedback.isFallback, true)
  assert.ok(feedback.quality_score >= 1 && feedback.quality_score <= 5)
})

test('reflection — malformed AI JSON → isFallback is true', async () => {
  currentTarget = 'reflection'
  deepSeekBehavior = 'malformed'
  const feedback = await scoreReflection(LONG_REFLECTION)
  assert.equal(feedback.isFallback, true)
})

test('reflection — too short for AI (word count < 15) → isFallback is true, no AI call made', async () => {
  currentTarget = 'reflection'
  deepSeekBehavior = 'success' // proves the short-circuit never even reaches the (mocked) AI call
  const feedback = await scoreReflection({
    ...LONG_REFLECTION,
    tried: 'Tried it.', worked: 'Ok.', failed: 'None.', surprised: '', next_action: 'More.',
  })
  assert.equal(feedback.isFallback, true)
  assert.equal(feedback.quality_score, 1)
})

test('mission — AI success → isFallback is false', async () => {
  currentTarget = 'mission'
  deepSeekBehavior = 'success'
  const verdict = await scoreMissionComparison(MISSION_STUB, LONG_MISSION_INPUT)
  assert.equal(verdict.isFallback, false)
  assert.equal(verdict.ai_score, 4)
})

test('mission — AI timeout → isFallback is true', async () => {
  currentTarget = 'mission'
  deepSeekBehavior = 'reject'
  const verdict = await scoreMissionComparison(MISSION_STUB, LONG_MISSION_INPUT)
  assert.equal(verdict.isFallback, true)
})

test('mission — malformed AI JSON → isFallback is true', async () => {
  currentTarget = 'mission'
  deepSeekBehavior = 'malformed'
  const verdict = await scoreMissionComparison(MISSION_STUB, LONG_MISSION_INPUT)
  assert.equal(verdict.isFallback, true)
})
