// lib/pitch/deck.ts
//
// The content of the Google Africa pitch deck (/pitch).
//
// Presentation layer only. Nothing here reads the database, calls a service,
// or imports product logic — the deck is fixed editorial copy plus a
// reference to screenshots already captured from the running application.
// Data-only, deliberately, so the story can be reviewed and tested without
// rendering anything (the same contract as lib/demo/presentation.ts).
//
// TRUTH BOUNDARY. This file is the single place any claim in the deck is
// written, and deck.test.ts asserts against it directly: no traction that
// does not exist, no market sizing, no endorsement, and the pre-pilot status
// stated out loud. Adding a claim here means adding it in the one place a
// test is watching. Every claim carries an `evidence` tag saying where it
// comes from, so a reader of this file can audit the deck without leaving it.

import { DEMO_ASSETS, DEMO_ASSET_DIR, DEMO_DATA_QUALIFIER, type DemoAssetKey } from '@/lib/demo/presentation'

// Screenshots are the ones already captured by scripts/captureDemoScreens.ts
// and committed under public/demo/google-africa/. The deck attaches existing
// approved screens; it never introduces its own asset directory, and product
// UI is never drawn or approximated to fill a gap.
export { DEMO_ASSETS as PITCH_ASSETS, DEMO_ASSET_DIR as PITCH_ASSET_DIR, DEMO_DATA_QUALIFIER as PITCH_DATA_QUALIFIER }
export type PitchAssetKey = DemoAssetKey

/**
 * Where a slide's claims come from. Rendered nowhere — this is an audit aid
 * for whoever next edits the copy, and the thing deck.test.ts counts.
 */
export type EvidenceStatus = 'VERIFIED' | 'FOUNDER-SUPPLIED' | 'MIXED'

/** The nine narrative movements the deck has to land, in order. */
export type PitchSection =
  | 'Opening'
  | 'Problem'
  | 'Insight'
  | 'Product'
  | 'Why different'
  | 'How it enters schools'
  | 'Business'
  | 'Current stage'
  | 'Founder'
  | 'Vision'

export type PitchVisual =
  /** Slide 1 — wordmark, one rule, nothing else. */
  | { kind: 'title' }
  /** Slide 2 — the silence between a gap starting and a report card. */
  | { kind: 'gapTimeline' }
  /** Slide 3 — scattered records resolving into one accumulating record. */
  | { kind: 'accumulation' }
  /** Slide 4 — what the existing categories each own, and what none of them do. */
  | { kind: 'contrast' }
  /** Slide 5 — the centrepiece loop, with the two human gates marked. */
  | { kind: 'loop' }
  /** Slide 6 / 8 — one real product screen, at size. */
  | { kind: 'screenshot'; asset: PitchAssetKey; alt: string; caption: string }
  /** Slide 7 — one sentence, given the whole slide. */
  | { kind: 'statement'; quote: readonly string[]; attribution: string }
  /** Slide 9 — the price table. */
  | { kind: 'pricing' }
  /** Slide 10 — where the company actually is, dated. */
  | { kind: 'stage' }
  /** Slide 11 — founder-market fit as a sequence, not a biography. */
  | { kind: 'arc' }
  /** Slide 12 — the quiet close. */
  | { kind: 'closing' }

export type PitchSlide = {
  /** Stable id — keys, tests, and the URL fragment for a deep link. */
  id: string
  /** 1-based, matching the canonical storyboard numbering. */
  number: number
  /** Which movement of the narrative this is. Rendered small, above the headline. */
  section: PitchSection
  /** Short label for the progress control's accessible name. */
  label: string
  /** The slide title. */
  headline: string
  /** The one-sentence message. Never two sentences, never a paragraph. */
  message: string
  /** At most three. Enforced by deck.test.ts, not by good intentions. */
  points?: readonly string[]
  visual: PitchVisual
  /** Audit tag — see EvidenceStatus. Not rendered. */
  evidence: EvidenceStatus
}

/** The two human gates in the loop, named once so slide 5 and slide 7 agree. */
export const HUMAN_GATES = ['Teacher approval', 'Teacher review'] as const

/**
 * Slide 5's diagram. Each stage is either something the system does or
 * something a person does — `actor` is what the diagram uses to mark the two
 * human gates unmistakably, and it is the reason this is a list of objects
 * rather than a list of strings.
 */
export const LOOP_STAGES = [
  { key: 'activity',      label: 'Classroom activity',  note: 'Marks, work, observation, tutoring',  actor: 'system' },
  { key: 'evidence',      label: 'Evidence',            note: 'Typed, dated, never overwritten',      actor: 'system' },
  { key: 'understanding', label: 'Current understanding', note: 'What it means for this learner, with confidence', actor: 'system' },
  { key: 'blueprint',     label: 'Learner Blueprint',   note: 'Where they stand, and what is next',   actor: 'system' },
  { key: 'approval',      label: 'Teacher approval',    note: 'Nothing reaches a learner unapproved', actor: 'human' },
  { key: 'action',        label: 'Action and learning', note: 'The learner does the work',            actor: 'system' },
  { key: 'new-evidence',  label: 'New evidence',        note: 'What the work left behind',            actor: 'system' },
  { key: 'review',        label: 'Teacher review',      note: 'The teacher decides whether it worked', actor: 'human' },
] as const

export type LoopStage = (typeof LOOP_STAGES)[number]

/** Slide 9's price table. Figures come from lib/payments/config.ts and /pricing. */
export const PRICING_ROWS = [
  {
    who: 'Schools',
    plan: 'Per term',
    price: 'KES 25,000 – 45,000',
    note: 'Up to 120 / up to 350 learners. Roughly KES 129 – 208 per learner per term.',
    lead: true,
  },
  {
    who: 'Families',
    plan: 'Per term',
    price: 'KES 2,499 – 4,499',
    note: 'One child, or up to three.',
    lead: false,
  },
  {
    who: 'Teachers, unattached to a school',
    plan: 'Per subject, per term',
    price: 'KES 100',
    note: 'Scheme of work, lesson plans and record of work as one bundle.',
    lead: false,
  },
] as const

/** Slide 10. Dated, ordered, and explicit that the last step has not happened. */
export const STAGE_STEPS = [
  { label: 'Platform built and verified end to end', state: 'done' },
  { label: 'School discovery and review across four counties', state: 'done' },
  { label: 'Direct outreach underway — since late July 2026', state: 'done' },
  { label: 'First cohort recruitment', state: 'current' },
  { label: 'Schools opening — 24 August 2026', state: 'ahead' },
] as const

export type StageStep = (typeof STAGE_STEPS)[number]

/**
 * Slide 11. Founder-supplied, and written as product evolution rather than
 * biography: the point is that the architecture is the conclusion of the
 * sequence, not that the founder has a history. No credential, date, award or
 * achievement appears here, because none was supplied and none may be invented.
 */
export const FOUNDER_ARC = [
  { beat: 'Classroom teaching',           note: 'Met the problem as the person doing the work.' },
  { beat: 'The planning problem',         note: 'Curriculum planning and record-keeping, every term, by hand.' },
  { beat: 'A scheme of work tool',        note: 'The first thing built — for that problem, not for a market.' },
  { beat: 'CBC Analyzer',                 note: 'Then interpreting a learner’s results. Useful, and self-contained.' },
  { beat: 'The realisation',              note: 'Each analysis answered one question and stopped. Nothing accumulated.' },
  { beat: 'Educational Intelligence',     note: 'Rebuilt around evidence that accumulates, and a teacher who stays in the loop.' },
] as const

/** The twelve canonical slides, in order. Wording is the approved storyboard. */
export const PITCH_SLIDES: readonly PitchSlide[] = [
  {
    id: 'edunexus',
    number: 1,
    section: 'Opening',
    label: 'EduNexus',
    headline: 'EduNexus',
    message:
      'An Educational Intelligence platform for schools — built so a learner is seen earlier, while there is still time to act.',
    points: [
      'CBC · CBE · 8-4-4 · Grade 7–12, Kenya.',
      'Works alongside a school’s existing systems, not in place of them.',
      'Pre-pilot — first school cohort now being recruited.',
    ],
    visual: { kind: 'title' },
    evidence: 'VERIFIED',
  },
  {
    id: 'problem',
    number: 2,
    section: 'Problem',
    label: 'The problem',
    headline: 'The problem',
    message:
      'A learning gap starts small and stays invisible until it reaches a report card — by which point it has had a term to grow.',
    points: [
      'The evidence that would have revealed it earlier already exists in the school.',
      'It sits in gradebooks, exercise books, and a teacher’s memory.',
      'The school discovers the problem at the moment it is hardest to fix.',
    ],
    visual: { kind: 'gapTimeline' },
    evidence: 'VERIFIED',
  },
  {
    id: 'insight',
    number: 3,
    section: 'Insight',
    label: 'The insight',
    headline: 'The insight',
    message:
      'Schools collect a great deal; almost none of it accumulates into understanding — EduNexus builds the layer that makes it accumulate.',
    points: [
      'Marks, attendance, observations and class work are recorded, then stranded.',
      'Each is a fact about a moment. None becomes a picture of the learner.',
      'Accumulation is a design problem, not a data-volume problem.',
    ],
    visual: { kind: 'accumulation' },
    evidence: 'VERIFIED',
  },
  {
    id: 'why-existing-systems',
    number: 4,
    section: 'Why different',
    label: 'Why existing systems don’t close it',
    headline: 'Why existing systems don’t close it',
    message:
      'School systems are built to administer and content platforms are built to deliver — neither owns the job of understanding the learner.',
    points: [
      'Administration handles registration, fees, timetabling and Ministry reporting.',
      'A content platform delivers material; a chatbot answers a question and forgets the learner.',
      'EduNexus adds the missing layer, and replaces none of them.',
    ],
    visual: { kind: 'contrast' },
    evidence: 'VERIFIED',
  },
  {
    id: 'intelligence-loop',
    number: 5,
    section: 'Product',
    label: 'The intelligence loop',
    headline: 'The intelligence loop',
    message:
      'Classroom activity becomes evidence, evidence becomes understanding, understanding becomes one action a teacher approves — and the learner’s response becomes new evidence.',
    points: [
      'Every insight carries its confidence and the evidence behind it.',
      'Evidence is never edited. A correction is new evidence that supersedes the old.',
      'Each turn of the loop leaves more behind than it started with.',
    ],
    visual: { kind: 'loop' },
    evidence: 'VERIFIED',
  },
  {
    id: 'learner-blueprint',
    number: 6,
    section: 'Product',
    label: 'The Learner Blueprint',
    headline: 'The Learner Blueprint',
    message:
      'The loop lands in one Blueprint that the learner, teacher and parent can understand from the same evidence base.',
    points: [
      'Assembled from evidence already recorded — not predicted.',
      'Turns where a learner stands into what should happen next, with the reasoning shown.',
      'Written to be read by a parent, without translation by the school.',
    ],
    visual: {
      kind: 'screenshot',
      asset: 'blueprintToday',
      alt: 'The Learner Blueprint “Where We Stand Today” screen, summarising one learner’s current standing from recorded evidence.',
      caption: 'Learner Blueprint — “Where we stand today”.',
    },
    evidence: 'VERIFIED',
  },
  {
    id: 'never-decides',
    number: 7,
    section: 'Why different',
    label: 'The system never decides it worked',
    headline: 'The system never decides it worked',
    message:
      'Software may organise and present what happened. Only a teacher may conclude that a learner succeeded.',
    points: [
      'No submission, score or session count marks an action successful on its own.',
      'A teacher chooses from five review verdicts. There is no automatic sixth.',
      'The rule is enforced in the architecture, not by policy.',
    ],
    visual: {
      kind: 'statement',
      quote: [
        'Software may organise and present what happened.',
        'Only a teacher may conclude that a learner succeeded.',
      ],
      attribution: 'A decision recorded in the architecture, and enforced by tests that fail the build.',
    },
    evidence: 'VERIFIED',
  },
  {
    id: 'how-it-enters',
    number: 8,
    section: 'How it enters schools',
    label: 'How it enters a school',
    headline: 'How it enters a school',
    message:
      'We enter through the term planning teachers already do — and that planning is where the evidence starts accumulating.',
    points: [
      'Scheme of Work → Lesson Plans → Record of Work, in the format schools already file.',
      'None of it asks a teacher to do more than they do today.',
      'From there: marks → Blueprint → parent visibility → the school-wide picture.',
    ],
    visual: {
      kind: 'screenshot',
      asset: 'teacherDocuments',
      alt: 'The teacher documents workspace, showing schemes of work, lesson plans and records of work together in one place.',
      caption: 'The teacher planning chain, in one workspace.',
    },
    evidence: 'VERIFIED',
  },
  {
    id: 'business-model',
    number: 9,
    section: 'Business',
    label: 'Business model',
    headline: 'Business model',
    message:
      'Priced per school per term, in shillings, on the payment rails Kenyan schools and families already use.',
    points: [
      'Schools are the buyer. Teachers are the daily user.',
      'M-PESA and card, live today.',
      'Pricing is set. It has not yet been tested against a school’s willingness to pay.',
    ],
    visual: { kind: 'pricing' },
    evidence: 'VERIFIED',
  },
  {
    id: 'where-we-are',
    number: 10,
    section: 'Current stage',
    label: 'Where we are',
    headline: 'Where we are',
    message:
      'Pre-pilot — the platform is built and verified end to end, and the first school cohort is being recruited now.',
    // These three say what the stage track beneath them cannot: scale, terms,
    // and sequencing. Anything the track already states is left to the track.
    points: [
      'Over a thousand Kenyan schools discovered, reviewed and ranked.',
      'Ten pilot places, offered free, going to the schools that respond.',
      'Kirinyaga County first, expanding only once results come in.',
    ],
    visual: { kind: 'stage' },
    evidence: 'VERIFIED',
  },
  {
    id: 'founder',
    number: 11,
    section: 'Founder',
    label: 'Founder',
    headline: 'Founder',
    message:
      'I met this problem as a teacher, built tools to survive it, and then realised the evidence those tools produced was going nowhere.',
    // No supporting points: the arc below is the argument, and bullets here
    // only restated it. Keeping this slide short is the point of it.
    visual: { kind: 'arc' },
    evidence: 'FOUNDER-SUPPLIED',
  },
  {
    id: 'vision',
    number: 12,
    section: 'Vision',
    label: 'Vision',
    headline: 'Start with one school.',
    message: 'Learn from real evidence. Improve from there.',
    points: [
      'Near term: the first Kirinyaga cohort, this term.',
      'Then: prove a school’s learner record is worth more each term than the last.',
      'Then: the same evidence layer serves any competency-based curriculum, anywhere one was adopted.',
    ],
    visual: { kind: 'closing' },
    evidence: 'MIXED',
  },
] as const

export const PITCH_SLIDE_COUNT = PITCH_SLIDES.length

/** Shown persistently in the deck footer, and again beneath every screenshot. */
export const PITCH_SCREENSHOT_NOTE = DEMO_DATA_QUALIFIER
