// lib/learnerIntelligence/careerMode.architecture.test.ts
//
// Career Intelligence Canonicalization Phase 1 — proves the Career
// Principle grade gate (Junior Grade 7-9 = exploration, never a ranked
// prediction) is decided in exactly one place. Before this sprint the
// `grade >= 7 && grade <= 9` boundary was independently reimplemented in 4
// places (lib/learnerIntelligence/careerIntelligence.ts,
// app/api/career/capability-matches/route.ts,
// app/api/parent/career-intelligence/route.ts,
// lib/career/careerIntelligenceEngine.ts) with nothing enforcing they stay
// in agreement. Walks the real source tree (no mocks, no DB) and asserts
// every known career-mode call site now calls careerModeForGrade() instead
// of re-deriving the boundary.
//
// Run: npx tsx --test lib/learnerIntelligence/careerMode.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

const CANONICAL_FILE = path.join(ROOT, 'lib/learnerIntelligence/careerIntelligence.ts')

// The 4 sites the pre-Phase-1 audit found independently deciding Junior vs
// Senior. Any new career-mode consumer must be added here and to the import
// check below — a silent 5th reimplementation is exactly what this test
// exists to catch.
const CALL_SITES = [
  path.join(ROOT, 'app/api/career/capability-matches/route.ts'),
  path.join(ROOT, 'app/api/parent/career-intelligence/route.ts'),
  path.join(ROOT, 'lib/career/careerIntelligenceEngine.ts'),
]

// Matches a re-derived Junior/Senior boundary, e.g. `grade >= 7 && grade <= 9`
// or `clinicReport.grade >= 7 && clinicReport.grade <= 9` — any inline
// re-implementation of the Career Principle gate, in either operand order.
const REIMPLEMENTED_BOUNDARY_PATTERN = /\bgrade\s*>=\s*7\s*&&\s*[\w.]*grade\s*<=\s*9\b/

test('careerModeForGrade is defined exactly once, in the canonical Career Intelligence module', () => {
  const definitionPattern = /export\s+function\s+careerModeForGrade\s*\(/
  const allFiles = [CANONICAL_FILE, ...CALL_SITES]
  const definers = allFiles.filter(f => definitionPattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(definers, [CANONICAL_FILE])
})

test('every known career-mode call site imports careerModeForGrade from the canonical module', () => {
  const importPattern = /careerModeForGrade.*from\s+['"]@\/lib\/learnerIntelligence\/careerIntelligence['"]/
  const offenders = CALL_SITES.filter(f => !importPattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('no call site re-derives the grade >= 7 && grade <= 9 boundary inline', () => {
  const offenders = CALL_SITES.filter(f => REIMPLEMENTED_BOUNDARY_PATTERN.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('the canonical module itself still contains exactly the boundary careerModeForGrade encodes', () => {
  const content = readFileSync(CANONICAL_FILE, 'utf8')
  assert.match(content, REIMPLEMENTED_BOUNDARY_PATTERN)
})
