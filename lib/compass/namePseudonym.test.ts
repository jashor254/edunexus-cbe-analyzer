// lib/compass/namePseudonym.test.ts
//
// Stage B2 privacy regression for Compass name pseudonymization:
// - scrubLearnerName removes the learner's own name from text sent to the model
// - makeNameRestorer restores LEARNER_NAME_TOKEN -> firstName in the stream,
//   correctly even when the token is split across chunk boundaries
// Pure functions, STANDARD-safe. See lib/compass/namePseudonym.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEARNER_NAME_TOKEN } from '@/lib/ai/learnerPseudonym'
import { scrubLearnerName, makeNameRestorer } from './namePseudonym'

test('scrubLearnerName replaces whole-word, case-insensitive occurrences with the token', () => {
  assert.equal(
    scrubLearnerName('Hi, my name is Amina and amina loves maths', 'Amina'),
    `Hi, my name is ${LEARNER_NAME_TOKEN} and ${LEARNER_NAME_TOKEN} loves maths`,
  )
})

test('scrubLearnerName does not touch substrings inside other words', () => {
  // "Amin" must not match inside "examine"/"Aminah" boundaries incorrectly
  assert.equal(scrubLearnerName('I will examine it', 'Amin'), 'I will examine it')
})

test('scrubLearnerName is a no-op when there is no real name', () => {
  assert.equal(scrubLearnerName('hello there', 'there'), 'hello there')
  assert.equal(scrubLearnerName('hello', ''), 'hello')
})

test('makeNameRestorer restores a token fully inside one chunk', () => {
  const r = makeNameRestorer('Amina')
  const out = r.push(`Hey ${LEARNER_NAME_TOKEN}! Ready?`) + r.flush()
  assert.equal(out, 'Hey Amina! Ready?')
})

test('makeNameRestorer restores a token SPLIT across two chunks', () => {
  const r = makeNameRestorer('Amina')
  // "{{LEARNER}}" split as "Hey {{LEA" + "RNER}}!"
  let out = r.push('Hey {{LEA')
  out += r.push('RNER}}!')
  out += r.flush()
  assert.equal(out, 'Hey Amina!')
})

test('makeNameRestorer restores a token split character-by-character', () => {
  const r = makeNameRestorer('Amina')
  let out = ''
  for (const ch of `Go, ${LEARNER_NAME_TOKEN}.`) out += r.push(ch)
  out += r.flush()
  assert.equal(out, 'Go, Amina.')
})

test('makeNameRestorer never emits a half-restored token mid-stream', () => {
  const r = makeNameRestorer('Amina')
  const emitted = r.push('Hey {{LEA')
  // The incomplete token must be held back, not emitted raw.
  assert.ok(!emitted.includes('{{LEA'), 'incomplete token must not leak to the client')
  assert.equal(emitted, 'Hey ')
})

test('makeNameRestorer passes through a lone brace that is not a token', () => {
  const r = makeNameRestorer('Amina')
  const out = r.push('use {x} notation ') + r.flush()
  assert.equal(out, 'use {x} notation ')
})

test('makeNameRestorer handles multiple tokens in a stream', () => {
  const r = makeNameRestorer('Amina')
  let out = r.push(`${LEARNER_NAME_TOKEN}, well done `)
  out += r.push(`${LEARNER_NAME_TOKEN}!`)
  out += r.flush()
  assert.equal(out, 'Amina, well done Amina!')
})

// ── Unicode, accent and full-name coverage (privacy re-audit, 2026-10-21) ──
// All names below are synthetic fixtures.
import { scrubLearnerIdentity, OTHER_NAME_PART_TOKEN } from './namePseudonym'

test('scrubLearnerName matches a name ending in a non-ASCII letter (JS \\b is ASCII-only)', () => {
  assert.equal(scrubLearnerName('Hi I am Wanjirũ and I need help', 'Wanjirũ'), `Hi I am ${LEARNER_NAME_TOKEN} and I need help`)
  assert.equal(scrubLearnerName('Ĩmani here', 'Ĩmani'), `${LEARNER_NAME_TOKEN} here`)
})

test('scrubLearnerName is accent-insensitive in both directions', () => {
  // stored "Wanjiru", typed "Wanjirũ" — and the reverse
  assert.equal(scrubLearnerName('Wanjirũ asked', 'Wanjiru'), `${LEARNER_NAME_TOKEN} asked`)
  assert.equal(scrubLearnerName('Wanjiru asked', 'Wanjirũ'), `${LEARNER_NAME_TOKEN} asked`)
})

test('scrubLearnerName handles decomposed (NFD) input and returns NFC', () => {
  const decomposed = 'Wanjirũ asked'
  assert.equal(scrubLearnerName(decomposed, 'Wanjirũ'), `${LEARNER_NAME_TOKEN} asked`)
  assert.equal(scrubLearnerName('café ya Wanjirũ', 'Achieng'), 'café ya Wanjirũ'.normalize('NFC'))
})

test('scrubLearnerName handles punctuation, case and possessives', () => {
  for (const [text, expected] of [
    ["Achieng's homework", `${LEARNER_NAME_TOKEN}'s homework`],
    ['ACHIENG needs help', `${LEARNER_NAME_TOKEN} needs help`],
    ['"Achieng," she said.', `"${LEARNER_NAME_TOKEN}," she said.`],
    ['(achieng)', `(${LEARNER_NAME_TOKEN})`],
    ['achieng123', `${LEARNER_NAME_TOKEN}123`],
    ['Teacher Achieng — Mr. Achieng', `Teacher ${LEARNER_NAME_TOKEN} — Mr. ${LEARNER_NAME_TOKEN}`],
  ] as const) {
    assert.equal(scrubLearnerName(text, 'Achieng'), expected, text)
  }
})

test('scrubLearnerName leaves the name alone when it is part of a longer word', () => {
  assert.equal(scrubLearnerName('Achiengo and Machieng', 'Achieng'), 'Achiengo and Machieng')
})

test('scrubLearnerName handles hyphenated first names and empty text', () => {
  assert.equal(scrubLearnerName('Mary-Anne asked', 'Mary-Anne'), `${LEARNER_NAME_TOKEN} asked`)
  assert.equal(scrubLearnerName('', 'Achieng'), '')
})

test('scrubLearnerName skips single-letter names rather than erasing every "a"', () => {
  assert.equal(scrubLearnerName('a b c', 'A'), 'a b c')
})

test('scrubLearnerIdentity removes surname and middle names, not just the first name', () => {
  const identity = { firstName: 'Wanjirũ', fullName: 'Wanjirũ Njeri Fixturekamau' }
  assert.equal(
    scrubLearnerIdentity('I am Wanjiru Njerĩ FIXTUREKAMAU from Form 2', identity),
    `I am ${LEARNER_NAME_TOKEN} ${OTHER_NAME_PART_TOKEN} ${OTHER_NAME_PART_TOKEN} from Form 2`,
  )
})

test('scrubLearnerIdentity copes with a missing full name and odd spacing', () => {
  assert.equal(scrubLearnerIdentity('Achieng here', { firstName: 'Achieng', fullName: null }), `${LEARNER_NAME_TOKEN} here`)
  assert.equal(
    scrubLearnerIdentity('Achieng Fixtureotieno here', { firstName: 'Achieng', fullName: '  Achieng   Fixtureotieno ' }),
    `${LEARNER_NAME_TOKEN} ${OTHER_NAME_PART_TOKEN} here`,
  )
})

test('scrubLearnerName treats apostrophes as optional and interchangeable (synthetic Ng\'ang\'a)', () => {
  for (const typed of ["Ng'ang'a", 'Ng’ang’a', 'Ngʼangʼa', 'Nganga', 'NGANGA']) {
    assert.equal(scrubLearnerName(`${typed} is here`, "Ng'ang'a"), `${LEARNER_NAME_TOKEN} is here`, typed)
    assert.equal(scrubLearnerName(`${typed} is here`, 'Nganga'), `${LEARNER_NAME_TOKEN} is here`, `stored Nganga / typed ${typed}`)
  }
  // An apostrophe used as a quote mark after the name is left in place.
  assert.equal(scrubLearnerName("'Nganga'", "Ng'ang'a"), `'${LEARNER_NAME_TOKEN}'`)
})

test('scrubLearnerIdentity does not treat an apostrophe variant of the first name as a second name part', () => {
  assert.equal(
    scrubLearnerIdentity('Ng’ang’a here', { firstName: "Ng'ang'a", fullName: "Ng'ang'a Fixturemwangi" }),
    `${LEARNER_NAME_TOKEN} here`,
  )
})
