// lib/sow/kicdGrounding.ts
//
// Grounds each allocated SOW lesson in the KICD sub-strand it actually
// teaches. Replaces the old client-supplied `kicdContext`, which the
// generator matched to a strand by title prefix and then always read at
// `kicd_data[0]` — so every lesson in a strand got the strand's FIRST
// sub-strand as its "official KICD content".
//
// The data is loaded server-side by the strand ids the teacher selected;
// the matching and slicing are pure (lib/curriculum/kicdEntries.ts).

import { repos } from '@/lib/repositories'
import {
  parseKicdEntries,
  matchKicdEntry,
  assignLessonParts,
  sliceKicdForLesson,
  type KicdEntry,
  type KicdLessonSlice,
} from '@/lib/curriculum/kicdEntries'
import type { AllocatedLesson } from './types'

export type KicdEntriesByStrandId = Record<string, KicdEntry[]>

export async function loadKicdEntriesByStrandId(strandIds: string[]): Promise<KicdEntriesByStrandId> {
  const unique = [...new Set(strandIds.filter(Boolean))]
  const rows = await repos.curriculum.findKicdDataByStrandIds(unique)
  const byId: KicdEntriesByStrandId = {}
  for (const row of rows) byId[row.id] = parseKicdEntries(row.kicd_data)
  return byId
}

// One slice per allocated lesson, in the same order; null where the lesson's
// sub-strand has no credible KICD entry (it must then be reported as NOT
// grounded, never given another sub-strand's content).
export function groundAllocatedLessons(
  lessons: AllocatedLesson[],
  entriesByStrandId: KicdEntriesByStrandId,
): Array<KicdLessonSlice | null> {
  const matches = lessons.map(lesson => {
    const entries = lesson.strandId ? entriesByStrandId[lesson.strandId] ?? [] : []
    const index = matchKicdEntry(lesson.substrand, entries)
    return index === null ? null : { entry: entries[index], key: `${lesson.strandId}#${index}` }
  })
  const parts = assignLessonParts(matches.map(m => m?.key ?? null))
  return matches.map((m, i) => (m ? sliceKicdForLesson(m.entry, parts[i].part, parts[i].parts) : null))
}
