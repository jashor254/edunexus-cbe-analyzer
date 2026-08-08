// lib/demo/presentation.test.ts
//
// The /demo reviewer presentation: its autoplay behaviour, its story, and the
// boundary that keeps it a presentation.
//
// Autoplay is tested through the pure reducer rather than a rendered DOM —
// the rules a reviewer actually experiences (it advances, it pauses, it runs
// continuously) are decisions, and they live in one place. Both modes of the
// DEMO_LOOPS switch are covered, so flipping it back stays a one-line change.
// The component's timer and listeners are deliberately not tested; per the
// brief, animation internals are not the point.
//
// Run: npx tsx --test lib/demo/presentation.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  DEMO_SLIDES,
  DEMO_SLIDE_COUNT,
  DEMO_ASSETS,
  DEMO_DATA_QUALIFIER,
  DEMO_LOOPS,
} from './presentation'
import {
  createInitialState,
  presentationReducer,
  isLastSlide,
  type PresentationState,
} from './presentationController'

const COUNT = DEMO_SLIDE_COUNT
/** The configured behaviour — what a viewer actually gets. */
const reduce = (state: PresentationState, action: Parameters<typeof presentationReducer>[1]) =>
  presentationReducer(state, action, COUNT, DEMO_LOOPS)
/** The non-looping behaviour, still supported behind the DEMO_LOOPS switch. */
const reduceOnce = (state: PresentationState, action: Parameters<typeof presentationReducer>[1]) =>
  presentationReducer(state, action, COUNT, false)

const playing = (): PresentationState => createInitialState(true)

// ── The story ────────────────────────────────────────────────────────────────

test('the presentation is the eight locked beats, in order', () => {
  assert.deepEqual(
    DEMO_SLIDES.map(s => s.id),
    [
      'edunexus',
      'problem',
      'loop',
      'blueprint-today',
      'insight-to-action',
      'teacher-workflow',
      'beyond-marks',
      'closing',
    ],
  )
})

test('every slide has one headline and no paragraph-length copy', () => {
  for (const slide of DEMO_SLIDES) {
    assert.ok(slide.headline.length > 0, `${slide.id} has no headline`)
    assert.ok(slide.headline.length <= 60, `${slide.id} headline is too long to be a headline`)
    if (slide.support) {
      assert.ok(slide.support.length <= 120, `${slide.id} support line reads as a paragraph`)
    }
    for (const point of slide.points ?? []) {
      assert.ok(point.length <= 120, `${slide.id} point reads as a paragraph`)
    }
  }
})

test('every slide has a dwell time, with the closing beat held longest', () => {
  const durations = DEMO_SLIDES.map(s => s.durationMs)
  assert.deepEqual(durations.slice(0, -1), [8_000, 11_000, 12_000, 12_000, 12_000, 11_000, 11_000])
  assert.equal(durations.at(-1), 14_000, 'the closing line needs a beat before the deck wraps')
  assert.ok(
    durations.every(d => d !== null),
    'a null duration would stop the deck dead; DEMO_LOOPS governs that instead',
  )
})

test('every screenshot slide carries meaningful alt text, not a filename', () => {
  for (const slide of DEMO_SLIDES) {
    const visual = slide.visual
    if (visual.kind !== 'screenshot' && visual.kind !== 'workflow') continue
    if (!visual.asset) continue
    assert.ok(visual.alt && visual.alt.length > 30, `${slide.id} needs descriptive alt text`)
    assert.ok(!visual.alt!.includes('.png'), `${slide.id} alt text must describe the screen, not name a file`)
  }
})

test('screenshots are declared as files, never as fabricated markup', () => {
  for (const file of Object.values(DEMO_ASSETS)) {
    assert.match(file, /^[a-z0-9-]+\.png$/, `${file} should be a descriptive static filename`)
  }
})

// ── Autoplay ─────────────────────────────────────────────────────────────────

test('autoplay starts on the first slide and advances', () => {
  const start = playing()
  assert.equal(start.index, 0)
  assert.equal(start.isPlaying, true)

  const after = reduce(start, { type: 'advance' })
  assert.equal(after.index, 1)
  assert.equal(after.isPlaying, true)
})

test('the deck runs continuously, wrapping from the closing slide to the first', () => {
  let state = playing()
  for (let i = 0; i < COUNT - 1; i++) state = reduce(state, { type: 'advance' })
  assert.equal(state.index, COUNT - 1, 'reaches the closing slide')
  assert.equal(state.isPlaying, true, 'and keeps running')

  state = reduce(state, { type: 'advance' })
  assert.equal(state.index, 0, 'wraps back to the opening slide')
  assert.equal(state.isPlaying, true, 'without needing anyone to press anything')
})

test('it keeps cycling indefinitely, never settling', () => {
  let state = playing()
  for (let i = 0; i < COUNT * 3; i++) state = reduce(state, { type: 'advance' })
  assert.equal(state.isPlaying, true, 'three full passes and still running')
  assert.equal(state.index, (COUNT * 3) % COUNT)
})

test('non-looping mode still stops dead on the closing slide', () => {
  // The behaviour DEMO_LOOPS switches away from, kept working and covered so
  // flipping the constant back is a one-line change, not a rewrite.
  let state = playing()
  for (let i = 0; i < COUNT * 2; i++) state = reduceOnce(state, { type: 'advance' })
  assert.equal(state.index, COUNT - 1)
  assert.equal(state.isPlaying, false)
})

test('pause stops advancing, and play resumes from where it stopped', () => {
  let state = reduce(playing(), { type: 'advance' }) // slide 2
  state = reduce(state, { type: 'togglePlay' })
  assert.equal(state.isPlaying, false)

  const whilePaused = reduce(state, { type: 'advance' })
  assert.equal(whilePaused.index, 1, 'a tick arriving while paused must not advance')
  assert.equal(whilePaused, state, 'and must not produce a new state at all')

  state = reduce(state, { type: 'togglePlay' })
  assert.equal(state.isPlaying, true)
  assert.equal(reduce(state, { type: 'advance' }).index, 2)
})

// ── Manual navigation ────────────────────────────────────────────────────────

test('next and previous wrap in both directions — no dead ends', () => {
  let state = playing()
  assert.equal(reduce(state, { type: 'prev' }).index, COUNT - 1,
    'back from the first slide reaches the last')

  state = reduce(state, { type: 'next' })
  assert.equal(state.index, 1)
  assert.equal(reduce(state, { type: 'prev' }).index, 0)

  for (let i = 0; i < COUNT - 1; i++) state = reduce(state, { type: 'next' })
  assert.equal(state.index, 0, 'forward past the closing slide returns to the start')
})

test('non-looping mode clamps at both ends instead of wrapping', () => {
  let state = playing()
  assert.equal(reduceOnce(state, { type: 'prev' }).index, 0)
  for (let i = 0; i < COUNT * 2; i++) state = reduceOnce(state, { type: 'next' })
  assert.equal(state.index, COUNT - 1)
})

test('manual navigation does not resume a paused presentation', () => {
  let state = reduce(playing(), { type: 'togglePlay' })
  assert.equal(state.isPlaying, false)
  state = reduce(state, { type: 'next' })
  assert.equal(state.isPlaying, false, 'the viewer chose to pause; Next must not undo that')
})

test('reaching the closing slide manually does not stop a looping deck', () => {
  let state = playing()
  for (let i = 0; i < COUNT - 1; i++) state = reduce(state, { type: 'next' })
  assert.equal(state.index, COUNT - 1)
  assert.equal(state.isPlaying, true, 'it carries on round')
})

test('non-looping mode stops however the closing slide is reached', () => {
  let state = playing()
  for (let i = 0; i < COUNT - 1; i++) state = reduceOnce(state, { type: 'next' })
  assert.equal(state.isPlaying, false)
})

test('pause and play work on every slide, including the closing one', () => {
  let state = playing()
  for (let i = 0; i < COUNT - 1; i++) state = reduce(state, { type: 'next' })
  state = reduce(state, { type: 'togglePlay' })
  assert.equal(state.isPlaying, false, 'a viewer can hold the closing slide')
  state = reduce(state, { type: 'togglePlay' })
  assert.equal(state.isPlaying, true, 'and set it running again')
})

test('replay returns to the start and plays again', () => {
  let state = playing()
  for (let i = 0; i < COUNT - 1; i++) state = reduce(state, { type: 'next' })
  const replayed = reduce(state, { type: 'replay' })
  assert.equal(replayed.index, 0)
  assert.equal(replayed.isPlaying, true)
})

// ── Reduced motion ───────────────────────────────────────────────────────────

test('reduced motion disables autoplay from the very first render', () => {
  const state = createInitialState(false)
  assert.equal(state.isPlaying, false)
  assert.equal(reduce(state, { type: 'advance' }), state, 'nothing may advance on its own')
})

test('reduced motion leaves manual navigation fully functional', () => {
  let state = createInitialState(false)
  state = reduce(state, { type: 'next' })
  assert.equal(state.index, 1)
  state = reduce(state, { type: 'prev' })
  assert.equal(state.index, 0)
})

test('reduced motion cannot be overridden by pressing play', () => {
  const state = createInitialState(false)
  assert.equal(reduce(state, { type: 'togglePlay' }).isPlaying, false)
})

test('reduced motion turned on mid-presentation stops it where it is', () => {
  let state = reduce(playing(), { type: 'advance' })
  assert.equal(state.isPlaying, true)
  state = reduce(state, { type: 'setAutoplayAllowed', allowed: false })
  assert.equal(state.isPlaying, false)
  assert.equal(state.index, 1, 'it stops in place rather than jumping')
})

test('replay under reduced motion returns to the start without moving on its own', () => {
  let state = createInitialState(false)
  state = reduce(state, { type: 'next' })
  const replayed = reduce(state, { type: 'replay' })
  assert.equal(replayed.index, 0)
  assert.equal(replayed.isPlaying, false)
})

// ── Presentation-layer boundary ──────────────────────────────────────────────

const DEMO_SOURCE_FILES = [
  'lib/demo/presentation.ts',
  'lib/demo/presentationController.ts',
  'components/demo-presentation/DemoPresentation.tsx',
  'components/demo-presentation/DemoSlide.tsx',
  'components/demo-presentation/IntelligenceLoop.tsx',
  'components/demo-presentation/ScreenshotFrame.tsx',
  'app/demo/page.tsx',
  'app/demo/layout.tsx',
]

test('the demo cannot read or mutate product data', () => {
  // A presentation that imports a repository, a Supabase client, or a product
  // domain module is no longer a presentation. This is the guard on that.
  const forbidden = [
    '@/lib/repositories',
    '@/utils/supabase',
    '@supabase/supabase-js',
    '@supabase/ssr',
    '@/lib/projection',
    '@/lib/compass',
    '@/lib/learnerBlueprint',
    '@/lib/intelligence',
    '@/lib/payments',
    '@/lib/ai/',
  ]

  for (const file of DEMO_SOURCE_FILES) {
    const source = readFileSync(file, 'utf8')
    for (const term of forbidden) {
      assert.ok(
        !source.includes(term),
        `${file} imports ${term} — /demo must stay presentation-only`,
      )
    }
  }
})

test('the demo declares no auth requirement and no API route of its own', () => {
  for (const file of DEMO_SOURCE_FILES) {
    const source = readFileSync(file, 'utf8')
    assert.ok(!source.includes('getUser('), `${file} performs an auth check; /demo is public`)
    assert.ok(!source.includes('requireAuth'), `${file} requires auth; /demo is public`)
    assert.ok(!/from\s+['"]@\/app\/api/.test(source), `${file} reaches into an API route`)
  }
})

test('/demo is registered as a public path in the proxy', () => {
  const proxy = readFileSync('proxy.ts', 'utf8')
  const publicBlock = proxy.slice(proxy.indexOf('const PUBLIC_PREFIXES'), proxy.indexOf(']', proxy.indexOf('const PUBLIC_PREFIXES')))
  assert.ok(publicBlock.includes("'/demo'"), '/demo must not fall through to an auth redirect')
})

test('/demo is noindex until explicitly approved', () => {
  const layout = readFileSync('app/demo/layout.tsx', 'utf8')
  assert.match(layout, /robots:\s*\{[\s\S]*index:\s*false/, 'layout must set robots index:false')
  assert.match(layout, /follow:\s*false/, 'layout must set robots follow:false')

  const robots = readFileSync('app/robots.ts', 'utf8')
  assert.ok(robots.includes("'/demo'"), 'robots.txt must disallow /demo too')
})

test('the reference-data qualifier is present and unambiguous', () => {
  assert.equal(DEMO_DATA_QUALIFIER, 'Product screens use reference-school / test data.')
  const source = readFileSync('components/demo-presentation/DemoPresentation.tsx', 'utf8')
  assert.ok(source.includes('DEMO_DATA_QUALIFIER'), 'the qualifier must actually be rendered')
})

test('no slide claims deployment, adoption, outcomes or accuracy', () => {
  // The truth boundary, asserted against the copy itself rather than trusted
  // to review. Matched on whole words so ordinary copy is not caught.
  const forbidden = [
    /\bschools? (?:use|using|trust|rely)\b/i,
    /\b\d+\s*(?:\+|percent|%)\s*(?:schools|teachers|learners|students)\b/i,
    /\b(?:accuracy|accurate to|precision)\b/i,
    /\bimproved? (?:outcomes|results|grades|performance)\b/i,
    /\bnationwide\b|\bnational (?:rollout|infrastructure)\b/i,
    /\bproduction[- ]scale\b/i,
    /\bpaying (?:schools|customers)\b/i,
  ]

  const copy = DEMO_SLIDES.flatMap(s => [s.headline, s.support ?? '', ...(s.points ?? [])]).join(' ')
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(copy), `presentation copy makes a claim it cannot support: ${pattern}`)
  }
})

// ── Offline copy ─────────────────────────────────────────────────────────────

test('the standalone build carries the same story and timings as the route', () => {
  // scripts/buildDemoStandalone.ts exists so the file handed to someone on a
  // laptop is generated from this module rather than copied by hand. These
  // assertions are what make "it cannot drift" true rather than merely stated.
  const out = path.join(tmpdir(), `edunexus-demo-${Date.now()}.html`)
  try {
    execFileSync('npx', ['tsx', 'scripts/buildDemoStandalone.ts', out], { stdio: 'pipe' })
    const html = readFileSync(out, 'utf8')

    for (const slide of DEMO_SLIDES) {
      assert.ok(
        html.includes(slide.headline.replace(/&/g, '&amp;')),
        `standalone build is missing the "${slide.id}" beat`,
      )
    }

    const durations = JSON.stringify(DEMO_SLIDES.map(s => s.durationMs))
    assert.ok(html.includes(`var DURATIONS = ${durations}`), 'standalone timings drifted from the route')
    assert.ok(
      html.includes(`var LOOPS = ${DEMO_LOOPS ? 'true' : 'false'}`),
      'the offline copy must run continuously exactly as the route does',
    )
  } finally {
    rmSync(out, { force: true })
  }
})

test('the standalone build is genuinely self-contained', () => {
  const out = path.join(tmpdir(), `edunexus-demo-${Date.now()}.html`)
  try {
    execFileSync('npx', ['tsx', 'scripts/buildDemoStandalone.ts', out], { stdio: 'pipe' })
    const html = readFileSync(out, 'utf8')

    // It must open by double-clicking, with no network. The only permitted
    // outbound reference is the closing slide's link to the public site.
    const external: string[] = html.match(/(?:src|href)="(https?:\/\/[^"]+)"/g) ?? []
    const unexpected = external.filter(ref => !ref.includes('edunexus.co.ke'))
    assert.deepEqual(unexpected, [], 'standalone build must not fetch anything at open time')

    assert.ok(!/<script[^>]+src=/.test(html), 'no external script may be referenced')
    assert.ok(!/<link[^>]+stylesheet/.test(html), 'no external stylesheet may be referenced')
  } finally {
    rmSync(out, { force: true })
  }
})

test('isLastSlide identifies exactly the closing beat', () => {
  assert.equal(isLastSlide(0, COUNT), false)
  assert.equal(isLastSlide(COUNT - 2, COUNT), false)
  assert.equal(isLastSlide(COUNT - 1, COUNT), true)
})
