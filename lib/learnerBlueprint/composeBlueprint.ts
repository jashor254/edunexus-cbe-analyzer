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
//
// Section set (2026-08-12 over-engineering pass): Projects, Competitions,
// Leadership and Innovations were composed here from Sprint 12 until this
// date and rendered `unavailable` for every learner the whole time — none
// of the four domains has, or has ever had, a single write path or page in
// `app/`, and their tables' last row was written on the build sprint's own
// day (2026-07-18) with nothing since. Educational Identity was a hardcoded
// `not_implemented` return occupying a section slot. Composing five sections
// that structurally cannot hold data cost four DB round trips on every
// Blueprint render, so they are no longer composed. The owning domains
// (`lib/learnerProjects/`, `learnerCompetitions/`, `learnerLeadership/`,
// `learnerInnovation/`) are untouched and still fully tested — when one of
// them grows a real write path, re-adding its composer here is a five-line
// change.

import { resolveLegacyStudentId } from '@/lib/core/identity'
import { composeIdentity } from './composeIdentity'
import { composeAcademicRecord } from './composeAcademicRecord'
import { composeAttendance } from './composeAttendance'
import { composeLearningCompass } from './composeLearningCompass'
import { composeCareer } from './composeCareer'
import { composePortfolio } from './composePortfolio'
import { composeAchievement } from './composeAchievement'
import { composeTeacherReflection } from './composeTeacherReflection'
import { composeParentSummary } from './composeParentSummary'
import { composeGrowthTimeline } from './composeGrowthTimeline'
import { composeRisk } from './composeRisk'
import { composeLearningStory } from './composeLearningStory'
import { composeRecommendedNextSteps } from './composeRecommendedNextSteps'
import { composeMetadata } from './composeMetadata'
import { loadProjectionAccess } from './projectionAccess'
import { validateBlueprint, type BlueprintValidationResult } from './validation'
import { composeBlueprintCoherence } from './coherence'
import type { CoherenceReport } from './coherence'
import type { BlueprintIdentifiers, LearnerBlueprint } from './types'

export type ComposeBlueprintResult = {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
}

/**
 * Phase 4A — the Blueprint Intelligence Coherence Engine's diagnosis:
 * whether every educational claim/recommendation/action in this
 * composition is internally consistent with the learner's own Evidence/
 * Projection. Distinct from `validation`, which only checks structural
 * completeness (every section present, owner declared) — a Blueprint can
 * be `validation.valid === true` and still `coherence.result === 'FAIL'`.
 * Never mutates `blueprint` — diagnosis only, per this phase's own rule.
 *
 * Deliberately NOT part of `composeBlueprint()`'s own result: the engine
 * costs an extra `listApprovedForLearner` query plus seven rule passes,
 * and only two callers in the platform actually read the report (the
 * learner Blueprint page's publication gate and `approveBlueprintAction`'s
 * enforcement boundary). Every other caller — both Parent pages, snapshot
 * capture — used to pay that cost and discard the result. Callers that
 * need the diagnosis ask for it explicitly via
 * `composeBlueprintWithCoherence()`; nothing else pays.
 */
export type ComposeBlueprintWithCoherenceResult = ComposeBlueprintResult & {
  coherence: CoherenceReport
}

export async function composeBlueprint(ids: BlueprintIdentifiers): Promise<ComposeBlueprintResult> {
  // The one canonical Core<->legacy resolution call (Sprint 12H) — Blueprint
  // remains a consumer, never an identity resolver: this is a pure, read-only
  // lookup (never creates a bridge), and every legacy-space composer below
  // still independently handles a null result by degrading explicitly,
  // exactly as before. No composer re-implements this lookup.
  const legacyStudentId = await resolveLegacyStudentId(ids.coreLearnerId)

  const [identity, attendance, learningCompass, career, portfolio, achievement, teacherReflection, projectionAccess] = await Promise.all([
    composeIdentity(ids),
    composeAttendance(ids.actorUserId, ids.schoolId, ids.coreLearnerId),
    composeLearningCompass(legacyStudentId),
    composeCareer(legacyStudentId),
    composePortfolio(ids.coreLearnerId, ids.schoolId),
    composeAchievement(ids.coreLearnerId, ids.schoolId),
    composeTeacherReflection(ids.coreLearnerId, ids.schoolId),
    loadProjectionAccess(legacyStudentId),
  ])

  const [academicRecord, growthTimeline, risk] = await Promise.all([
    composeAcademicRecord(legacyStudentId, projectionAccess),
    composeGrowthTimeline(legacyStudentId, projectionAccess),
    composeRisk(legacyStudentId, projectionAccess),
  ])

  const parentSummary = composeParentSummary(identity.data?.learnerName ?? null, academicRecord, attendance)
  const learningStory = composeLearningStory({
    identity,
    academicRecord,
    learningCompass,
    career,
    growthTimeline,
    risk,
    capability: projectionAccess.projection?.capability
      ? {
          value: projectionAccess.projection.capability.value,
          confidence: projectionAccess.projection.capability.confidence,
          coverage: projectionAccess.projection.capability.coverage,
        }
      : null,
    completeness: projectionAccess.projection?.completeness
      ? {
          value: projectionAccess.projection.completeness.value,
          confidence: projectionAccess.projection.completeness.confidence,
          coverage: projectionAccess.projection.completeness.coverage,
        }
      : null,
  })
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
    teacherReflection,
    parentSummary,
    growthTimeline,
    risk,
    learningStory,
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

/**
 * `composeBlueprint()` plus the Coherence Engine's diagnosis — the opt-in
 * path for the two callers that actually enforce on the report. Never call
 * this just to render a Blueprint.
 */
export async function composeBlueprintWithCoherence(
  ids: BlueprintIdentifiers
): Promise<ComposeBlueprintWithCoherenceResult> {
  const { blueprint, validation } = await composeBlueprint(ids)
  const coherence = await composeBlueprintCoherence(ids.coreLearnerId, ids.schoolId, blueprint)

  return { blueprint, validation, coherence }
}
