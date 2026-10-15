// lib/schoolEffectiveness/service.ts
//
// Domain service for the School Effectiveness Check (ADR-0034). Composes the
// pure model (mergeRatings + scoreSchoolEffectiveness) with persistence. The
// API layer authorizes (auth + school membership) before calling in; this
// service does the domain work and delegates all DB access to the repository.
//
// Auto-derived ratings are optional: a cold prospect supplies only self-report,
// and everything falls back to self-report (per mergeRatings). An onboarded
// school may pass auto-derived ratings once a calibrated derivation exists
// (deferred — see ADR-0034 / the implementation log); this service accepts
// them now so no rewrite is needed when it lands.

import { repos } from '@/lib/repositories'
import { scoreSchoolEffectiveness } from './scoring'
import { mergeRatings } from './merge'
import type { BenchmarkRating } from './types'
import type { SchoolEffectivenessCheckRow } from '@/lib/repositories/schoolEffectiveness.repository'

/** The current CBC-Gatsby benchmark set version (8 Gatsby-core + 3 beyond). */
export const CBC_GATSBY_FRAMEWORK_VERSION = 'cbc_gatsby_v1'

export type CreateCheckInput = {
  schoolId:   string
  /** The authenticated actor who ran the Check (for created_by). */
  createdBy:  string
  /** Self-report answers (benchmarkId + 0–4). */
  selfReport: readonly BenchmarkRating[]
  /** Optional auto-derived ratings (onboarded schools); omitted for a prospect. */
  auto?:      readonly BenchmarkRating[]
}

export async function createSchoolEffectivenessCheck(
  input: CreateCheckInput,
): Promise<SchoolEffectivenessCheckRow> {
  const ratings = mergeRatings(input.auto ?? [], input.selfReport)
  const profile = scoreSchoolEffectiveness(ratings)
  return repos.schoolEffectiveness.create({
    school_id:         input.schoolId,
    framework_version: CBC_GATSBY_FRAMEWORK_VERSION,
    ratings,
    profile,
    created_by:        input.createdBy,
  })
}

export async function getLatestSchoolEffectivenessCheck(
  schoolId: string,
): Promise<SchoolEffectivenessCheckRow | null> {
  return repos.schoolEffectiveness.findLatestForSchool(schoolId)
}
