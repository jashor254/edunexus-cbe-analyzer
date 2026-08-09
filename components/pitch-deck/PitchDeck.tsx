'use client'

// components/pitch-deck/PitchDeck.tsx
//
// The deck shell: navigation, progress, controls.
//
// Manual navigation only — there is no autoplay and no timer. A reviewer
// opening this from an application form is reading at their own pace, and a
// slide moving under them would be a defect, not a feature. That also means
// the deck is fully understandable with JavaScript doing nothing but
// responding to a click.
//
// Holds no global state, persists nothing, reads no product data. The one
// piece of state that outlives a render is the URL fragment, so a reviewer
// can send a colleague a specific slide.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PITCH_SLIDES, PITCH_SLIDE_COUNT, PITCH_SCREENSHOT_NOTE } from '@/lib/pitch/deck'
import { PitchSlideView } from './PitchSlideView'

const SWIPE_THRESHOLD_PX = 48

function clampIndex(i: number): number {
  if (i < 0) return 0
  if (i > PITCH_SLIDE_COUNT - 1) return PITCH_SLIDE_COUNT - 1
  return i
}

export function PitchDeck({ availableAssets }: { availableAssets: readonly string[] }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const slide = PITCH_SLIDES[index]
  const atStart = index === 0
  const atEnd = index === PITCH_SLIDE_COUNT - 1

  const go = useCallback((next: number) => setIndex(prev => {
    const clamped = clampIndex(next)
    return clamped === prev ? prev : clamped
  }), [])

  // ── Deep link ─────────────────────────────────────────────────────────────
  // The URL fragment is an external system this component stays in step with,
  // in both directions: /pitch#founder opens on that slide, and so does
  // editing the fragment while the deck is already open. Server and first
  // client render always agree on slide 0 — the jump happens after mount, so
  // hydration is never handed two different answers.
  useEffect(() => {
    const syncFromHash = () => {
      const id = window.location.hash.replace(/^#/, '')
      if (!id) return
      const found = PITCH_SLIDES.findIndex(s => s.id === id)
      if (found >= 0) setIndex(found)
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  // Keep the fragment in step without adding history entries — Back should
  // leave the deck, not walk backwards through twelve slides.
  useEffect(() => {
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}#${PITCH_SLIDES[index].id}`)
  }, [index])

  // Each slide starts at the top. Without this, arriving at a long slide from
  // a scrolled one lands the reviewer mid-slide.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [index])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Never hijack keys from a focused control — that would break the
      // navigation buttons for keyboard users.
      if (target?.closest('button, a, input, textarea, select')) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      }

      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        setIndex(prev => clampIndex(prev + 1))
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        setIndex(prev => clampIndex(prev - 1))
      } else if (event.key === 'Home') {
        event.preventDefault()
        setIndex(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        setIndex(PITCH_SLIDE_COUNT - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Touch ─────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const delta = (e.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    setIndex(prev => clampIndex(prev + (delta < 0 ? 1 : -1)))
  }, [])

  return (
    <div
      className="flex min-h-svh flex-col bg-(--demo-ink)"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Progress / jump ───────────────────────────────────────────────
          Each segment is a real button, so a reviewer with three minutes can
          go straight to the slide they care about. Labelled, never
          hover-dependent. */}
      <nav className="px-6 pt-4 md:px-10" aria-label="Slides">
        <ol className="mx-auto flex max-w-6xl items-center gap-1.5">
          {PITCH_SLIDES.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${s.number} of ${PITCH_SLIDE_COUNT}: ${s.label}`}
                aria-current={i === index ? 'true' : undefined}
                className="group block w-full py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--demo-teal)"
              >
                <span
                  className={`block h-0.5 w-full rounded-full transition-colors duration-300 ${
                    i === index
                      ? 'bg-(--demo-teal)'
                      : i < index
                      ? 'bg-white/25 group-hover:bg-(--demo-teal)/60'
                      : 'bg-white/10 group-hover:bg-(--demo-teal)/60'
                  }`}
                />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* ── Slide ─────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center" aria-live="polite" aria-atomic="true">
        <section
          key={slide.id}
          aria-roledescription="slide"
          aria-label={`${slide.number} of ${PITCH_SLIDE_COUNT}: ${slide.label}`}
          className="demo-slide-enter w-full"
        >
          <PitchSlideView slide={slide} availableAssets={availableAssets} isActive />
        </section>
      </main>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <footer className="px-6 pb-4 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={atStart}
              aria-label="Previous slide"
              className="demo-control"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={atEnd}
              aria-label="Next slide"
              className="demo-control"
            >
              Next
            </button>
            <p className="ml-2 font-mono text-xs tabular-nums text-(--demo-muted-dim)">
              {String(slide.number).padStart(2, '0')} / {PITCH_SLIDE_COUNT}
            </p>
          </div>

          {/* The qualifier belongs where a real product screen is on show. Each
              screenshot also carries it in its own caption, so a reviewer who
              captures just that slide still takes the caveat with them. */}
          {slide.visual.kind === 'screenshot' && (
            <p className="text-xs leading-relaxed text-(--demo-muted-dim) sm:text-right">
              {PITCH_SCREENSHOT_NOTE}
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
