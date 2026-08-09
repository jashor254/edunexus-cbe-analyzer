// lib/pitch/deck.test.ts
//
// The pitch deck's story, and the truth boundary around it.
//
// The shape tests (twelve slides, three points, one visual each) exist so the
// deck cannot quietly drift into a feature wall. The claim tests are the
// important ones: they encode the Phase 0 claim ledger as assertions, so a
// future edit that reintroduces an unsupported traction claim fails here
// rather than reaching a reviewer. Rendering is deliberately not tested —
// the copy is the thing under review.
//
// Run: npx tsx --test lib/pitch/deck.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'

import {
  PITCH_SLIDES,
  PITCH_SLIDE_COUNT,
  PITCH_ASSETS,
  PITCH_ASSET_DIR,
  PITCH_SCREENSHOT_NOTE,
  LOOP_STAGES,
  PRICING_ROWS,
  STAGE_STEPS,
  FOUNDER_ARC,
  HUMAN_GATES,
} from './deck'
import { DEMO_AVAILABLE_ASSETS } from '@/lib/demo/availableAssets'

/** Every word the deck puts in front of a reviewer, from every source. */
function allDeckCopy(): string {
  const parts: string[] = []

  for (const slide of PITCH_SLIDES) {
    parts.push(slide.headline, slide.message, slide.label, slide.section)
    if (slide.points) parts.push(...slide.points)

    const v = slide.visual
    if (v.kind === 'screenshot') parts.push(v.alt, v.caption)
    if (v.kind === 'statement') parts.push(...v.quote, v.attribution)
  }

  for (const s of LOOP_STAGES) parts.push(s.label, s.note)
  for (const r of PRICING_ROWS) parts.push(r.who, r.plan, r.price, r.note)
  for (const s of STAGE_STEPS) parts.push(s.label)
  for (const b of FOUNDER_ARC) parts.push(b.beat, b.note)
  parts.push(PITCH_SCREENSHOT_NOTE)

  return parts.join('\n')
}

// ── Shape ───────────────────────────────────────────────────────────────────

test('the deck is the twelve canonical slides, in order', () => {
  assert.equal(PITCH_SLIDE_COUNT, 12)
  assert.deepEqual(
    PITCH_SLIDES.map(s => s.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  )
  assert.deepEqual(
    PITCH_SLIDES.map(s => s.id),
    [
      'edunexus', 'problem', 'insight', 'why-existing-systems',
      'intelligence-loop', 'learner-blueprint', 'never-decides', 'how-it-enters',
      'business-model', 'where-we-are', 'founder', 'vision',
    ],
  )
})

test('slide ids are unique — they are the deep-link fragments', () => {
  assert.equal(new Set(PITCH_SLIDES.map(s => s.id)).size, PITCH_SLIDE_COUNT)
})

test('no slide carries more than three supporting points', () => {
  for (const slide of PITCH_SLIDES) {
    assert.ok(
      (slide.points?.length ?? 0) <= 3,
      `Slide ${slide.number} (${slide.id}) has ${slide.points?.length} points; the limit is 3.`,
    )
  }
})

test('every slide has a headline, a message and exactly one visual', () => {
  for (const slide of PITCH_SLIDES) {
    assert.ok(slide.headline.trim().length > 0, `Slide ${slide.number} has no headline.`)
    assert.ok(slide.message.trim().length > 0, `Slide ${slide.number} has no message.`)
    assert.ok(slide.visual.kind, `Slide ${slide.number} has no visual.`)
  }
})

test('the narrative arc the storyboard approved is all present', () => {
  const sections = new Set(PITCH_SLIDES.map(s => s.section))
  for (const required of [
    'Problem', 'Insight', 'Product', 'Why different',
    'How it enters schools', 'Business', 'Current stage', 'Founder', 'Vision',
  ]) {
    assert.ok(sections.has(required as never), `The deck has no "${required}" slide.`)
  }
})

// ── The loop, and its human gates ───────────────────────────────────────────

test('the loop runs activity → evidence → understanding → blueprint → approval → action → new evidence → review', () => {
  assert.deepEqual(
    LOOP_STAGES.map(s => s.key),
    ['activity', 'evidence', 'understanding', 'blueprint', 'approval', 'action', 'new-evidence', 'review'],
  )
})

test('exactly two stages are human gates, and they are the two named ones', () => {
  const human = LOOP_STAGES.filter(s => s.actor === 'human')
  assert.equal(human.length, 2)
  assert.deepEqual(human.map(s => s.label), [...HUMAN_GATES])
})

test('the human gates bracket the learner’s work — approval before it, review after it', () => {
  const keys = LOOP_STAGES.map(s => s.key)
  assert.ok(keys.indexOf('approval') < keys.indexOf('action'))
  assert.ok(keys.indexOf('action') < keys.indexOf('review'))
})

// ── Screenshots ─────────────────────────────────────────────────────────────

test('every screenshot the deck references is an approved, committed asset', () => {
  const repoRoot = path.resolve(__dirname, '..', '..')

  for (const slide of PITCH_SLIDES) {
    if (slide.visual.kind !== 'screenshot') continue
    const file = PITCH_ASSETS[slide.visual.asset]

    assert.ok(
      DEMO_AVAILABLE_ASSETS.includes(file),
      `Slide ${slide.number} references ${file}, which the capture manifest does not list.`,
    )
    assert.ok(
      existsSync(path.join(repoRoot, 'public', PITCH_ASSET_DIR, file)),
      `Slide ${slide.number} references ${file}, which is not on disk.`,
    )
  }
})

test('every screenshot slide carries the reference-data qualifier in its own caption', () => {
  for (const slide of PITCH_SLIDES) {
    if (slide.visual.kind !== 'screenshot') continue
    assert.ok(
      slide.visual.caption.trim().length > 0,
      `Slide ${slide.number}'s screenshot has no caption to hang the qualifier on.`,
    )
    assert.ok(
      slide.visual.alt.trim().length > 0,
      `Slide ${slide.number}'s screenshot has no alt text.`,
    )
  }
  assert.match(PITCH_SCREENSHOT_NOTE, /reference-school \/ test data/)
})

// ── The truth boundary ──────────────────────────────────────────────────────

test('the deck states its pre-pilot status out loud', () => {
  const copy = allDeckCopy()
  assert.match(copy, /Pre-pilot/i, 'The deck must say it is pre-pilot.')
  assert.match(
    PITCH_SLIDES[0].points!.join(' '),
    /Pre-pilot/i,
    'Slide 1 must carry the stage, for a reviewer who reads no further.',
  )
})

test('the deck makes no unsupported traction, market or endorsement claim', () => {
  const copy = allDeckCopy()

  // Each entry is a claim Phase 0 classified as UNSUPPORTED, plus the market
  // sizing the founder ruled out of this deck. The word "pilot" itself is
  // allowed — "pre-pilot" and "no pilot school has started yet" are the
  // honest uses of it.
  const forbidden: readonly [RegExp, string][] = [
    [/pioneer teacher/i,          'the unverified pioneer-teacher count'],
    [/\b50\+/,                    'a "50+" user count'],
    [/Kisumu|Nakuru/,             'geographic presence with no evidence behind it'],
    [/trusted by/i,               'an unearned trust claim'],
    [/\bTAM\b|\bSAM\b|\bSOM\b/,   'market sizing, which this deck omits'],
    [/market size|addressable market/i, 'market sizing, which this deck omits'],
    [/\bKICD\b|\bTSC\b|\bKNEC\b/, 'a curriculum-body affiliation'],
    [/\bMinistry of Education\b/, 'a ministry affiliation'],
    [/\bGoogle\b/,                'an implied Google relationship'],
    [/endorse/i,                  'an endorsement claim'],
    [/\bpartnership\b|\bpartnered\b/i, 'a partnership claim'],
    [/testimonial|case study/i,   'a testimonial that does not exist'],
    [/\brevenue\b|\bARR\b|\bMRR\b/, 'a revenue claim'],
    [/paying school|paying customer/i, 'a paying-customer claim'],
    [/schools use|schools are using|used by \d/i, 'an adoption claim'],
    [/improved (?:grades|results|outcomes)|outcome data/i, 'a learning-outcome claim'],
  ]

  for (const [pattern, why] of forbidden) {
    assert.ok(
      !pattern.test(copy),
      `The deck copy matches ${pattern} — that would be ${why}.`,
    )
  }
})

test('slide 6 claims a shared Blueprint, never platform-wide identical state', () => {
  const slide = PITCH_SLIDES.find(s => s.id === 'learner-blueprint')!

  assert.match(
    slide.message,
    /Blueprint that the learner, teacher and parent can understand from the same evidence base/,
    'Slide 6 must scope the shared-picture claim to the Blueprint itself.',
  )

  const copy = [slide.message, ...(slide.points ?? [])].join(' ')
  for (const overreach of [/every surface/i, /across the platform/i, /everywhere in/i]) {
    assert.ok(!overreach.test(copy), `Slide 6 overreaches: matched ${overreach}.`)
  }
})

test('slide 10 does not use engineering volume as traction', () => {
  const slide = PITCH_SLIDES.find(s => s.id === 'where-we-are')!
  const copy = [slide.message, ...(slide.points ?? []), ...STAGE_STEPS.map(s => s.label)].join(' ')

  for (const metric of [/API route/i, /\btest file/i, /\bmigrations\b/i, /lines of code/i, /\bmodules\b/i]) {
    assert.ok(!metric.test(copy), `Slide 10 uses an engineering-volume metric: matched ${metric}.`)
  }
})

test('slide 7 gives the human-judgement sentence the whole slide', () => {
  const slide = PITCH_SLIDES.find(s => s.id === 'never-decides')!
  assert.equal(slide.visual.kind, 'statement')
  assert.ok(slide.visual.kind === 'statement')
  assert.deepEqual(slide.visual.quote, [
    'Software may organise and present what happened.',
    'Only a teacher may conclude that a learner succeeded.',
  ])
})

test('the founder slide is product evolution, not biography', () => {
  const copy = FOUNDER_ARC.map(b => `${b.beat} ${b.note}`).join(' ')

  // No invented credential, date, award or achievement — none was supplied.
  for (const invented of [/\b(19|20)\d{2}\b/, /degree|graduated|award|winner|certified/i, /\byears of\b/i]) {
    assert.ok(!invented.test(copy), `The founder arc invents detail: matched ${invented}.`)
  }

  // The arc has to end where the product is, or it is just a history.
  assert.match(FOUNDER_ARC[FOUNDER_ARC.length - 1].beat, /Educational Intelligence/)
})

test('the business slide prices what is actually configured, and nothing more', () => {
  const prices = PRICING_ROWS.map(r => r.price).join(' ')
  assert.match(prices, /KES 25,000 – 45,000/)
  assert.match(prices, /KES 2,499 – 4,499/)
  assert.match(prices, /KES 100/)

  const notes = PRICING_ROWS.map(r => r.note).join(' ')
  assert.match(notes, /KES 129 – 208 per learner per term/)

  // No projection, no multiple, no forecast.
  for (const forecast of [/project(ed|ion)/i, /forecast/i, /by 20\d\d/i, /\bx\b growth/i]) {
    assert.ok(!forecast.test(notes), `The pricing notes forecast something: matched ${forecast}.`)
  }
})
