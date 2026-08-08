// components/demo-presentation/ScreenshotFrame.tsx
//
// A restrained frame for a real product screenshot — a thin rule and a quiet
// surface, not fake browser chrome. The screenshot is the evidence; the frame
// should be almost invisible.
//
// When the asset is not present on disk the frame renders a plain, labelled
// placeholder naming the file it expects. Product UI is never drawn,
// approximated, or generated to fill the gap: a reviewer seeing an honest
// "not attached" panel is far better than one seeing an invented screen, and
// a broken image icon would undermine everything around it.

import Image from 'next/image'

export function ScreenshotFrame({
  src,
  alt,
  available,
  expectedFile,
  priority = false,
}: {
  src: string
  alt: string
  available: boolean
  expectedFile: string
  priority?: boolean
}) {
  if (!available) {
    return (
      <div
        className="flex min-h-[220px] w-full items-center justify-center rounded-xl border border-dashed border-(--demo-line-strong) bg-(--demo-ink-soft) px-6 py-10 md:min-h-[340px]"
        role="img"
        aria-label={`${alt} — screenshot not yet attached to this presentation.`}
      >
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold tracking-wide text-(--demo-paper)">
            Screen not attached
          </p>
          <p className="mt-2 text-sm leading-relaxed text-(--demo-muted)">{alt}</p>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-(--demo-muted-dim)">
            public/demo/google-africa/{expectedFile}
          </p>
        </div>
      </div>
    )
  }

  return (
    <figure className="w-full">
      {/* Sized by whichever runs out first: the available width, or the height
          left over after the slide's own chrome (--demo-shot-max, set by the
          slide). That way the screenshot fills the fold without ever pushing
          the controls off it. `object-contain` against the intrinsic 2400x1500
          keeps the aspect ratio exactly — nothing stretched, nothing cropped. */}
      <div className="mx-auto w-fit max-w-full overflow-hidden rounded-xl border border-(--demo-line-strong) bg-(--demo-ink-soft) shadow-[0_18px_50px_-24px_rgba(0,0,0,0.8)]">
        <Image
          src={src}
          alt={alt}
          width={2400}
          height={1500}
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1360px"
          className="h-auto max-h-(--demo-shot-max) w-auto max-w-full object-contain"
        />
      </div>
    </figure>
  )
}
