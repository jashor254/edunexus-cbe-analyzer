// lib/sow/termSchedule.ts
// TypeScript conversion of jashor-app termSchedule.js
// All logic preserved exactly.

export interface TermScheduleResult {
  lessonsPerWeek: number
  firstWeek: number
  firstLesson: number
  lastWeek: number
  lastLesson: number
  startSlot: number
  endSlot: number
  totalSlots: number
  doubleLesson: {
    enabled: boolean
    combination: string | null
  }
}

export function buildTermSchedule({
  lessonsPerWeek,
  firstWeek,
  firstLesson,
  lastWeek,
  lastLesson,
  doubleLessonOption = 'single',
  doubleLessonCombination = null,
}: {
  lessonsPerWeek: number
  firstWeek: number
  firstLesson: number
  lastWeek: number
  lastLesson: number
  doubleLessonOption?: 'single' | 'double'
  doubleLessonCombination?: string | null
}): TermScheduleResult {
  if (!lessonsPerWeek) {
    throw new Error('lessonsPerWeek is required')
  }

  const startSlot = (firstWeek - 1) * lessonsPerWeek + firstLesson
  const endSlot = (lastWeek - 1) * lessonsPerWeek + lastLesson

  if (startSlot >= endSlot) {
    throw new Error('Invalid term range: start is after end')
  }

  const totalSlots = endSlot - startSlot + 1

  return {
    lessonsPerWeek,
    firstWeek,
    firstLesson,
    lastWeek,
    lastLesson,
    startSlot,
    endSlot,
    totalSlots,
    doubleLesson: {
      enabled: doubleLessonOption === 'double',
      combination: doubleLessonCombination,
    },
  }
}

/**
 * Converts absolute slot back to week + lesson
 */
export function slotToWeekLesson(
  slot: number,
  lessonsPerWeek: number
): { week: number; lesson: number } {
  const week = Math.floor((slot - 1) / lessonsPerWeek) + 1
  const lesson = ((slot - 1) % lessonsPerWeek) + 1
  return { week, lesson }
}

/**
 * Converts week + lesson to absolute slot
 */
export function weekLessonToSlot(
  week: number,
  lesson: number,
  lessonsPerWeek: number
): number {
  return (week - 1) * lessonsPerWeek + lesson
}
