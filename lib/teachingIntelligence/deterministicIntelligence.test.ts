// lib/teachingIntelligence/deterministicIntelligence.test.ts
//
// Calls removed by the AI-call remediation (docs/audits/ai-call-efficiency-deep-audit.md
// AI-16, AI-17, AI-07). Each is proven to make NO provider call: every AI
// wrapper is mocked to throw, so any accidental call fails the test.
//
//   Root cause: ambiguous counters → UNKNOWN, never a guessed diagnosis.
//   Weekly note: the threshold rule the old prompt described, applied exactly.
//   Reflection suggestions: three subject-specific starters, deterministic.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/teachingIntelligence/deterministicIntelligence.test.ts
import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { SubstrandHealthRow } from './types'

let providerCalls = 0
const forbidden = async (): Promise<never> => { providerCalls++; throw new Error('an AI provider was called from a deterministic path') }

mock.module('@/lib/ai/gemini', { namedExports: { callGemini: forbidden, callGeminiJSON: forbidden } })
mock.module('@/lib/ai/deepseek', { namedExports: { callDeepSeek: forbidden } })
mock.module('@/lib/repositories', { namedExports: { repos: {} } })

let classifyRootCause: typeof import('./rootCauseClassifier').classifyRootCause
let buildTeacherNote: typeof import('./weeklyGenerator').buildTeacherNote
let generateReflectionSuggestions: typeof import('@/lib/lessonPlan/generator').generateReflectionSuggestions

before(async () => {
  ;({ classifyRootCause } = await import('./rootCauseClassifier'))
  ;({ buildTeacherNote } = await import('./weeklyGenerator'))
  ;({ generateReflectionSuggestions } = await import('@/lib/lessonPlan/generator'))
})

function row(overrides: Partial<SubstrandHealthRow>): SubstrandHealthRow {
  return {
    id: 'h1', sow_id: 's1', teacher_id: 't1', strand: 'Numbers', sub_strand: 'Fractions',
    struggle_count: 1, lessons_covered: 3, assessment_level: null, remediated: false,
    root_cause: null, risk_score: 0, last_flagged: null, resolved_at: null,
    ...overrides,
  } as SubstrandHealthRow
}

// ── Root cause ───────────────────────────────────────────────────────────────

test('root cause: counters that cannot distinguish a cause → UNKNOWN, with no AI call', () => {
  // Both shapes used to go to Gemini to "pick" between four causes.
  assert.equal(classifyRootCause(row({ struggle_count: 1, lessons_covered: 3 })), 'UNKNOWN')
  assert.equal(classifyRootCause(row({ struggle_count: 3, lessons_covered: 4, remediated: true })), 'UNKNOWN')
  assert.equal(providerCalls, 0)
})

test('root cause: the two inspectable rule patterns are preserved', () => {
  assert.equal(classifyRootCause(row({ struggle_count: 2, remediated: false })), 'PACE_MISMATCH')
  assert.equal(classifyRootCause(row({ struggle_count: 1, lessons_covered: 1 })), 'CONCEPT_LEAP')
})

test('root cause: ambiguous input can never yield one of the four evidence-free diagnoses', () => {
  const unsupported = new Set(['PREREQUISITE_GAP', 'LANGUAGE_BARRIER', 'RESOURCE_MISMATCH', 'TEACHER_STRATEGY'])
  for (const struggle of [1, 2, 3, 5]) for (const covered of [0, 1, 2, 6]) for (const remediated of [true, false]) {
    const code = classifyRootCause(row({ struggle_count: struggle, lessons_covered: covered, remediated }))
    assert.ok(!unsupported.has(code), `struggle=${struggle} covered=${covered} remediated=${remediated} → ${code}`)
  }
})

test('the classifier and weekly generator modules no longer import any AI wrapper', () => {
  for (const file of ['lib/teachingIntelligence/rootCauseClassifier.ts', 'lib/teachingIntelligence/weeklyGenerator.ts']) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /from '@\/lib\/ai\/(gemini|deepseek)'/, file)
  }
})

// ── Weekly note ──────────────────────────────────────────────────────────────

const note = (o: Partial<Parameters<typeof buildTeacherNote>[0]>) => buildTeacherNote({
  learningArea: 'Mathematics', grade: 'Grade 8', weekNumber: 6, healthScore: 80, lessonsAnalyzed: 4,
  newFlags: [], persistentFlags: [], resolvedFlags: [], ...o,
})

test('weekly note: the old prompt\'s thresholds — >70 solid, 50–70 mixed, <50 challenging', () => {
  assert.match(note({ healthScore: 71 }), /^A solid week/)
  assert.match(note({ healthScore: 70 }), /^A mixed week/)
  assert.match(note({ healthScore: 50 }), /^A mixed week/)
  assert.match(note({ healthScore: 49 }), /^A challenging week/)
})

test('weekly note: names new, ongoing and resolved sub-strands from the real data', () => {
  const text = note({
    healthScore: 55,
    newFlags: [row({ sub_strand: 'Ratios' }), row({ sub_strand: 'Percentages' })],
    persistentFlags: [row({ sub_strand: 'Fractions' })],
    resolvedFlags: [row({ sub_strand: 'Integers' })],
  })
  assert.match(text, /Ratios and Percentages/)
  assert.match(text, /Fractions still needs attention/)
  assert.match(text, /resolving Integers/)
  assert.match(text, /55\/100 across 4 evaluated lessons/)
  assert.doesNotMatch(text, /\b(gap|failing|weak|critical)\b/i, 'same banned framing as the quick check')
})

test('weekly note: a quiet week says so rather than inventing concerns', () => {
  assert.match(note({}), /No follow-ups are outstanding/)
  assert.match(note({ lessonsAnalyzed: 1 }), /1 evaluated lesson\b/)
})

// ── Reflection suggestions ───────────────────────────────────────────────────

test('reflection suggestions: three distinct, subject-specific starters with no AI call', async () => {
  const base = {
    teacherName: '', tscNumber: '', school: '', grade: 'Grade 8', term: 2, year: 2026,
    weekNumber: 3, lessonNumber: 1, strand: 'Numbers', subStrand: 'Fractions',
    learningOutcomes: ['add fractions with unlike denominators'], keyInquiryQuestions: [],
    learningResources: [], learningExperiences: [], assessmentMethods: [],
  }
  const maths = await generateReflectionSuggestions({ ...base, learningArea: 'Mathematics' }, '2026-10-30')
  assert.equal(maths.length, 3)
  assert.equal(new Set(maths).size, 3)
  assert.ok(maths.some(s => s.includes('add fractions with unlike denominators')), 'uses the real outcome')

  const kisw = await generateReflectionSuggestions({ ...base, learningArea: 'Kiswahili' }, '2026-10-30')
  assert.ok(kisw.every(s => /wanafunzi/i.test(s)), 'Kiswahili lessons get Kiswahili starters')
  assert.equal(providerCalls, 0)
})
