// lib/compass/topicSelector.ts
// Fetches CBC/8-4-4 strands + substrands for the TopicSelector UI.
// Single source of truth: sow_grades → sow_learning_areas → sow_strands → sow_substrands
// Uses actual DB column names: sow_strands.title, sow_substrands.title

import { createServiceClient } from '@/utils/supabase/service'

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
  curriculumType: 'cbc' | '8-4-4' | 'igcse' | string
): Promise<TopicTree> {
  const db = createServiceClient()

  // 1. Find grade IDs matching numeric_grade
  const { data: gradeRows } = await db
    .from('sow_grades')
    .select('id')
    .eq('numeric_grade', grade)

  if (!gradeRows?.length) return []
  const gradeIds = gradeRows.map((g: { id: string }) => g.id)

  // 2. Find learning area matching subject name
  const { data: learningAreas } = await db
    .from('sow_learning_areas')
    .select('id, name')
    .in('grade_id', gradeIds)
    .ilike('name', `%${subject}%`)
    .order('name')
    .limit(5)

  if (!learningAreas?.length) return []

  const laIds = learningAreas.map((la: { id: string }) => la.id)

  // 3. Strands for those learning areas
  const { data: strands } = await db
    .from('sow_strands')
    .select('id, title, learning_area_id, order_index')
    .in('learning_area_id', laIds)
    .order('order_index')

  if (!strands?.length) return []

  const strandIds = strands.map((s: { id: string }) => s.id)

  // 4. Substrands — cap at 200 to keep UI manageable
  const { data: substrands } = await db
    .from('sow_substrands')
    .select('id, title, strand_id, order_index')
    .in('strand_id', strandIds)
    .order('order_index')
    .limit(200)

  if (!substrands?.length) return []

  // 5. Build tree — deduplicate strand titles
  const seenStrandTitles = new Set<string>()
  const tree: TopicTree = []

  for (const strand of strands as Array<{ id: string; title: string; learning_area_id: string }>) {
    const titleKey = strand.title.trim().toUpperCase()
    if (seenStrandTitles.has(titleKey)) continue
    seenStrandTitles.add(titleKey)

    const children = (substrands as Array<{ id: string; title: string; strand_id: string }>)
      .filter(ss => ss.strand_id === strand.id)
      .map(ss => ({
        id: ss.id,
        title: ss.title,
        displayName: toChipLabel(ss.title),
        slug: toSlug(ss.title),
      }))

    if (children.length === 0) continue

    tree.push({
      strandId: strand.id,
      strandTitle: strand.title,
      displayTitle: toDisplayTitle(strand.title),
      substrands: children,
    })
  }

  return tree
}

export async function resolveConceptToDisplayName(
  concept: string,
  grade: number
): Promise<string> {
  // Given a slug like "fractions_combined_operations", find the best matching substrand title
  if (!concept) return concept

  const db = createServiceClient()
  const searchTerm = concept.replace(/_/g, ' ')

  // Try exact slug reverse first
  const { data: rows } = await db
    .from('sow_substrands')
    .select('id, title, strand_id')
    .ilike('title', `%${searchTerm}%`)
    .limit(5)

  if (rows?.length) {
    // If multiple matches, try to narrow by joining back to grade
    const { data: gradeRows } = await db
      .from('sow_grades')
      .select('id')
      .eq('numeric_grade', grade)

    if (gradeRows?.length) {
      const gradeIds = gradeRows.map((g: { id: string }) => g.id)
      const strandIds = rows.map((r: { strand_id: string }) => r.strand_id)

      const { data: validStrands } = await db
        .from('sow_strands')
        .select('id, learning_area_id')
        .in('id', strandIds)

      const validStrandIds = new Set(validStrands?.map((s: { id: string }) => s.id) ?? [])
      const gradeMatch = rows.find((r: { strand_id: string }) => validStrandIds.has(r.strand_id))
      if (gradeMatch) return (gradeMatch as { title: string }).title
    }

    return (rows[0] as { title: string }).title
  }

  // Fallback: clean up the slug
  return concept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
