// components/demo-presentation/DemoSlide.tsx
//
// Renders one beat. Every slide is the same shape — one headline, at most one
// supporting line, an optional short list, one visual — so the reviewer's eye
// lands in the same place each time and the content is what changes.

import { DEMO_ASSETS, DEMO_ASSET_DIR, type DemoSlide as DemoSlideModel } from '@/lib/demo/presentation'
import { IntelligenceLoop } from './IntelligenceLoop'
import { ScreenshotFrame } from './ScreenshotFrame'

function WorkflowSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span className="rounded-md border border-(--demo-line-strong) bg-(--demo-ink-soft) px-4 py-2 text-sm font-medium text-(--demo-paper) md:text-base">
            {step}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="text-(--demo-teal)">→</span>
          )}
        </li>
      ))}
    </ol>
  )
}

function SlideVisual({
  slide,
  availableAssets,
  isActive,
}: {
  slide: DemoSlideModel
  availableAssets: readonly string[]
  isActive: boolean
}) {
  const visual = slide.visual

  if (visual.kind === 'wordmark') {
    return (
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="block h-px w-24 bg-(--demo-gold)"
        />
      </div>
    )
  }

  if (visual.kind === 'problem') {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {['Marks', 'Attendance', 'Reports'].map(item => (
          <div
            key={item}
            className="rounded-lg border border-(--demo-line) bg-(--demo-ink-soft) px-4 py-5 text-center text-sm font-medium text-(--demo-muted) md:text-base"
          >
            {item}
          </div>
        ))}
        <div className="rounded-lg border border-(--demo-gold)/45 bg-(--demo-gold)/[0.07] px-4 py-5 text-center sm:col-span-3">
          <span className="text-sm font-semibold text-(--demo-gold) md:text-base">
            Accumulated learner understanding
          </span>
        </div>
      </div>
    )
  }

  if (visual.kind === 'loop') return <IntelligenceLoop />

  if (visual.kind === 'closing') {
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
  }

  // screenshot | workflow — both may carry a real product screen.
  const assetKey = visual.asset
  const file = assetKey ? DEMO_ASSETS[assetKey] : null
  const steps = visual.kind === 'workflow' ? slide.points ?? [] : []

  return (
    <div className="w-full space-y-6">
      {steps.length > 0 && <WorkflowSteps steps={steps} />}
      {file && (
        <ScreenshotFrame
          src={`/${DEMO_ASSET_DIR}/${file}`}
          alt={visual.alt ?? slide.headline}
          available={availableAssets.includes(file)}
          expectedFile={file}
          priority={isActive}
        />
      )}
    </div>
  )
}

export function DemoSlideView({
  slide,
  availableAssets,
  isActive,
}: {
  slide: DemoSlideModel
  availableAssets: readonly string[]
  isActive: boolean
}) {
  const isTitle = slide.visual.kind === 'wordmark' || slide.visual.kind === 'closing'
  const showPointsAsList = slide.points && slide.points.length > 0 && slide.visual.kind !== 'workflow'

  return (
    <div
      className={`mx-auto flex w-full max-w-6xl flex-col justify-center gap-8 px-6 py-10 md:gap-10 md:px-10 ${
        isTitle ? 'items-center text-center' : ''
      }`}
    >
      <header className={isTitle ? '' : 'max-w-3xl'}>
        <h2
          className={`font-(--font-demo-heading) font-bold tracking-tight text-(--demo-paper) ${
            isTitle
              ? 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl'
              : 'text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem]'
          }`}
        >
          {slide.headline}
        </h2>

        {slide.support && (
          <p
            className={`mt-4 leading-relaxed text-(--demo-muted) ${
              isTitle ? 'text-lg sm:text-xl md:text-2xl' : 'text-base md:text-lg lg:text-xl'
            }`}
          >
            {slide.support}
          </p>
        )}

        {showPointsAsList && (
          <ul className="mt-4 space-y-2">
            {slide.points!.map(point => (
              <li
                key={point}
                className="text-base leading-relaxed text-(--demo-paper) md:text-lg lg:text-xl"
              >
                {point}
              </li>
            ))}
          </ul>
        )}
      </header>

      <SlideVisual slide={slide} availableAssets={availableAssets} isActive={isActive} />
    </div>
  )
}
