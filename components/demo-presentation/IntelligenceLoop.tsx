// components/demo-presentation/IntelligenceLoop.tsx
//
// Slide 3's diagram. Conceptual by design: four named stages and the fact that
// the last one feeds the first. It deliberately shows no tables, services,
// queues or system boundaries — a reviewer should leave with the idea, not an
// architecture they could misread as a claim about scale.
//
// Inline SVG so it stays crisp at presentation size and needs no asset.

const STAGES = [
  { key: 'evidence',      label: 'Evidence',                note: 'What was actually recorded' },
  { key: 'understanding', label: 'Understanding',           note: 'What it means for this learner' },
  { key: 'action',        label: 'Teacher / Learner Action', note: 'A next step someone can take' },
  { key: 'new-evidence',  label: 'New Evidence',            note: 'What the step leaves behind' },
] as const

export function IntelligenceLoop() {
  return (
    <div className="w-full">
      {/* Desktop / tablet: a horizontal run that visibly returns to the start. */}
      <div className="hidden md:block">
        <ol className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-0">
          {STAGES.map((stage, i) => (
            <li key={stage.key} className="contents">
              <div className="flex flex-col justify-center rounded-lg border border-(--demo-line) bg-(--demo-ink-soft) px-5 py-6 text-center">
                <span className="font-(--font-demo-heading) text-base lg:text-lg font-semibold text-(--demo-paper)">
                  {stage.label}
                </span>
                <span className="mt-2 text-xs lg:text-sm leading-snug text-(--demo-muted)">
                  {stage.note}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex items-center px-3" aria-hidden="true">
                  <svg width="34" height="12" viewBox="0 0 34 12" fill="none" focusable="false">
                    <path d="M0 6h27" stroke="var(--demo-teal)" strokeWidth="1.5" />
                    <path d="M26 1.5 32.5 6 26 10.5" stroke="var(--demo-teal)" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* The return path: what makes it a loop rather than a pipeline. */}
        <div className="relative mt-3" aria-hidden="true">
          <svg viewBox="0 0 1000 54" className="w-full" preserveAspectRatio="none" focusable="false">
            <path
              d="M978 2 V34 Q978 46 966 46 H34 Q22 46 22 34 V16"
              stroke="var(--demo-teal)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 5"
            />
            <path d="M16.5 22 L22 14 L27.5 22" stroke="var(--demo-teal)" strokeWidth="1.5" fill="none" />
          </svg>
          <p className="mt-1 text-center text-xs tracking-wide text-(--demo-muted)">
            Each step feeds the next round
          </p>
        </div>
      </div>

      {/* Mobile: the same four stages stacked, never a shrunken diagram. */}
      <ol className="md:hidden space-y-3">
        {STAGES.map((stage, i) => (
          <li
            key={stage.key}
            className="rounded-lg border border-(--demo-line) bg-(--demo-ink-soft) px-4 py-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-semibold text-(--demo-teal)">{i + 1}</span>
              <div>
                <p className="text-base font-semibold text-(--demo-paper)">{stage.label}</p>
                <p className="mt-1 text-sm leading-snug text-(--demo-muted)">{stage.note}</p>
              </div>
            </div>
          </li>
        ))}
        <li className="pt-1 text-center text-sm text-(--demo-muted)">
          …and the new evidence begins the next round.
        </li>
      </ol>
    </div>
  )
}
