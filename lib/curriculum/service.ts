// lib/curriculum/service.ts
// CurriculumService — the single facade every curriculum consumer should go through.
// Wraps lib/repositories/curriculum.repository.ts (the only place that touches sow_*
// tables directly) plus the existing Curriculum Grounding Layer in curriculumContext.ts.
// No raw SQL lives here — orchestration and a small cache only.

import { repos } from '@/lib/repositories'
import { resolveCurriculumContext, UNAVAILABLE_CURRICULUM_FIELDS, type CurriculumContext } from './curriculumContext'
import { resolveCurriculumType } from './curriculumMode'
import type { CurriculumMode } from '@/lib/sow/types'

// curriculum_type → level id changes essentially never (it's structural seed data),
// so a short TTL cache avoids a repeated sow_levels round trip per request without
// risking staleness on anything that actually changes.
const LEVEL_ID_CACHE_TTL_MS = 10 * 60_000
const levelIdCache = new Map<string, { id: string | null; expiresAt: number }>()

async function resolvePrimaryLevelId(curriculumType: string): Promise<string | null> {
  const cached = levelIdCache.get(curriculumType)
  if (cached && cached.expiresAt > Date.now()) return cached.id

  const level = await repos.curriculum.findPrimaryLevelId(curriculumType)
  levelIdCache.set(curriculumType, { id: level?.id ?? null, expiresAt: Date.now() + LEVEL_ID_CACHE_TTL_MS })
  return level?.id ?? null
}

export type CurriculumGrade = { id: string; level_id: string; name: string; numeric_grade: number; order_index: number }
export type CurriculumLearningArea = { id: string; name: string }
export type CurriculumStrandWithSubstrands = {
  id: string
  title: string
  substrands: Array<{ id: string; title: string; suggested_lessons: number }>
}
export type CurriculumKicdContext = {
  kicdArea: { kicd_subject_data: Record<string, unknown> | null } | null
  kicdStrands: Array<{ title: string; kicd_data: Record<string, unknown> | null }>
}

export const CurriculumService = {
  /** Grades for a curriculum mode — used by app/api/sow/grades. */
  async resolveGradesForMode(mode: string): Promise<CurriculumGrade[]> {
    const curriculumType = resolveCurriculumType(mode)
    if (!curriculumType) return []

    const levelId = await resolvePrimaryLevelId(curriculumType)
    if (!levelId) return []

    return repos.curriculum.findActiveGradesByLevelId(levelId)
  },

  /** Learning areas (subjects) for a mode + grade string — used by app/api/sow/learning-areas. */
  async resolveLearningAreasForGrade(mode: CurriculumMode, grade: string): Promise<CurriculumLearningArea[]> {
    const curriculumType = resolveCurriculumType(mode)
    if (!curriculumType) return []

    const levelId = await resolvePrimaryLevelId(curriculumType)
    if (!levelId) return []

    const gradeRow = await repos.curriculum.findActiveGradeByNamePrefix(levelId, grade)
    if (!gradeRow) return []

    return repos.curriculum.findLearningAreasByGradeId(gradeRow.id)
  },

  /** Strands + substrands for a learning area, grouped — used by app/api/sow/strands. */
  async resolveStrandsWithSubstrands(learningAreaId: string): Promise<CurriculumStrandWithSubstrands[]> {
    const strands = await repos.curriculum.findStrandsForGeneration(learningAreaId)
    if (!strands.length) return []

    const strandIds = strands.map(s => s.id)
    const substrands = await repos.curriculum.findAllSubstrandsByStrandIds(strandIds)

    const subsByStrand: Record<string, Array<{ id: string; title: string; suggested_lessons: number }>> = {}
    for (const sub of substrands) {
      if (!subsByStrand[sub.strand_id]) subsByStrand[sub.strand_id] = []
      subsByStrand[sub.strand_id].push({ id: sub.id, title: sub.title, suggested_lessons: sub.suggested_lessons })
    }

    return strands.map(s => ({
      id: s.id,
      title: s.title,
      substrands: subsByStrand[s.id] || [],
    }))
  },

  /** KICD JSON enrichment for a subject — used by app/api/sow/kicd-context. */
  async resolveKicdContext(subject: string): Promise<CurriculumKicdContext> {
    const { area, strands } = await repos.curriculum.findKicdContextBySubjectName(subject)
    return { kicdArea: area, kicdStrands: strands }
  },

  /** Real curriculum grounding for a sub-strand — used by Adaptive Learning. Never fabricates. */
  async resolveSubstrandContext(subStrandId: string): Promise<CurriculumContext | null> {
    return resolveCurriculumContext(subStrandId)
  },
}

export { UNAVAILABLE_CURRICULUM_FIELDS }
export type { CurriculumContext }
