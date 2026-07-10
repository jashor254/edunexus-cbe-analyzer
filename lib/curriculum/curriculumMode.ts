// lib/curriculum/curriculumMode.ts
// Single source of truth for CurriculumMode → sow_levels.curriculum_type mapping.
// Previously duplicated verbatim in app/api/sow/grades/route.ts and
// app/api/sow/learning-areas/route.ts.

import type { CurriculumMode } from '@/lib/sow/types'

export const MODE_TO_CURRICULUM_TYPE: Record<CurriculumMode, string> = {
  cbc_senior: 'cbc_senior',
  cbc_junior: 'cbc_junior',
  '844_form3': '844',
  '844_form4': '844',
}

export function resolveCurriculumType(mode: string): string | null {
  return MODE_TO_CURRICULUM_TYPE[mode as CurriculumMode] ?? null
}
