// lib/demo/presentationController.ts
//
// The /demo presentation's autoplay rules, as a pure reducer.
//
// Kept separate from the component so the behaviour a reviewer actually
// experiences — it advances, it pauses, it stops at the end and never loops —
// is testable directly, without a DOM or a fake clock. The component owns the
// timer and the event listeners; every decision about what those events mean
// is here.

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

function clamp(index: number, slideCount: number): number {
  return Math.min(Math.max(index, 0), Math.max(slideCount - 1, 0))
}

/**
 * Moves to `target`, applying the one rule that governs the end of the
 * presentation: arriving at the final slide always stops autoplay. The
 * presentation holds there until the viewer chooses Replay — it never restarts
 * itself, however it got there.
 */
function moveTo(state: PresentationState, target: number, slideCount: number): PresentationState {
  const index = clamp(target, slideCount)
  return {
    ...state,
    index,
    isPlaying: isLastSlide(index, slideCount) ? false : state.isPlaying,
  }
}

export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
  slideCount: number,
): PresentationState {
  switch (action.type) {
    case 'advance':
      // Only the timer's own tick is gated on being allowed to play. A tick
      // that arrives while paused (or after reduced motion was turned on) is
      // ignored rather than silently moving the presentation on.
      if (!state.isPlaying || !state.autoplayAllowed) return state
      return moveTo(state, state.index + 1, slideCount)

    case 'next':
      // Manual navigation works whether playing or paused, and does not
      // resume a paused presentation — the viewer stays in control.
      return moveTo(state, state.index + 1, slideCount)

    case 'prev':
      return moveTo(state, state.index - 1, slideCount)

    case 'togglePlay': {
      if (!state.autoplayAllowed) return state
      // Nothing to play toward on the final slide; Replay is the affordance
      // there, so this is a no-op rather than a button that appears to work
      // and then immediately stops itself.
      if (!state.isPlaying && isLastSlide(state.index, slideCount)) return state
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
