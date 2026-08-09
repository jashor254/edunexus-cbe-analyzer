// components/pitch-deck/IntelligenceLoopDiagram.tsx
//
// Slide 5's diagram — the deck's centrepiece.
//
// Distinct from components/demo-presentation/IntelligenceLoop.tsx, and
// deliberately not a reuse of it: that one is a four-stage conceptual sketch
// for the product walkthrough. This one names all eight stages and exists
// principally to make the two human gates unmissable, which is the argument
// the pitch is making. Merging them would force one component to be both
// abstract and specific.
//
// The gates are marked three ways over, so no single channel carries the
// meaning alone: a gold rule and border (colour), the words "Human decision"
// (text), and a distinct position in the reading order announced to screen
// readers. Nothing here implies the system decides anything on its own.
//
// Inline SVG for the connectors so the diagram stays crisp at presentation
// size and needs no asset.

import { LOOP_STAGES, type LoopStage } from '@/lib/pitch/deck'

const ROW_A = LOOP_STAGES.slice(0, 4)
const ROW_B = LOOP_STAGES.slice(4, 8)

function StageCard({ stage, index }: { stage: LoopStage; index: number }) {
  const human = stage.actor === 'human'

  return (
    <div
      className={`flex h-full flex-col rounded-lg border px-4 py-4 lg:px-5 [@media(max-height:820px)]:py-3 ${
        human
          ? 'border-(--demo-gold)/55 bg-(--demo-gold)/[0.07]'
          : 'border-(--demo-line) bg-(--demo-ink-soft)'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-mono text-[11px] tabular-nums ${
            human ? 'text-(--demo-gold)' : 'text-(--demo-muted-dim)'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        {human && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--demo-gold)">
            Human decision
          </span>
        )}
      </div>

      <p
        className={`mt-2 font-(--font-demo-heading) text-[0.95rem] font-semibold leading-snug lg:text-base ${
          human ? 'text-(--demo-gold)' : 'text-(--demo-paper)'
        }`}
      >
        {stage.label}
      </p>
      <p className="mt-1.5 text-[0.8rem] leading-snug text-(--demo-muted) lg:text-sm">
        {stage.note}
      </p>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex items-center justify-center px-1" aria-hidden="true">
      <svg width="26" height="10" viewBox="0 0 26 10" fill="none" focusable="false">
        <path d="M0 5h20" stroke="var(--demo-teal)" strokeWidth="1.5" />
        <path d="M19 1.5 24.5 5 19 8.5" stroke="var(--demo-teal)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  )
}

/** One row of four cards with arrows between them. */
function Row({ stages, offset }: { stages: readonly LoopStage[]; offset: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch">
      {stages.map((stage, i) => (
        <div key={stage.key} className="contents">
          <StageCard stage={stage} index={offset + i} />
          {i < stages.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  )
}

export function IntelligenceLoopDiagram() {
  return (
    <div className="w-full">
      {/* ── Desktop / tablet ───────────────────────────────────────────────
          Two rows that read left-to-right like text, with a wrap connector
          between them and a dashed return beneath — so the shape a reviewer
          takes away is a cycle, not a pipeline. */}
      <div className="hidden md:block">
        <ol aria-label="The intelligence loop, eight stages">
          <li>
            <Row stages={ROW_A} offset={0} />
          </li>

          {/* Wrap: out of stage 04, down and back across, into stage 05. Solid,
              and pointing *down* — this is the loop continuing, and it must not
              be mistaken for the dashed return below, which points up. */}
          <li aria-hidden="true" className="block">
            <svg viewBox="0 0 1000 40" className="w-full" preserveAspectRatio="none" focusable="false">
              <path
                d="M986 2 V12 Q986 22 974 22 H26 Q14 22 14 32 V37"
                stroke="var(--demo-teal)"
                strokeWidth="1.5"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M8.5 29 L14 38 L19.5 29"
                stroke="var(--demo-teal)"
                strokeWidth="1.5"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </li>

          <li>
            <Row stages={ROW_B} offset={4} />
          </li>
        </ol>

        {/* The return path: what makes it a loop. Dashed, so it reads as
            "continues" rather than as another discrete step. */}
        <div className="mt-2" aria-hidden="true">
          <svg viewBox="0 0 1000 46" className="w-full" preserveAspectRatio="none" focusable="false">
            <path
              d="M986 2 V28 Q986 40 974 40 H26 Q14 40 14 28 V14"
              stroke="var(--demo-teal)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M8.5 20 L14 12 L19.5 20"
              stroke="var(--demo-teal)"
              strokeWidth="1.5"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <p className="mt-1 text-center text-xs tracking-wide text-(--demo-muted)">
          The teacher’s review returns to the record, and the next round starts better informed.
        </p>
      </div>

      {/* ── Mobile ─────────────────────────────────────────────────────────
          The same eight stages stacked at full size. Never a shrunken
          diagram: a reviewer on a phone gets the sequence, legibly. */}
      <ol className="space-y-2.5 md:hidden">
        {LOOP_STAGES.map((stage, i) => {
          const human = stage.actor === 'human'
          return (
            <li
              key={stage.key}
              className={`rounded-lg border px-4 py-3.5 ${
                human
                  ? 'border-(--demo-gold)/55 bg-(--demo-gold)/[0.07]'
                  : 'border-(--demo-line) bg-(--demo-ink-soft)'
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    human ? 'text-(--demo-gold)' : 'text-(--demo-muted-dim)'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-[0.95rem] font-semibold leading-snug ${
                      human ? 'text-(--demo-gold)' : 'text-(--demo-paper)'
                    }`}
                  >
                    {stage.label}
                    {human && (
                      <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-(--demo-gold)">
                        Human decision
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-(--demo-muted)">{stage.note}</p>
                </div>
              </div>
            </li>
          )
        })}
        <li className="pt-1 text-center text-sm leading-snug text-(--demo-muted)">
          …and the teacher’s review returns to the record, starting the next round.
        </li>
      </ol>
    </div>
  )
}
