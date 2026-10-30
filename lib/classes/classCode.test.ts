// lib/classes/classCode.test.ts
//
// Security audit 2026-10-30, F-02: new Solo Teacher class codes must carry
// enough unpredictable entropy that guessing one is infeasible, and must
// not depend on Math.random.
//
// Run with: npx tsx --test lib/classes/classCode.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateClassCode, CLASS_CODE_ALPHABET, CLASS_CODE_RANDOM_LENGTH } from './classCode'

const RANDOM_TAIL = new RegExp(`^MAT825[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_RANDOM_LENGTH}}$`)

test('the alphabet has exactly 32 distinct, unambiguous symbols (uniform randomInt, no modulo bias)', () => {
  assert.equal(CLASS_CODE_ALPHABET.length, 32)
  assert.equal(new Set(CLASS_CODE_ALPHABET).size, 32)
  for (const ambiguous of ['0', 'O', '1', 'I']) assert.ok(!CLASS_CODE_ALPHABET.includes(ambiguous), ambiguous)
})

test('codes keep the readable subject/grade/year prefix and add at least 8 random symbols', () => {
  assert.ok(CLASS_CODE_RANDOM_LENGTH >= 8)
  for (let i = 0; i < 200; i++) {
    const code = generateClassCode('Mathematics', 8, '2025')
    assert.match(code, RANDOM_TAIL)
  }
})

test('codes do not depend on Math.random', (t) => {
  t.mock.method(Math, 'random', () => 0.5)
  const codes = new Set(Array.from({ length: 50 }, () => generateClassCode('Mathematics', 8, '2025')))
  assert.ok(codes.size > 45, `only ${codes.size} distinct codes with Math.random pinned`)
})

test('codes are effectively unique across a large sample', () => {
  const codes = new Set(Array.from({ length: 5000 }, () => generateClassCode('English', 9, '2026')))
  assert.equal(codes.size, 5000)
})

test('every alphabet symbol appears in the random tail (no dead symbols)', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 2000; i++) {
    for (const ch of generateClassCode('Science', 7, '2026').slice('SCI726'.length)) seen.add(ch)
  }
  assert.equal(seen.size, 32)
})
