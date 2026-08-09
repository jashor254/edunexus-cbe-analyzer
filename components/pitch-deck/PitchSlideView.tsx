// components/pitch-deck/PitchSlideView.tsx
//
// Renders one slide of the pitch deck.
//
// Every slide is the same shape — section kicker, headline, one-sentence
// message, at most three supporting points, one visual — so a reviewer's eye
// lands in the same place each time and only the content changes. That
// sameness is what lets the whole deck be read in a few minutes.
//
// Nothing here is decorative. Each visual either shows a real product screen
// or draws a relationship the words cannot carry alone; there are no icon
// grids, no charts without data, and no invented product UI.

import {
  PITCH_ASSETS,
  PITCH_ASSET_DIR,
  PITCH_SCREENSHOT_NOTE,
  PRICING_ROWS,
  STAGE_STEPS,
  FOUNDER_ARC,
  type PitchSlide,
} from '@/lib/pitch/deck'
import { ScreenshotFrame } from '@/components/demo-presentation/ScreenshotFrame'
import { IntelligenceLoopDiagram } from './IntelligenceLoopDiagram'

// ── Slide 2 ───────────────────────────────────────────────────────────────
// The silence is the graphic: two marked events, and the long unmarked
// stretch between them doing the actual arguing.
function GapTimeline() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-stretch">
        <div className="w-px shrink-0 bg-(--demo-gold)" aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-4 px-4">
            <p className="font-(--font-demo-heading) text-sm font-semibold text-(--demo-gold) sm:text-base">
              A gap begins
            </p>
            <p className="text-right font-(--font-demo-heading) text-sm font-semibold text-(--demo-paper) sm:text-base">
              It reaches a report card
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3 px-4" aria-hidden="true">
            <span className="h-px flex-1 bg-(--demo-line-strong)" />
            <span className="text-xs uppercase tracking-[0.18em] text-(--demo-muted-dim)">
              a term, or more
            </span>
            <span className="h-px flex-1 bg-(--demo-line-strong)" />
          </div>

          <p className="mt-4 px-4 text-sm leading-relaxed text-(--demo-muted) sm:text-base">
            Nothing in this stretch is missing. It is recorded — and unread.
          </p>
        </div>
        <div className="w-px shrink-0 bg-(--demo-paper)" aria-hidden="true" />
      </div>
    </div>
  )
}

// ── Slide 3 ───────────────────────────────────────────────────────────────
// Fragments on the left, one continuous record on the right.
function Accumulation() {
  const fragments = ['Marks', 'Attendance', 'Class work', 'Observations']

  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--demo-muted-dim)">
          Recorded today
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {fragments.map(item => (
            <li
              key={item}
              className="rounded-lg border border-(--demo-line) bg-(--demo-ink-soft) px-3 py-3 text-center text-sm text-(--demo-muted)"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-center" aria-hidden="true">
        <svg width="30" height="12" viewBox="0 0 30 12" fill="none" className="hidden md:block" focusable="false">
          <path d="M0 6h23" stroke="var(--demo-teal)" strokeWidth="1.5" />
          <path d="M22 1.5 28.5 6 22 10.5" stroke="var(--demo-teal)" strokeWidth="1.5" fill="none" />
        </svg>
        <svg width="12" height="26" viewBox="0 0 12 26" fill="none" className="md:hidden" focusable="false">
          <path d="M6 0v19" stroke="var(--demo-teal)" strokeWidth="1.5" />
          <path d="M1.5 18 6 24.5 10.5 18" stroke="var(--demo-teal)" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--demo-gold)">
          What EduNexus adds
        </p>
        <div className="rounded-lg border border-(--demo-gold)/45 bg-(--demo-gold)/[0.07] px-5 py-6">
          <p className="font-(--font-demo-heading) text-base font-semibold text-(--demo-paper) sm:text-lg">
            One learner record that accumulates
          </p>
          <p className="mt-2 text-sm leading-relaxed text-(--demo-muted)">
            Every term adds to it. Nothing is overwritten, and nothing has to be
            remembered by the teacher who happened to be there.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Slide 4 ───────────────────────────────────────────────────────────────
function Contrast() {
  const columns = [
    {
      title: 'What schools already run',
      accent: false,
      items: ['Registration and fees', 'Timetabling and attendance', 'Reporting to the Ministry'],
    },
    {
      title: 'What Educational Intelligence adds',
      accent: true,
      items: [
        'Each learner’s standing, from evidence already collected',
        'One next action, approved by their teacher',
        'A record that is worth more each term',
      ],
    },
  ]

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-2">
      {columns.map(col => (
        <div
          key={col.title}
          className={`rounded-lg border px-5 py-5 sm:px-6 sm:py-6 ${
            col.accent
              ? 'border-(--demo-gold)/45 bg-(--demo-gold)/[0.06]'
              : 'border-(--demo-line) bg-(--demo-ink-soft)'
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              col.accent ? 'text-(--demo-gold)' : 'text-(--demo-muted-dim)'
            }`}
          >
            {col.title}
          </p>
          <ul className="mt-4 space-y-2.5">
            {col.items.map(item => (
              <li
                key={item}
                className={`text-sm leading-relaxed sm:text-[0.95rem] ${
                  col.accent ? 'text-(--demo-paper)' : 'text-(--demo-muted)'
                }`}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Slide 9 ───────────────────────────────────────────────────────────────
function PricingTable() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ul className="space-y-2.5">
        {PRICING_ROWS.map(row => (
          <li
            key={row.who}
            className={`rounded-lg border px-5 py-4 sm:px-6 sm:py-5 [@media(max-height:820px)]:py-3 ${
              row.lead
                ? 'border-(--demo-gold)/45 bg-(--demo-gold)/[0.06]'
                : 'border-(--demo-line) bg-(--demo-ink-soft)'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <div>
                <p
                  className={`font-(--font-demo-heading) text-base font-semibold sm:text-lg ${
                    row.lead ? 'text-(--demo-gold)' : 'text-(--demo-paper)'
                  }`}
                >
                  {row.who}
                </p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-(--demo-muted-dim)">
                  {row.plan}
                </p>
              </div>
              <p
                className={`font-(--font-demo-heading) text-lg font-semibold tabular-nums sm:text-xl ${
                  row.lead ? 'text-(--demo-paper)' : 'text-(--demo-paper)'
                }`}
              >
                {row.price}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-(--demo-muted)">{row.note}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Slide 10 ──────────────────────────────────────────────────────────────
// Dated and ordered, with the step the company has not reached marked as
// such. The point of the slide is that the last item has not happened yet.
function StageTrack() {
  const marker = {
    done: { ring: 'border-(--demo-teal) bg-(--demo-teal)', label: 'Done' },
    current: { ring: 'border-(--demo-gold) bg-(--demo-gold)', label: 'Now' },
    ahead: { ring: 'border-(--demo-muted-dim) bg-transparent', label: 'Ahead' },
  } as const

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ol className="space-y-0">
        {STAGE_STEPS.map((step, i) => {
          const m = marker[step.state]
          const last = i === STAGE_STEPS.length - 1
          return (
            <li key={step.label} className="flex gap-4">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 block h-2.5 w-2.5 rounded-full border ${m.ring}`}
                />
                {!last && (
                  <span aria-hidden="true" className="my-1 w-px flex-1 bg-(--demo-line-strong)" />
                )}
              </div>
              <div className={last ? 'pb-0' : 'pb-5 [@media(max-height:820px)]:pb-3'}>
                <p
                  className={`text-[0.95rem] leading-snug sm:text-base ${
                    step.state === 'ahead' ? 'text-(--demo-muted)' : 'text-(--demo-paper)'
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-(--demo-muted-dim)">
                  <span className="sr-only">Status: </span>
                  {m.label}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="mt-6 rounded-lg border border-(--demo-line) bg-(--demo-ink-soft) px-5 py-4 text-sm leading-relaxed text-(--demo-muted) [@media(max-height:820px)]:mt-4 [@media(max-height:820px)]:py-3">
        No pilot school has started yet, and no school is paying yet. The deck says
        so here rather than leaving it to be discovered.
      </p>
    </div>
  )
}

// ── Slide 11 ──────────────────────────────────────────────────────────────
function FounderArc() {
  return (
    <ol className="mx-auto grid w-full max-w-4xl gap-2.5 sm:grid-cols-2">
      {FOUNDER_ARC.map((beat, i) => {
        const last = i === FOUNDER_ARC.length - 1
        return (
          <li
            key={beat.beat}
            className={`rounded-lg border px-5 py-4 [@media(max-height:820px)]:py-3 ${
              last
                ? 'border-(--demo-gold)/45 bg-(--demo-gold)/[0.06]'
                : 'border-(--demo-line) bg-(--demo-ink-soft)'
            }`}
          >
            <div className="flex items-baseline gap-3">
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  last ? 'text-(--demo-gold)' : 'text-(--demo-muted-dim)'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-(--font-demo-heading) text-[0.95rem] font-semibold leading-snug sm:text-base ${
                    last ? 'text-(--demo-gold)' : 'text-(--demo-paper)'
                  }`}
                >
                  {beat.beat}
                </p>
                <p className="mt-1 text-sm leading-snug text-(--demo-muted)">{beat.note}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── The visual switch ─────────────────────────────────────────────────────

function SlideVisual({
  slide,
  availableAssets,
  isActive,
}: {
  slide: PitchSlide
  availableAssets: readonly string[]
  isActive: boolean
}) {
  const visual = slide.visual

  switch (visual.kind) {
    case 'title':
      return <span aria-hidden="true" className="block h-px w-24 bg-(--demo-gold)" />

    case 'gapTimeline':
      return <GapTimeline />

    case 'accumulation':
      return <Accumulation />

    case 'contrast':
      return <Contrast />

    case 'loop':
      return <IntelligenceLoopDiagram />

    case 'pricing':
      return <PricingTable />

    case 'stage':
      return <StageTrack />

    case 'arc':
      return <FounderArc />

    case 'statement':
      // Slide 7. The sentence is the slide; nothing else competes with it.
      return (
        <figure className="mx-auto w-full max-w-4xl text-center">
          <span aria-hidden="true" className="mx-auto block h-px w-16 bg-(--demo-gold)" />
          <blockquote className="mt-8">
            {visual.quote.map((line, i) => (
              <p
                key={line}
                className={`font-(--font-demo-heading) text-2xl font-semibold leading-[1.22] tracking-tight sm:text-3xl md:text-4xl lg:text-[2.6rem] ${
                  i === 0 ? 'text-(--demo-muted)' : 'mt-3 text-(--demo-paper)'
                }`}
              >
                {line}
              </p>
            ))}
          </blockquote>
          <figcaption className="mt-8 text-sm leading-relaxed text-(--demo-muted-dim)">
            {visual.attribution}
          </figcaption>
        </figure>
      )

    case 'closing':
      return (
        <div className="text-center">
          <span aria-hidden="true" className="mx-auto block h-px w-24 bg-(--demo-gold)" />
          <p className="mt-8 font-(--font-demo-heading) text-lg font-semibold text-(--demo-paper) md:text-xl">
            EduNexus Kenya
          </p>
          <a
            href="https://edunexus.co.ke"
            className="mt-1 inline-block text-sm text-(--demo-teal) underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none md:text-base"
          >
            edunexus.co.ke
          </a>
        </div>
      )

    case 'screenshot': {
      const file = PITCH_ASSETS[visual.asset]
      return (
        <figure className="w-full">
          <ScreenshotFrame
            src={`/${PITCH_ASSET_DIR}/${file}`}
            alt={visual.alt}
            available={availableAssets.includes(file)}
            expectedFile={file}
            priority={isActive}
          />
          {/* The reference-data qualifier travels with the image, not only in
              the footer — a reviewer who screenshots this slide takes the
              caveat with them. */}
          <figcaption className="mt-2.5 text-center text-xs leading-relaxed text-(--demo-muted-dim)">
            {visual.caption} {PITCH_SCREENSHOT_NOTE}
          </figcaption>
        </figure>
      )
    }
  }
}

export function PitchSlideView({
  slide,
  availableAssets,
  isActive,
}: {
  slide: PitchSlide
  availableAssets: readonly string[]
  isActive: boolean
}) {
  const isTitle = slide.visual.kind === 'title' || slide.visual.kind === 'closing'
  const isMedia = slide.visual.kind === 'screenshot'
  // On slide 7 the visual *is* the message, set large. Printing the sentence
  // again above it would say the same thing twice and cost the line the
  // dominance the whole slide exists to give it.
  const messageIsTheVisual = slide.visual.kind === 'statement'
  // The kicker names the movement of the narrative. It is suppressed in two
  // places: the cover, which is not a movement and does not need labelling,
  // and any slide whose title is already that same word.
  const showKicker =
    slide.visual.kind !== 'title' &&
    slide.section.toLowerCase() !== slide.headline.toLowerCase()

  // A screenshot slide gives its space to the image: wider measure, tighter
  // vertical rhythm, and the image capped against the chrome sharing the fold
  // with it rather than against a fixed fraction of the viewport. The cap is
  // generous enough that the screenshot stays legible and never squeezes the
  // controls off the fold.
  const shotMax = 'calc(100svh - 20.5rem)'

  // A 1280x720 laptop is a real reviewing surface and the shortest one the
  // deck targets. Tightening the vertical rhythm below 820px of height —
  // rather than shrinking type, which would cost legibility — is what keeps
  // the denser slides (the loop, pricing, the stage track) on one screen
  // there. Above that height nothing changes.
  const shortViewport = '[@media(max-height:820px)]:gap-2.5 [@media(max-height:820px)]:py-2'

  return (
    <div
      style={isMedia ? ({ '--demo-shot-max': shotMax } as React.CSSProperties) : undefined}
      className={`mx-auto flex w-full flex-col px-6 md:px-10 ${shortViewport} ${
        isMedia ? 'max-w-[1400px] gap-4 py-4' : 'max-w-5xl gap-7 py-8 md:gap-8'
      } ${isTitle ? 'items-center text-center' : ''}`}
    >
      <header className={isTitle ? 'max-w-3xl' : isMedia ? 'max-w-4xl' : 'max-w-4xl'}>
        {showKicker && (
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-(--demo-muted-dim) ${
              isTitle ? 'mb-5' : 'mb-3'
            }`}
          >
            {slide.section}
          </p>
        )}

        <h2
          className={`font-(--font-demo-heading) font-bold tracking-tight text-(--demo-paper) ${
            isTitle
              ? 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl'
              : isMedia
              ? 'text-2xl sm:text-[1.6rem] md:text-3xl'
              : 'text-2xl sm:text-3xl md:text-4xl'
          }`}
        >
          {slide.headline}
        </h2>

        {!messageIsTheVisual && (
          <p
            className={`leading-relaxed text-(--demo-muted) ${
              isTitle
                ? 'mt-5 text-lg sm:text-xl md:text-2xl'
                : isMedia
                ? 'mt-2 text-sm sm:text-[0.95rem] md:text-base'
                : 'mt-3 text-base sm:text-lg md:text-xl'
            }`}
          >
            {slide.message}
          </p>
        )}

        {slide.points && slide.points.length > 0 && !isMedia && (
          <ul className={`space-y-2 [@media(max-height:820px)]:space-y-1.5 ${isTitle ? 'mt-7 inline-block text-left' : 'mt-5 [@media(max-height:820px)]:mt-3'}`}>
            {slide.points.map(point => (
              <li
                key={point}
                className="flex gap-3 text-[0.95rem] leading-relaxed text-(--demo-paper) sm:text-base"
              >
                <span aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-(--demo-teal)" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* On a screenshot slide the points sit beside the caption rather than
          above the image, so the image keeps the fold. */}
      {slide.points && slide.points.length > 0 && isMedia && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {slide.points.map(point => (
            <li
              key={point}
              className="flex gap-2.5 text-sm leading-snug text-(--demo-paper)"
            >
              <span aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-(--demo-teal)" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      <SlideVisual slide={slide} availableAssets={availableAssets} isActive={isActive} />
    </div>
  )
}
