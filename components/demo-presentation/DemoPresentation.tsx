'use client'

// components/demo-presentation/DemoPresentation.tsx
//
// The presentation shell: timer, input handling, progress, controls.
//
// Every rule about what an event *means* lives in lib/demo/presentationController
// as a pure reducer; this component only turns real events into actions and
// renders the result. It holds no global state, persists nothing, and reads no
// product data — a refresh starts the presentation over from the beginning,
// which is exactly what "remember nothing" asks for.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  DEMO_SLIDES,
  DEMO_SLIDE_COUNT,
  DEMO_DATA_QUALIFIER,
  DEMO_LOOPS,
} from '@/lib/demo/presentation'
import {
  createInitialState,
  presentationReducer,
  isLastSlide,
  type PresentationAction,
  type PresentationState,
} from '@/lib/demo/presentationController'
import { DemoSlideView } from './DemoSlide'

const SWIPE_THRESHOLD_PX = 48

function reducer(state: PresentationState, action: PresentationAction): PresentationState {
  return presentationReducer(state, action, DEMO_SLIDE_COUNT, DEMO_LOOPS)
}

export function DemoPresentation({ availableAssets }: { availableAssets: readonly string[] }) {
  // Autoplay starts disabled and is enabled after mount only if the viewer has
  // not asked for reduced motion. Starting false means server and first client
  // render agree, and means the safe state is the one that renders if the
  // preference check never runs.
  const [state, dispatch] = useReducer(reducer, false, createInitialState)
  const [hovered, setHovered] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const { index, isPlaying, autoplayAllowed } = state
  const slide = DEMO_SLIDES[index]
  const onLastSlide = isLastSlide(index, DEMO_SLIDE_COUNT)

  // ── Reduced motion ────────────────────────────────────────────────────────
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => dispatch({ type: 'setAutoplayAllowed', allowed: !query.matches })
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  // ── Pause while the tab is hidden ─────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ── The autoplay timer ────────────────────────────────────────────────────
  // Suspended — not reset — while the viewer is focused in or hovering the
  // controls, or while the tab is hidden. Every slide carries a dwell time, so
  // the deck runs continuously; a null duration would mean "hold here forever"
  // and is what DEMO_LOOPS = false expresses instead.
  const suspended = hovered || tabHidden
  const durationMs = slide.durationMs

  useEffect(() => {
    if (!isPlaying || !autoplayAllowed || suspended || durationMs === null) return
    const timer = window.setTimeout(() => dispatch({ type: 'advance' }), durationMs)
    return () => window.clearTimeout(timer)
  }, [index, isPlaying, autoplayAllowed, suspended, durationMs])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      // Never hijack Space from a focused control — that would break the
      // Pause and Replay buttons for keyboard users.
      const onControl = target?.closest('button, a, input, textarea, select') != null

      if (event.key === 'ArrowRight') { event.preventDefault(); dispatch({ type: 'next' }) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); dispatch({ type: 'prev' }) }
      else if ((event.key === ' ' || event.key === 'Spacebar') && !onControl) {
        event.preventDefault()
        dispatch({ type: 'togglePlay' })
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
    dispatch({ type: delta < 0 ? 'next' : 'prev' })
  }, [])

  const playLabel = isPlaying ? 'Pause presentation' : 'Play presentation'

  return (
    <div
      className="flex min-h-svh flex-col bg-(--demo-ink)"
      // Focus anywhere in the presentation suspends autoplay: a keyboard user
      // who has tabbed in is reading, and should not have the slide move under
      // them. Mouse hover is deliberately NOT bound here — the presentation
      // fills the viewport, so a resting cursor would suspend it permanently
      // and the deck would never advance. Hover-to-pause is scoped to the
      // controls instead (see the footer below), where it is a real intent.
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Progress ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 md:px-10">
        <ol
          className="mx-auto flex max-w-6xl items-center gap-1.5"
          aria-label={`Presentation progress: slide ${index + 1} of ${DEMO_SLIDE_COUNT}`}
        >
          {DEMO_SLIDES.map((s, i) => (
            <li key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className={`block h-full rounded-full transition-colors duration-500 ${
                  (DEMO_LOOPS ? i === index : i <= index) ? 'bg-(--demo-teal)' : 'bg-transparent'
                }`}
              />
              <span className="sr-only">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Slide ─────────────────────────────────────────────────────────── */}
      <main
        className="flex flex-1 items-center"
        aria-live="polite"
        aria-atomic="true"
      >
        <section
          key={slide.id}
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${DEMO_SLIDE_COUNT}: ${slide.label}`}
          className="demo-slide-enter w-full"
        >
          <DemoSlideView slide={slide} availableAssets={availableAssets} isActive />
        </section>
      </main>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <footer
        className="px-6 pb-7 md:px-10"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'prev' })}
              disabled={!DEMO_LOOPS && index === 0}
              aria-label="Previous slide"
              className="demo-control"
            >
              Previous
            </button>

            {!DEMO_LOOPS && onLastSlide ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'replay' })}
                aria-label="Replay presentation from the beginning"
                className="demo-control"
              >
                Replay presentation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'togglePlay' })}
                disabled={!autoplayAllowed}
                aria-label={playLabel}
                aria-pressed={isPlaying}
                className="demo-control"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}

            <button
              type="button"
              onClick={() => dispatch({ type: 'next' })}
              disabled={!DEMO_LOOPS && onLastSlide}
              aria-label="Next slide"
              className="demo-control"
            >
              Next
            </button>
          </div>

          <p className="text-xs leading-relaxed text-(--demo-muted-dim) sm:text-right">
            {DEMO_DATA_QUALIFIER}
          </p>
        </div>
      </footer>
    </div>
  )
}
