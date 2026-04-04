// lib/sow/breakEngine.ts
// TypeScript conversion of jashor-app breakEngine.js
// All logic preserved exactly.

import { weekLessonToSlot } from './termSchedule'
import type { TermScheduleResult } from './termSchedule'
import type { BreakItem, TimelineSlot } from './types'

export interface BreakWithSlots extends BreakItem {
  startSlot: number
  endSlot: number
}

export function validateBreak(
  newBreak: BreakItem,
  existingBreaks: BreakWithSlots[],
  termSchedule: TermScheduleResult
): { valid: boolean; error?: string; startSlot?: number; endSlot?: number } {
  const { lessonsPerWeek, startSlot: termStart, endSlot: termEnd } = termSchedule

  const startSlot = weekLessonToSlot(
    Number(newBreak.startWeek),
    Number(newBreak.startLesson),
    lessonsPerWeek
  )

  const endSlot = weekLessonToSlot(
    Number(newBreak.endWeek),
    Number(newBreak.endLesson),
    lessonsPerWeek
  )

  if (startSlot > endSlot) {
    return { valid: false, error: 'Break start is after break end' }
  }

  if (startSlot < termStart || endSlot > termEnd) {
    return { valid: false, error: 'Break is outside teaching term' }
  }

  for (const existing of existingBreaks) {
    const existingStart = weekLessonToSlot(
      Number(existing.startWeek),
      Number(existing.startLesson),
      lessonsPerWeek
    )

    const existingEnd = weekLessonToSlot(
      Number(existing.endWeek),
      Number(existing.endLesson),
      lessonsPerWeek
    )

    const overlaps = startSlot <= existingEnd && endSlot >= existingStart

    if (overlaps) {
      return {
        valid: false,
        error: `Break overlaps with "${existing.title}"`,
      }
    }
  }

  return { valid: true, startSlot, endSlot }
}

/**
 * Applies breaks to a lesson slot timeline
 */
export function applyBreaksToSchedule(
  termSchedule: TermScheduleResult,
  breaks: BreakWithSlots[]
): TimelineSlot[] {
  const { startSlot, endSlot, lessonsPerWeek } = termSchedule

  const timeline: TimelineSlot[] = []

  for (let slot = startSlot; slot <= endSlot; slot++) {
    const breakHere = breaks.find(b => slot >= b.startSlot && slot <= b.endSlot)

    const week = Math.floor((slot - 1) / lessonsPerWeek) + 1
    const lesson = ((slot - 1) % lessonsPerWeek) + 1

    timeline.push({
      slotIndex: slot,
      week,
      lesson,
      isBreak: Boolean(breakHere),
    })
  }

  return timeline
}
