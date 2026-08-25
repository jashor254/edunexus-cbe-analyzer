// lib/school/riskConsumerConvergence.architecture.test.ts
//
// PHASE 3.5 — Risk Consumer Convergence (architecture guard).
//
// Before this phase, Monday Panel's risk_level came from the canonical
// Projection Engine while its flag/detail text came from the legacy
// learner_profiles.risk_flags, and School Intelligence's
// computeTeacherActivity() sourced its at_risk_students count from
// learner_profiles.overall_risk_level while its sibling
// computeSchoolIntelligence() (feeding the SAME Principal Dashboard) used
// Projection — two widgets on one dashboard describing risk from two
// different authorities. Both are now redirected to Projection.
//
// This test proves the redirect holds, tree-wide, so a future edit cannot
// silently reintroduce a direct legacy risk-level read in either consumer.
// It deliberately does NOT assert anything about the legacy risk system
// itself (learner_profiles.risk_flags/.overall_risk_level) — that system
// remains a live, legitimate source for other fields this phase did not
// migrate (risk_history/consecutive_weeks duration, atRiskResolved,
// avg_capability_dimensions) per the Phase 3.5 closeout's residual legacy
// inventory. This test only guards the two specific reads this phase
// closed.
//
// Run: npx tsx --test lib/school/riskConsumerConvergence.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function read(relPath: string): string {
  return stripComments(readFileSync(path.join(ROOT, relPath), 'utf8'))
}

test('Monday Panel does not read profile.risk_flags for top_flags/action — only Projection risk flags', () => {
  const src = read('app/api/teacher/monday-panel/route.ts')
  assert.doesNotMatch(
    src,
    /profile\.risk_flags/,
    'app/api/teacher/monday-panel/route.ts reads profile.risk_flags directly again — this reintroduces the mixed-authority bug Phase 3 found (risk_level from Projection, flag text from the legacy system)'
  )
  assert.match(
    src,
    /projections\.get\(profile\.student_id\)\?\.risk\?\.value\.flags/,
    'Monday Panel must source top_flags from the same Projection object that determined risk_level'
  )
})

test('buildAction() is a pure, DB-free formatter that takes a Projection RiskFlag shape, not the legacy taxonomy', () => {
  const src = read('app/api/teacher/monday-panel/buildAction.ts')
  assert.doesNotMatch(src, /RiskFlagType|missing_prerequisite|disengaged|multiple_weak_substrands/, 'buildAction() must not reintroduce the legacy RiskFlagType-keyed switch statement')
  assert.doesNotMatch(src, /from ['"]@\/lib\/repositories['"]/, 'buildAction.ts must stay import-free of the repos singleton — it is deliberately DB-free so its own tests never need Supabase credentials')
})

test('computeTeacherActivity() sources at_risk_students from Projection, not learner_profiles.overall_risk_level', () => {
  const src = read('lib/school/intelligence.ts')
  const fnMatch = src.match(/export async function computeTeacherActivity[\s\S]*?\n}\n/)
  assert.ok(fnMatch, 'computeTeacherActivity() not found in lib/school/intelligence.ts')
  assert.doesNotMatch(
    fnMatch![0],
    /p\.overall_risk_level/,
    'computeTeacherActivity() reads p.overall_risk_level (the legacy system) directly again — this reintroduces the mixed-authority gap Phase 3 found (computeSchoolIntelligence() uses Projection, computeTeacherActivity() used legacy, for the same Principal Dashboard)'
  )
  assert.match(
    fnMatch![0],
    /recomputeLearnerProjection/,
    'computeTeacherActivity() must resolve risk via the canonical Projection Engine, the same source computeSchoolIntelligence() already uses'
  )
})

test('StudentIntelligenceSummary.top_flags is typed against Projection\'s RiskFlag, not the legacy one', () => {
  const src = read('lib/learnerModel/types.ts')
  assert.match(
    src,
    /import type \{ RiskFlag as ProjectionRiskFlag \} from ['"]@\/lib\/projection\/types['"]/,
    'lib/learnerModel/types.ts no longer imports Projection\'s RiskFlag — top_flags may have been silently reverted to the legacy shape'
  )
  assert.match(src, /top_flags:\s*ProjectionRiskFlag\[\]/)
})
