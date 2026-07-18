// lib/learnerBlueprint/composeBlueprint.ts
//
// The canonical Blueprint Composition Engine (Sprint 12G). Every future
// Blueprint consumer must read this function's output — no consumer may
// compose Blueprint independently (mission). Blueprint owns nothing,
// calculates nothing, stores nothing; it only asks each canonical
// domain's own function and assembles the answers (ADR-0008 Part 5/6).
//
// One domain failing must never destroy the whole Blueprint (mission) —
// every composer already returns an explicit unavailable/not_implemented
// section on its own failure rather than throwing, so this orchestrator
// runs them concurrently and simply assembles whatever came back. No
// fabricated values anywhere in the result.

import { resolveLegacyStudentId } from '@/lib/core/identity'
import { composeIdentity } from './composeIdentity'
import { composeAcademicRecord } from './composeAcademicRecord'
import { composeAttendance } from './composeAttendance'
import { composeLearningCompass } from './composeLearningCompass'
import { composeCareer } from './composeCareer'
import { composePortfolio } from './composePortfolio'
import { composeAchievement } from './composeAchievement'
import { composeProjects } from './composeProjects'
import { composeTeacherReflection } from './composeTeacherReflection'
import { composeParentSummary } from './composeParentSummary'
import { composeEducationalIdentity } from './composeEducationalIdentity'
import { composeGrowthTimeline } from './composeGrowthTimeline'
import { composeRecommendedNextSteps } from './composeRecommendedNextSteps'
import { composeMetadata } from './composeMetadata'
import { validateBlueprint, type BlueprintValidationResult } from './validation'
import type { BlueprintIdentifiers, LearnerBlueprint } from './types'

export type ComposeBlueprintResult = {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
}

export async function composeBlueprint(ids: BlueprintIdentifiers): Promise<ComposeBlueprintResult> {
  // The one canonical Core<->legacy resolution call (Sprint 12H) — Blueprint
  // remains a consumer, never an identity resolver: this is a pure, read-only
  // lookup (never creates a bridge), and every legacy-space composer below
  // still independently handles a null result by degrading explicitly,
  // exactly as before. No composer re-implements this lookup.
  const legacyStudentId = await resolveLegacyStudentId(ids.coreLearnerId)

  const [identity, academicRecord, attendance, learningCompass, career, portfolio, achievement, projects, teacherReflection] = await Promise.all([
    composeIdentity(ids),
    composeAcademicRecord(legacyStudentId),
    composeAttendance(ids.actorUserId, ids.schoolId, ids.coreLearnerId),
    composeLearningCompass(legacyStudentId),
    composeCareer(legacyStudentId),
    composePortfolio(ids.coreLearnerId, ids.schoolId),
    composeAchievement(ids.coreLearnerId, ids.schoolId),
    composeProjects(ids.coreLearnerId, ids.schoolId),
    composeTeacherReflection(ids.coreLearnerId, ids.schoolId),
  ])

  const parentSummary = composeParentSummary(identity.data?.learnerName ?? null, academicRecord, attendance)
  const educationalIdentity = composeEducationalIdentity()
  const growthTimeline = composeGrowthTimeline()
  const recommendedNextSteps = await composeRecommendedNextSteps(
    ids.coreLearnerId, ids.schoolId, learningCompass, teacherReflection, attendance, career
  )

  const sections = {
    identity,
    academicRecord,
    attendance,
    learningCompass,
    career,
    portfolio,
    achievement,
    projects,
    teacherReflection,
    parentSummary,
    educationalIdentity,
    growthTimeline,
    recommendedNextSteps,
  }

  const metadata = composeMetadata({
    sectionStatuses: Object.values(sections).map(s => s.status),
    ownerVersions: Object.fromEntries(
      Object.entries(sections).map(([key, section]) => [key, section.owner])
    ),
    evidenceWindowStart: null,
  })

  const blueprint: LearnerBlueprint = { metadata, ...sections }
  const validation = validateBlueprint(blueprint)

  return { blueprint, validation }
}
