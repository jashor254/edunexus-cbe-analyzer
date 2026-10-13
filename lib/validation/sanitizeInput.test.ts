// lib/validation/sanitizeInput.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeInput } from './helpers'

test('sanitizeInput removes every angle bracket, so no tag can survive', () => {
  assert.equal(sanitizeInput('<script>alert(1)</script>'), 'scriptalert(1)/script')
  assert.equal(sanitizeInput('<scr<script>ipt>alert(1)'), 'scrscriptiptalert(1)')
  assert.equal(sanitizeInput('<img src=x onerror=alert(1)>'), 'img src=x onerror=alert(1)')
  assert.doesNotMatch(sanitizeInput('<<b>>x<</b>>'), /[<>]/)
})

test('sanitizeInput keeps ordinary text, trims, and caps length', () => {
  assert.equal(sanitizeInput('  Grade 7 maths: 3 & 4  '), 'Grade 7 maths: 3 & 4')
  assert.equal(sanitizeInput('a'.repeat(1200)).length, 1000)
})
