// Rendered review card (audit F-02). Behavioural assertions per section —
// what the learner sees vs the marked answer vs stored notes — not CSS.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import VariantReviewContent from './VariantReviewContent'
import { buildVariantReviewModel, type ReviewableVariant } from '@/lib/assignments/variantReview'

function render(v: Partial<ReviewableVariant>, canonical?: { choices: string[]; correctIndex: number }): string {
  const model = buildVariantReviewModel({
    variant_type: 'foundation',
    question_text: 'Which material is a non-conductor of electricity?',
    choices: ['Copper wire', 'Aluminium foil', 'Rubber', 'A steel spoon'],
    correct_index: 2,
    ...v,
  }, canonical)
  return renderToStaticMarkup(<VariantReviewContent model={model} />)
}

/** Inner markup of one labelled area of the card. */
function area(html: string, label: string): string {
  const attr = html.indexOf(`aria-label="${label}"`)
  assert.notEqual(attr, -1, `missing area "${label}"`)
  const start = html.indexOf('>', attr) + 1
  return html.slice(start, html.indexOf('</section>', start))
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
}

test('A: learner area shows the full question and every option; the answer area names the right option by letter AND text', () => {
  const html = render({})
  const learner = text(area(html, 'What the learner sees'))
  assert.match(learner, /Which material is a non-conductor of electricity\?/)
  for (const option of ['A. Copper wire', 'B. Aluminium foil', 'C. Rubber', 'D. A steel spoon']) assert.ok(learner.includes(option), option)
  assert.equal(text(area(html, 'Marked correct answer')), 'MARKED CORRECT ANSWER C. Rubber')
  assert.match(text(area(html, 'What the learner does')), /Chooses one option \(A–D\)/)
})

test('A: the learner area carries no correctness marking — the key lives only in its own area', () => {
  const learner = text(area(render({}), 'What the learner sees'))
  assert.doesNotMatch(learner, /correct|answer key|marked/i)
})

test('B: two versions with different options each render their own key, never the other one', () => {
  const first = render({ choices: ['Rubber', 'Copper wire', 'Aluminium foil', 'A steel spoon'], correct_index: 0 })
  const second = render({ choices: ['Copper wire', 'Aluminium foil', 'A steel spoon', 'Dry wood'], correct_index: 3 })
  assert.equal(text(area(first, 'Marked correct answer')).startsWith('MARKED CORRECT ANSWER A. Rubber'), true)
  assert.equal(text(area(second, 'Marked correct answer')).startsWith('MARKED CORRECT ANSWER D. Dry wood'), true)
  assert.doesNotMatch(text(area(second, 'What the learner sees')), /Rubber/)
})

test('B: differences from the saved original question are called out for the teacher', () => {
  const canonical = { choices: ['Copper wire', 'Aluminium foil', 'Rubber', 'A steel spoon'], correctIndex: 2 }
  const moved = text(area(render({ choices: ['Rubber', 'Copper wire', 'Aluminium foil', 'A steel spoon'], correct_index: 0 }, canonical), 'Marked correct answer'))
  assert.match(moved, /Same correct answer as your original, but it is now option A instead of C/)
  assert.match(moved, /answer options are reworded, reordered or different/)

  const changed = text(area(render({ choices: ['Copper wire', 'Aluminium foil', 'Dry wood', 'A steel spoon'], correct_index: 2 }, canonical), 'Marked correct answer'))
  assert.match(changed, /correct answer is different from your original question's answer \(option C there\)/)

  const same = text(area(render({}, canonical), 'Marked correct answer'))
  assert.equal(same, 'MARKED CORRECT ANSWER C. Rubber')
})

test('E: a worked-step stem keeps its steps and line breaks in the learner area; the solution stays in the answer area', () => {
  const stem = 'Step 1: Angles on a straight line add up to 180°.\nStep 2: One angle is 130°.\nWork out the other angle.'
  const html = render({ question_text: stem, choices: ['40°', '50°', '130°', '230°'], correct_index: 1 })
  const learnerHtml = area(html, 'What the learner sees')
  assert.ok(learnerHtml.includes(stem), 'stem rendered verbatim, newlines intact')
  assert.match(learnerHtml, /whitespace-pre-line/) // the only way stored line breaks survive HTML rendering
  assert.equal(text(area(html, 'Marked correct answer')), 'MARKED CORRECT ANSWER B. 50°')
})

test('F: stored notes render under their own labels; absent notes are said to be absent, not invented', () => {
  const withNotes = text(render({
    learning_outcome: 'Classify materials as conductors or insulators',
    difficulty_rationale: 'Adds a worked example',
    expected_misconceptions: ['Thinks all solids conduct'],
    teacher_explanation: 'Rubber does not let current flow.',
    learner_explanation: 'Rubber is an insulator.',
  }))
  assert.match(withNotes, /Learning outcome Classify materials as conductors or insulators/)
  assert.match(withNotes, /Why this level of support Adds a worked example/)
  assert.match(withNotes, /Likely mistakes Thinks all solids conduct/)
  assert.match(withNotes, /Explanation for teachers Rubber does not let current flow\./)
  assert.match(withNotes, /Explanation written for learners \(not shown to learners in the app today\) Rubber is an insulator\./)

  const without = text(render({}))
  assert.match(without, /No marking notes are stored for this version\./)
  assert.doesNotMatch(without, /Learning outcome|Likely mistakes/)
})

test('F: no stored options — no empty option list, honest format, no invented key, approval-off notice', () => {
  const html = render({ choices: [], correct_index: 0 })
  assert.doesNotMatch(html, /aria-label="Answer options"/)
  const all = text(html)
  assert.match(all, /can't be fully checked/)
  assert.match(all, /No answer options are stored for this version\./)
  assert.match(all, /Approval is turned off for it/)
  assert.match(text(area(html, 'What the learner does')), /Can’t be determined/)
  assert.match(text(area(html, 'Marked correct answer')), /No valid correct answer is marked\./)
})

test('F: an out-of-range key renders every option unmarked and says so', () => {
  const html = render({ correct_index: 9 })
  assert.match(text(area(html, 'Marked correct answer')), /No valid correct answer is marked\./)
  assert.match(text(html), /The marked correct answer does not match any stored option\./)
  assert.ok(text(area(html, 'What the learner sees')).includes('D. A steel spoon'))
})

test('a fully reviewable version shows no warning', () => {
  assert.doesNotMatch(render({}), /role="alert"/)
})

// ── Audit F-01: automatic checks area ──────────────────────────────────────

test('F-01: a possible giveaway is shown as POSSIBLE with the exact sentence, outside the learner area', () => {
  const html = render({
    question_text: 'If a material does not let electricity pass, the bulb stays dark. The bulb stays dark for rubber. Which material is a non-conductor of electricity?',
  })
  const checks = text(area(html, 'Automatic checks'))
  assert.match(checks, /Possible answer giveaway: your judgement needed\./)
  assert.match(checks, /already names the marked answer/)
  assert.match(checks, /The bulb stays dark for rubber\./)
  assert.match(checks, /left out of bulk approval/)
  assert.doesNotMatch(text(area(html, 'What the learner sees')), /giveaway|judgement|automatic/i)
})

test('F-01: a clean screen says what it could NOT check, instead of claiming the question is safe', () => {
  const checks = text(area(render({}), 'Automatic checks'))
  assert.match(checks, /nothing found in the question's own words/)
  assert.match(checks, /can't spot a giveaway that uses different wording/)
  assert.doesNotMatch(checks, /no giveaway|safe|passed/i)
})

test('F-01: a missing key reports the check as not run; a missing figure is a confirmed problem', () => {
  assert.match(text(area(render({ correct_index: 9 }), 'Automatic checks')), /Answer giveaway check not run: there is no valid marked answer to check against\./)
  const figure = text(area(render({ question_text: 'Study the diagram of the circuit. Which material is a non-conductor of electricity?' }), 'Automatic checks'))
  assert.match(figure, /Confirmed problem: refers to a picture or drawing the learner won't see\./)
  assert.match(figure, /Study the diagram of the circuit\./)
})
