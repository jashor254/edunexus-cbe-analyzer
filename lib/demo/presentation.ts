// lib/demo/presentation.ts
//
// The content and pacing of the /demo reviewer presentation.
//
// Presentation layer only. Nothing here reads the database, calls a service,
// or imports product logic — the slides are fixed editorial copy, and the
// screenshots are static files. This module is deliberately data-only so the
// story can be reviewed and tested without rendering anything.

/** Static screenshots, served from public/demo/google-africa/. */
export const DEMO_ASSET_DIR = 'demo/google-africa'

/**
 * Screens the presentation can show. A slide names the asset it wants; the
 * page checks at request time which of these actually exist on disk and only
 * renders the ones that do (see app/demo/page.tsx). A missing file degrades to
 * a labelled placeholder rather than a broken image — product UI is never
 * mocked up, drawn, or approximated to fill a gap.
 */
export const DEMO_ASSETS = {
  blueprintToday:   'learner-blueprint-where-we-stand-today.png',
  blueprintNext:    'learner-blueprint-how-we-help-next.png',
  learningCompass:  'learning-compass-session.png',
  teacherDocuments: 'teacher-documents-workflow.png',
  teacherDashboard: 'teacher-dashboard.png',
  careerIntelligence: 'career-intelligence.png',
} as const

export type DemoAssetKey = keyof typeof DEMO_ASSETS

export type DemoVisual =
  | { kind: 'wordmark' }
  | { kind: 'problem' }
  | { kind: 'loop' }
  | { kind: 'workflow'; asset?: DemoAssetKey; alt?: string }
  | { kind: 'screenshot'; asset: DemoAssetKey; alt: string }
  | { kind: 'closing' }

export type DemoSlide = {
  /** Stable id — used for keys, tests and the progress control's labels. */
  id: string
  /** Short label for the progress indicator and the slide's accessible name. */
  label: string
  /** The one idea. */
  headline: string
  /** Optional single supporting line. Never a paragraph. */
  support?: string
  /** Optional short lines rendered as a restrained list, not prose. */
  points?: string[]
  visual: DemoVisual
  /** Autoplay dwell time. `null` means: hold here and stop autoplay. */
  durationMs: number | null
}

/**
 * The eight locked beats. Order and wording are fixed — this is the story the
 * reviewer was told they would see.
 */
export const DEMO_SLIDES: readonly DemoSlide[] = [
  {
    id: 'edunexus',
    label: 'EduNexus',
    headline: 'EduNexus',
    support: 'See the learner earlier. Act before the problem grows.',
    visual: { kind: 'wordmark' },
    durationMs: 8_000,
  },
  {
    id: 'problem',
    label: 'The problem',
    headline: 'The problem',
    support: 'Schools already have marks, attendance and reports.',
    points: ['The missing layer is accumulated learner understanding.'],
    visual: { kind: 'problem' },
    durationMs: 11_000,
  },
  {
    id: 'loop',
    label: 'The intelligence loop',
    headline: 'The intelligence loop',
    support: 'Each turn of the loop leaves more behind than it started with.',
    visual: { kind: 'loop' },
    durationMs: 12_000,
  },
  {
    id: 'blueprint-today',
    label: 'Learner Blueprint',
    headline: 'Learner Blueprint',
    support: 'Where we stand today — assembled from evidence already collected.',
    visual: {
      kind: 'screenshot',
      asset: 'blueprintToday',
      alt: 'The Learner Blueprint “Where We Stand Today” screen, summarising a learner’s current standing from recorded evidence.',
    },
    durationMs: 12_000,
  },
  {
    id: 'insight-to-action',
    label: 'From insight to action',
    headline: 'From insight to action',
    support: 'How we help next — the same evidence, turned into a next step.',
    visual: {
      kind: 'screenshot',
      asset: 'blueprintNext',
      alt: 'The Learner Blueprint “How We Help Next” screen, turning the learner’s current standing into recommended next actions.',
    },
    durationMs: 12_000,
  },
  {
    id: 'teacher-workflow',
    label: 'Teacher workflow',
    headline: 'Teacher workflow',
    support: 'The planning teachers already do, connected end to end.',
    points: ['Scheme of Work', 'Lesson Plans', 'Record of Work'],
    visual: {
      kind: 'workflow',
      asset: 'teacherDocuments',
      alt: 'The teacher documents workspace, showing schemes of work, lesson plans and records of work together.',
    },
    durationMs: 11_000,
  },
  {
    id: 'beyond-marks',
    label: 'Beyond today’s marks',
    headline: 'Beyond today’s marks',
    support: 'Strengths, growth areas, and fields worth exploring.',
    visual: {
      kind: 'screenshot',
      asset: 'careerIntelligence',
      alt: 'The Career Intelligence screen, showing a learner’s strengths, growth areas and fields worth exploring.',
    },
    durationMs: 11_000,
  },
  {
    id: 'closing',
    label: 'Closing',
    headline: 'Start with one school.',
    support: 'Learn from real evidence. Improve from there.',
    visual: { kind: 'closing' },
    // Held a beat longer than any other slide so the closing line lands before
    // the presentation wraps. `null` here would mean "stop forever" — see
    // DEMO_LOOPS below.
    durationMs: 14_000,
  },
] as const

export const DEMO_SLIDE_COUNT = DEMO_SLIDES.length

/**
 * Whether the presentation runs continuously.
 *
 * `true` — the deck wraps from the closing slide back to the first and keeps
 * going, and navigation wraps in both directions, so it never reaches a dead
 * end. This is what a reviewer who leaves the tab open, or a screen at a
 * stand, actually wants.
 *
 * `false` — autoplay stops on the closing slide and only a deliberate Replay
 * restarts it.
 *
 * A single switch, deliberately: which of the two a presentation should do is
 * a judgement about the audience, not something to be inferred from scattered
 * conditionals. Everything downstream — the reducer, the controls, and the
 * offline build — reads this one value.
 */
export const DEMO_LOOPS = true

/** Shown small and persistently, so no screen is ever mistaken for live school data. */
export const DEMO_DATA_QUALIFIER = 'Product screens use reference-school / test data.'
