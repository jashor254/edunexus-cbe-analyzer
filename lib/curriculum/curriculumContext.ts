// lib/curriculum/curriculumContext.ts
// Curriculum Grounding Layer — resolves the real, seeded KICD curriculum
// tree (sow_grades → sow_learning_areas → sow_strands → sow_substrands →
// sow_learning_outcomes) for a specific sub-strand, per the platform's
// Curriculum Integrity mandate: every Adaptive Learning recommendation
// must be grounded in curriculum data already stored in EduNexus, and if
// that data doesn't exist, the system must say so explicitly rather than
// invent it.
//
// Honest scope, verified against the live database rather than assumed:
// `sow_strands.kicd_data` and `sow_learning_areas.kicd_subject_data` are
// EMPTY across every row today — Core Competencies, Pertinent and
// Contemporary Issues, Values, Suggested Learning Experiences, and
// Assessment Opportunities have never actually been seeded, despite the
// schema having columns for them. Only Strand, Sub-Strand, and Specific
// Learning Outcomes (`sow_learning_outcomes`, 608 real rows) are populated.
// This module resolves exactly what's real and reports the rest as an
// explicit, structured gap — never a fabricated placeholder.
//
// This is a read-only consumer of the existing `lib/curriculum`/`sow_*`
// data model (the same one lib/compass/topicSelector.ts already reads) —
// it does not introduce a second curriculum data source, per the same
// "one source of truth per domain" discipline the Adaptive Learning v2
// Architecture applies to Projection.

import { repos } from '@/lib/repositories'

/** Fields the KICD schema has columns for but that are not yet seeded in this database — never fabricated, always named. */
export const UNAVAILABLE_CURRICULUM_FIELDS = [
  'core_competencies',
  'pertinent_and_contemporary_issues',
  'values',
  'suggested_learning_experiences',
  'assessment_opportunities',
  'approved_learning_resources',
] as const

export type CurriculumContext = {
  strandId:         string
  strandTitle:      string
  subStrandId:      string
  subStrandTitle:   string
  /** Real Specific Learning Outcome text, in curriculum order — may be empty if none are seeded for this substrand. */
  learningOutcomes: string[]
  /** Always the fixed list above today — structured, not buried in prose, so a UI can render it as a distinct notice. */
  unavailableFields: readonly string[]
}

/**
 * Resolves a specific sub-strand's real curriculum context. Returns null
 * (never a fabricated stand-in) if the sub-strand id doesn't resolve to a
 * real row — the caller is responsible for surfacing that as an explicit
 * "no curriculum data" state, per the Golden Rule.
 */
export async function resolveCurriculumContext(subStrandId: string): Promise<CurriculumContext | null> {
  const substrand = await repos.curriculum.findSubstrandById(subStrandId)
  if (!substrand) return null

  const [strands, outcomes] = await Promise.all([
    repos.curriculum.findStrandsByIds([substrand.strand_id]),
    repos.curriculum.findLearningOutcomesBySubstrandId(subStrandId),
  ])

  const strand = strands[0]
  if (!strand) return null

  return {
    strandId:          strand.id,
    strandTitle:       strand.title,
    subStrandId:        substrand.id,
    subStrandTitle:     substrand.title,
    learningOutcomes:   outcomes.map(o => o.outcome),
    unavailableFields:  UNAVAILABLE_CURRICULUM_FIELDS,
  }
}
