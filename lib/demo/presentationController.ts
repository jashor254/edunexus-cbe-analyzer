// lib/demo/presentationController.ts
//
// The /demo presentation's autoplay rules, as a pure reducer.
//
// Kept separate from the component so the behaviour a reviewer actually
// experiences — it advances, it pauses, it stops at the end and never loops —
// is testable directly, without a DOM or a fake clock. The component owns the
// timer and the event listeners; every decision about what those events mean
// is here.

import { DEMO_LOOPS } from './presentation'

export type PresentationState = {
  /** Current slide index. Always within [0, slideCount - 1]. */
  index: number
  /** Whether the autoplay timer should be running right now. */
  isPlaying: boolean
  /**
   * Whether autoplay is permitted at all. False when the viewer has asked for
   * reduced motion — manual navigation stays fully functional, nothing moves
   * on its own.
   */
  autoplayAllowed: boolean
}

export type PresentationAction =
  /** The autoplay timer elapsed. */
  | { type: 'advance' }
  /** Viewer pressed Next / Right arrow / swiped. */
  | { type: 'next' }
  /** Viewer pressed Previous / Left arrow / swiped. */
  | { type: 'prev' }
  /** Viewer pressed Pause / Play / Space. */
  | { type: 'togglePlay' }
  /** Viewer pressed Replay. */
  | { type: 'replay' }
  /** Reduced-motion preference resolved or changed. */
  | { type: 'setAutoplayAllowed'; allowed: boolean }

export function isLastSlide(index: number, slideCount: number): boolean {
  return index >= slideCount - 1
}

export function createInitialState(autoplayAllowed: boolean): PresentationState {
  return { index: 0, isPlaying: autoplayAllowed, autoplayAllowed }
}

/**
 * Resolves a target index.
 *
 * A looping deck wraps in both directions — past the end returns to the start,
 * before the start returns to the end — so a continuously running presentation
 * never reaches a dead end or a disabled control. A non-looping deck clamps.
 */
function resolveIndex(target: number, slideCount: number, loop: boolean): number {
  if (slideCount <= 0) return 0
  if (!loop) return Math.min(Math.max(target, 0), slideCount - 1)
  return ((target % slideCount) + slideCount) % slideCount
}

/**
 * Moves to `target`.
 *
 * When the deck does not loop, arriving at the final slide always stops
 * autoplay — it holds there until the viewer chooses Replay, however it got
 * there. A looping deck never stops on arrival; that is the whole point.
 */
function moveTo(
  state: PresentationState,
  target: number,
  slideCount: number,
  loop: boolean,
): PresentationState {
  const index = resolveIndex(target, slideCount, loop)
  return {
    ...state,
    index,
    isPlaying: !loop && isLastSlide(index, slideCount) ? false : state.isPlaying,
  }
}

export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
  slideCount: number,
  loop: boolean = DEMO_LOOPS,
): PresentationState {
  switch (action.type) {
    case 'advance':
      // Only the timer's own tick is gated on being allowed to play. A tick
      // that arrives while paused (or after reduced motion was turned on) is
      // ignored rather than silently moving the presentation on.
      if (!state.isPlaying || !state.autoplayAllowed) return state
      return moveTo(state, state.index + 1, slideCount, loop)

    case 'next':
      // Manual navigation works whether playing or paused, and does not
      // resume a paused presentation — the viewer stays in control.
      return moveTo(state, state.index + 1, slideCount, loop)

    case 'prev':
      return moveTo(state, state.index - 1, slideCount, loop)

    case 'togglePlay': {
      if (!state.autoplayAllowed) return state
      // On a non-looping deck there is nothing to play toward from the final
      // slide, so this is a no-op rather than a button that appears to work
      // and then immediately stops itself. A looping deck always has a next
      // slide, so play always means something.
      if (!loop && !state.isPlaying && isLastSlide(state.index, slideCount)) return state
      return { ...state, isPlaying: !state.isPlaying }
    }

    case 'replay':
      // The one action that may restart the presentation, and only because a
      // viewer explicitly asked. Honours reduced motion: it returns to the
      // start, but does not begin moving on its own.
      return { ...state, index: 0, isPlaying: state.autoplayAllowed }

    case 'setAutoplayAllowed':
      return {
        ...state,
        autoplayAllowed: action.allowed,
        isPlaying: action.allowed ? state.isPlaying : false,
      }

    default:
      return state
  }
}
