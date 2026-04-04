// lib/sow/lessonAllocator.ts
// TypeScript conversion of jashor-app lessonAllocator.js
// All logic preserved exactly.

import type { SelectedSubstrand, TimelineSlot, AllocatedLesson } from './types'

export function allocateLessons({
  timeline,
  selectedSubstrands,
}: {
  timeline: TimelineSlot[]
  selectedSubstrands: SelectedSubstrand[]
}): AllocatedLesson[] {
  if (!timeline || !selectedSubstrands) {
    throw new Error('Timeline and substrands are required for lesson allocation')
  }

  // Filter only teaching slots (no breaks)
  const teachingSlots = timeline.filter(slot => !slot.isBreak)

  const allocatedLessons: AllocatedLesson[] = []
  let slotPointer = 0

  for (const substrand of selectedSubstrands) {
    const { strandTitle, substrandTitle, lessonsRequired } = substrand

    if (!lessonsRequired || lessonsRequired < 1) {
      throw new Error(`Invalid lessonsRequired for ${substrandTitle}`)
    }

    for (let lessonIndex = 1; lessonIndex <= lessonsRequired; lessonIndex++) {
      const currentSlot = teachingSlots[slotPointer]

      if (!currentSlot) {
        throw new Error('Not enough teaching slots to allocate all lessons')
      }

      allocatedLessons.push({
        slotIndex: currentSlot.slotIndex,
        week: currentSlot.week,
        lesson: currentSlot.lesson,
        strand: strandTitle,
        substrand: substrandTitle,
        lessonInSubstrand: lessonIndex,
      })

      slotPointer++
    }
  }

  return allocatedLessons
}
