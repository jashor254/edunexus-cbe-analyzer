// Audit F-01 — the deterministic answer-giveaway screen. Fixtures marked
// "stored" are verbatim Foundation variants generated 2026-10-13 and labelled
// in docs/audits/differentiated-assignment-deep-audit.md §8. Pure; no I/O.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMissingFigureReferences, screenAnswerLeakage, type LeakageScreen } from './answerLeakage'

function screen(questionText: string | null, choices: string[], correctIndex: number | null): LeakageScreen {
  return screenAnswerLeakage({ questionText, choices, correctIndex })
}

function signalKinds(s: LeakageScreen): string[] {
  return s.status === 'possible_leak' ? s.signals.map(x => x.kind) : []
}

// ── A: answer stated before it is asked for ─────────────────────────────────

test('A (stored, Science): the result for the answer is reported before the question → possible giveaway, excerpt quoted', () => {
  const s = screen(
    'A student is testing materials to see if electricity can pass through them. She sets up a simple circuit with a battery, a bulb, and two wires. She touches the free ends of the wires to different materials. If the material lets electricity pass, the bulb lights up. If the material does not let electricity pass, the bulb does not light. She tests four materials: copper wire, aluminium foil, rubber, and a steel spoon. The bulb lights up for copper wire, aluminium foil, and the steel spoon. The bulb does not light up for rubber. Which material is a non-conductor (insulator) of electricity?',
    ['Copper wire', 'Aluminium foil', 'Rubber', 'Steel spoon'], 2,
  )
  assert.deepEqual(signalKinds(s), ['answer_term_stated'])
  assert.equal(s.status === 'possible_leak' && s.signals[0].excerpt, 'The bulb does not light up for rubber.')
})

test('A (stored, Social Studies): the answer\'s wording is already in the supporting text → possible giveaway', () => {
  const s = screen(
    'The Constitution of Kenya is the supreme law of the country. This means that the Constitution is the most powerful law in Kenya. Every other law must agree with it. If a law is made that goes against the Constitution, that law cannot be used. Which of these sentences is true about the Constitution of Kenya?',
    ['It applies only to people living in Nairobi.', 'It can be changed by any leader at any time.', 'It is only used in courts during criminal cases.', 'Any law that goes against the Constitution is invalid.'], 3,
  )
  assert.deepEqual(signalKinds(s), ['answer_wording_in_stem'])
})

// ── B: mathematical giveaway ────────────────────────────────────────────────

test('B (stored, Maths recall): "A half turn is 180°" before asking what the angles add up to → value stated', () => {
  const s = screen(
    'Look at the straight line below. A straight line makes a half turn. A half turn is 180°. Two angles sit on the straight line and together they make the whole half turn. So the two angles together add up to 180°. Therefore, angles on a straight line add up to:',
    ['90°', '180°', '270°', '360°'], 1,
  )
  assert.deepEqual(signalKinds(s), ['answer_value_stated'])
})

test('B: a completed calculation whose result is the marked answer → value stated', () => {
  const s = screen(
    'Angles on a straight line add up to 180°. One angle is 130°, so the other is 180° − 130° = 50°. What is the size of the other angle?',
    ['40°', '50°', '130°', '230°'], 1,
  )
  assert.deepEqual(signalKinds(s), ['answer_value_stated'])
})

// ── C / D: legitimate scaffolding is not flagged ────────────────────────────

test('C (stored, Maths): a formula reminder and steps that stop before the subtraction → no signal', () => {
  const s = screen(
    'Look at the straight line below. Two angles sit next to each other on it and together they make the straight line.\n\nStep 1: A straight line is a half turn. A half turn is 180°.\nStep 2: The two angles together must add up to 180°.\nStep 3: One angle is 130°.\nStep 4: Work out 180° − 130° to find the other angle.\n\nWhat is the size of the other angle?',
    ['40°', '50°', '130°', '230°'], 1,
  )
  assert.equal(s.status, 'no_signal')
})

test('D (stored, Maths): a worked example on different numbers, then the learner\'s own case → no signal', () => {
  const s = screen(
    'Angles on a straight line always add up to 180°. Look at this example: If two angles on a straight line are 30° and 50°, the third angle is 180° − 30° − 50° = 100°. Now try this one: Three angles lie on a straight line. Two of them are 40° and 75°. Work out the third angle by first adding 40° and 75°, then subtracting that total from 180°.',
    ['55°', '65°', '75°', '115°'], 1,
  )
  assert.equal(s.status, 'no_signal')
})

test('D (stored, Science): a worked example about copper, then a list of the options to choose from → no signal', () => {
  const s = screen(
    'Electricity flows easily through some materials. These materials are called conductors. Look at the example below.\n\nExample: A copper wire is a conductor. Electricity flows through it easily.\n\nNow look at these materials:\n- A plastic ruler\n- An iron nail\n- A piece of dry wood\n- A rubber band\n\nWhich material is a conductor of electricity?',
    ['A plastic ruler', 'An iron nail', 'A piece of dry wood', 'A rubber band'], 1,
  )
  assert.equal(s.status, 'no_signal')
})

// ── E: plain recall is preserved ────────────────────────────────────────────

test('E: a recall question that does not contain its answer → no signal (nothing to flag, task intact)', () => {
  assert.equal(screen('Angles on a straight line add up to:', ['90°', '180°', '270°', '360°'], 1).status, 'no_signal')
  assert.equal(screen('What is a constitution?', ['A list of schools', 'The supreme law that sets out how a country is governed', 'A yearly speech', 'A family rule'], 1).status, 'no_signal')
})

test('E: words the question itself asks about are topic, not a giveaway', () => {
  // "constitution" is in both the question and the answer; it must not count.
  const s = screen('Read carefully. The Constitution matters. Which statement about the Constitution is true?',
    ['The Constitution is a song', 'The Constitution is the supreme law', 'The Constitution is a school', 'The Constitution is a map'], 1)
  assert.equal(s.status, 'no_signal')
})

// ── F: more support is not, by itself, a problem ────────────────────────────

test('F: a long, heavily scaffolded version is judged on content, not length', () => {
  const long = [
    'Electricity is a flow of tiny charges.',
    'Some materials let the charges move easily; we test them with a bulb in a circuit.',
    'Think about what metals are like and what plastics are like.',
    'Remember to look at what each object is made of.',
    'Which object will make the bulb light?',
  ].join(' ')
  assert.equal(screen(long, ['A rubber eraser', 'A piece of paper', 'A metal coin', 'A glass marble'], 2).status, 'no_signal')
})

// ── G: missing information is reported, never guessed ───────────────────────

test('G: no answer key or no question text → not checked (no false assurance either way)', () => {
  assert.deepEqual(screen('Which is a conductor?', ['Rubber', 'Copper'], null), { status: 'not_checked', reason: 'no_answer_key' })
  assert.deepEqual(screen('Which is a conductor?', ['Rubber', 'Copper'], 5), { status: 'not_checked', reason: 'no_answer_key' })
  assert.deepEqual(screen('   ', ['Rubber', 'Copper'], 1), { status: 'not_checked', reason: 'no_question_text' })
})

// ── Known limitation, pinned so it is never mistaken for coverage ───────────

test('LIMITATION (stored, Science): a paraphrased giveaway is NOT caught — the screen compares words, not meaning', () => {
  const s = screen(
    'Think about how electricity travels through a wire. A wire needs a material that lets electricity move through it easily. Copper is used inside an electric cable. Which sentence explains why copper is chosen?',
    ['Copper is a good conductor of electricity', 'Copper stops electricity from passing through', 'Copper protects people from electric shocks', 'Copper is a non-conductor of electricity'], 0,
  )
  assert.equal(s.status, 'no_signal')
})

// ── Missing figures (confirmed content problem) ─────────────────────────────

test('figure references: a drawn shape "below" is reported; a text example "below" is not', () => {
  assert.deepEqual(findMissingFigureReferences('Look at the straight line below. A half turn is 180°.'), [{ excerpt: 'Look at the straight line below.' }])
  assert.deepEqual(findMissingFigureReferences('Study the diagram of the circuit. Which bulb lights?'), [{ excerpt: 'Study the diagram of the circuit.' }])
  assert.deepEqual(findMissingFigureReferences('Look at the example below.\n\nExample: A copper wire is a conductor.'), [])
  assert.deepEqual(findMissingFigureReferences(null), [])
})
