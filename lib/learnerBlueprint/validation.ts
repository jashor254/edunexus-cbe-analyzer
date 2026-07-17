// lib/learnerBlueprint/validation.ts
//
// Blueprint validator (Sprint 12G mission: "No silent failures"). Never
// throws for a normal partial-availability Blueprint (that is expected,
// per ADR-0008's failure-handling model) — returns an explicit result
// so a caller always knows exactly what's wrong, never has to guess from
// an absent field.

import type { LearnerBlueprint, BlueprintSectionStatus } from './types'

export type BlueprintValidationError = {
  field: string
  message: string
}

export type BlueprintValidationResult = {
  valid: boolean
  errors: BlueprintValidationError[]
}

const REQUIRED_SECTIONS: Array<keyof LearnerBlueprint> = ['identity']

const ALL_SECTIONS: Array<Exclude<keyof LearnerBlueprint, 'metadata'>> = [
  'identity',
  'academicRecord',
  'attendance',
  'learningCompass',
  'career',
  'portfolio',
  'teacherReflection',
  'parentSummary',
  'educationalIdentity',
  'growthTimeline',
  'recommendedNextSteps',
]

const VALID_STATUSES: BlueprintSectionStatus[] = ['available', 'unavailable', 'not_implemented']

export function validateBlueprint(blueprint: LearnerBlueprint): BlueprintValidationResult {
  const errors: BlueprintValidationError[] = []

  // Required sections — Identity must exist and be composable; a Blueprint
  // with no confirmed learner identity is not a valid Blueprint at all
  // (ADR-0005 §2.1: Identity anchors every other section).
  for (const key of REQUIRED_SECTIONS) {
    const section = blueprint[key] as { status: BlueprintSectionStatus }
    if (section.status !== 'available') {
      errors.push({ field: key, message: `${String(key)} is required and must be 'available', got '${section.status}'.` })
    }
  }

  // Owner presence — every section must declare an owning domain string,
  // even when unavailable, so traceability never silently drops (ADR-0008
  // Part 9 / Part 12 invariant 9).
  for (const key of ALL_SECTIONS) {
    const section = blueprint[key] as { status: BlueprintSectionStatus; owner: string }
    if (!section.owner || section.owner.trim().length === 0) {
      errors.push({ field: key, message: `${String(key)} is missing its owner declaration.` })
    }
    if (!VALID_STATUSES.includes(section.status)) {
      errors.push({ field: key, message: `${String(key)} has an invalid status '${section.status}'.` })
    }
  }

  // Metadata completeness.
  const m = blueprint.metadata
  if (!m.blueprintVersion) errors.push({ field: 'metadata.blueprintVersion', message: 'blueprintVersion is required.' })
  if (!m.generatedAt) errors.push({ field: 'metadata.generatedAt', message: 'generatedAt is required.' })
  if (!m.snapshotState) errors.push({ field: 'metadata.snapshotState', message: 'snapshotState is required.' })
  if (!m.freshness) errors.push({ field: 'metadata.freshness', message: 'freshness is required.' })
  if (!m.evidenceWindow || !m.evidenceWindow.end) {
    errors.push({ field: 'metadata.evidenceWindow', message: 'evidenceWindow.end is required.' })
  }

  // Snapshot validity — this engine only ever produces 'current' compositions
  // (ADR-0008 Part 3); a 'snapshot' state from this engine would be a bug,
  // not a valid future feature, since Snapshot-taking is a separate,
  // not-yet-built concern with its own trigger moments.
  if (m.snapshotState !== 'current') {
    errors.push({ field: 'metadata.snapshotState', message: `Composition engine must only ever produce 'current' Blueprints, got '${m.snapshotState}'.` })
  }

  return { valid: errors.length === 0, errors }
}
