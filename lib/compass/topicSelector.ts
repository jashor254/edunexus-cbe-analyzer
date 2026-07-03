// lib/compass/topicSelector.ts
// Fetches CBC/8-4-4 strands + substrands for the TopicSelector UI.
// Single source of truth: sow_grades → sow_learning_areas → sow_strands → sow_substrands
// Uses actual DB column names: sow_strands.title, sow_substrands.title

import { repos } from '@/lib/repositories'

export interface SubstrandOption {
  id: string
  title: string               // raw from DB, e.g. "Fractions - Combined operations"
  displayName: string         // cleaned up for chips
  slug: string                // lowercase slug for compass_bridge.firstConcept
}

export interface StrandGroup {
  strandId: string
  strandTitle: string         // e.g. "NUMBERS"
  displayTitle: string        // e.g. "Numbers"
  substrands: SubstrandOption[]
}

export type TopicTree = StrandGroup[]

function toDisplayTitle(raw: string): string {
  // "DATA HANDLING AND PROBABILITY" → "Data Handling and Probability"
  return raw
    .toLowerCase()
    .replace(/\band\b/g, 'and')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function toSlug(title: string): string {
  // "Fractions - Combined operations (Addition and subtraction)" → "fractions_combined_operations"
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 60)
}

function toChipLabel(title: string): string {
  // "Fractions - Combined operations (Addition and subtraction)"
  // → "Fractions — Combined ops (Addition & Subtraction)"
  // Just clean it up a little for chip display
  return title
    .replace(/\s*-\s*/g, ' — ')
    .replace(/\(([^)]+)\)/g, (_, inner) =>
      `(${inner.replace(/\band\b/gi, '&')})`
    )
    .trim()
}

export async function getTopicsForSubject(
  subject: string,
  grade: number,
  _curriculumType: 'cbc' | '8-4-4' | 'igcse' | string
): Promise<TopicTree> {
  const gradeRows = await repos.curriculum.findGradeIdsByGrade(grade)
  if (!gradeRows.length) return []
  const gradeIds = gradeRows.map(g => g.id)

  const isExactMathName = subject === 'Core Mathematics' || subject === 'Essential Mathematics'
  const learningAreas = await repos.curriculum.findLearningAreasByGradeIds(gradeIds, subject, isExactMathName)
  if (!learningAreas.length) return []
  const laIds = learningAreas.map(la => la.id)

  const strands = await repos.curriculum.findStrandsByLearningAreaIds(laIds)
  if (!strands.length) return []
  const strandIds = strands.map(s => s.id)

  const substrands = await repos.curriculum.findSubstrandsByStrandIds(strandIds)
  if (!substrands.length) return []

  // 5. Build tree — group by normalised strand title, merging substrands
  //    when the same strand title appears under duplicate learning area rows.
  const strandsByTitle = new Map<
    string,
    { strandId: string; strandTitle: string; substrandIds: Set<string>; substrands: SubstrandOption[] }
  >()

  const ssMap = new Map<string, Array<{ id: string; title: string; strand_id: string }>>()
  for (const ss of substrands) {
    const list = ssMap.get(ss.strand_id) ?? []
    list.push(ss)
    ssMap.set(ss.strand_id, list)
  }

  for (const strand of strands) {
    const titleKey = strand.title.trim().toUpperCase()
    const children = ssMap.get(strand.id) ?? []

    if (!strandsByTitle.has(titleKey)) {
      strandsByTitle.set(titleKey, {
        strandId: strand.id,
        strandTitle: strand.title,
        substrandIds: new Set(children.map(ss => ss.id)),
        substrands: children.map(ss => ({
          id: ss.id,
          title: ss.title,
          displayName: toChipLabel(ss.title),
          slug: toSlug(ss.title),
        })),
      })
    } else {
      // Merge substrands from duplicate strand row, skipping duplicates
      const existing = strandsByTitle.get(titleKey)!
      for (const ss of children) {
        if (!existing.substrandIds.has(ss.id)) {
          existing.substrandIds.add(ss.id)
          existing.substrands.push({
            id: ss.id,
            title: ss.title,
            displayName: toChipLabel(ss.title),
            slug: toSlug(ss.title),
          })
        }
      }
    }
  }

  const tree: TopicTree = []
  for (const entry of strandsByTitle.values()) {
    if (entry.substrands.length === 0) continue
    tree.push({
      strandId: entry.strandId,
      strandTitle: entry.strandTitle,
      displayTitle: toDisplayTitle(entry.strandTitle),
      substrands: entry.substrands,
    })
  }

  return tree
}

export async function getAvailableGrades(
  subject: string,
  _curriculumType: string
): Promise<number[]> {
  const learningAreas = await repos.curriculum.findLearningAreaGradeIds(subject)
  if (!learningAreas.length) return []

  const gradeIds = [...new Set(learningAreas.map(la => la.grade_id))]
  const grades = await repos.curriculum.findGradesByIds(gradeIds)

  return grades.map(g => g.numeric_grade)
}

export async function resolveConceptToDisplayName(
  concept: string,
  grade: number
): Promise<string> {
  if (!concept) return concept

  const searchTerm = concept.replace(/_/g, ' ')
  const rows = await repos.curriculum.findSubstrandsByTitle(searchTerm)

  if (rows.length) {
    const gradeRows = await repos.curriculum.findGradeIdsByGrade(grade)
    if (gradeRows.length) {
      const strandIds = rows.map(r => r.strand_id)
      const validStrands = await repos.curriculum.findStrandsByIds(strandIds)
      const validStrandIds = new Set(validStrands.map(s => s.id))
      const gradeMatch = rows.find(r => validStrandIds.has(r.strand_id))
      if (gradeMatch) return gradeMatch.title
    }
    return rows[0].title
  }

  return concept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
