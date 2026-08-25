// lib/career/capabilityConvergence.architecture.test.ts
//
// PHASE 5 — Career Intelligence Convergence (architecture guards).
//
// Guard A: the two Career routes that previously read the persisted,
// possibly-stale students.capability_profile snapshot directly
// (getCapabilityProfile) for their PRIMARY current-state answer must
// instead go through resolveCurrentCapabilityProfile/
// resolveFreshCapabilityProfile (canonical-first, legacy-only-on-absence)
// — the exact redirect this phase made. This does not forbid
// getCapabilityProfile as a function (it remains the legitimate fallback
// read INSIDE resolveCurrentCapabilityProfile, and POST /capability's
// write path still legitimately triggers recomputeAndSaveCapabilityProfile)
// — it forbids the two GET routes reintroducing a direct, unmediated read.
//
// Guard C: interest and capability must remain semantically distinct —
// capabilityMatchEngine.ts's actual match-scoring code must never
// reference "interest" as a scoring input (Phase 5 audit finding: interest
// is stored and displayed separately, never blended into capability
// scoring — this guard prevents a future edit from quietly merging them).
//
// Guard B (positive, not a forbidding guard): Career-specific
// interpretation (hidden strengths, growth barriers, career narrative)
// must still exist after convergence — Career must not become a dumb
// Projection renderer.
//
// Run: npx tsx --test lib/career/capabilityConvergence.architecture.test.ts

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

test('Guard A: GET /api/career/capability reads via the canonical-first resolver, not the raw persisted snapshot directly', () => {
  const src = read('app/api/career/capability/route.ts')
  assert.doesNotMatch(
    src,
    /import\s*\{[^}]*\bgetCapabilityProfile\b[^}]*\}\s*from\s*['"]@\/lib\/career\/careerEngine['"]/,
    'app/api/career/capability/route.ts imports getCapabilityProfile from careerEngine.ts directly again — this reintroduces the exact stale-snapshot-vs-live-Projection contradiction Phase 3 found and Phase 5 fixed'
  )
  assert.match(src, /resolveCurrentCapabilityProfile/, 'GET must resolve the current profile via the canonical-first resolver')
})

test('Guard A: GET /api/career/growth reads "current" via the canonical-first resolver, not the raw persisted snapshot directly', () => {
  const src = read('app/api/career/growth/route.ts')
  assert.doesNotMatch(
    src,
    /import\s*\{[^}]*\bgetCapabilityProfile\b[^}]*\}\s*from\s*['"]@\/lib\/career\/careerEngine['"]/,
    'app/api/career/growth/route.ts imports getCapabilityProfile from careerEngine.ts directly again'
  )
  assert.match(src, /resolveCurrentCapabilityProfile/)
})

test('Guard A (positive): resolveCurrentCapabilityProfile itself is built on resolveFreshCapabilityProfile first, getCapabilityProfile only as fallback', () => {
  const src = read('lib/learnerIntelligence/careerIntelligenceOrchestration.ts')
  const fnMatch = src.match(/export async function resolveCurrentCapabilityProfile[\s\S]*?\n}\n/)
  assert.ok(fnMatch, 'resolveCurrentCapabilityProfile not found')
  const body = fnMatch![0]
  const freshIndex = body.indexOf('resolveFreshCapabilityProfile')
  const legacyIndex = body.indexOf('getCapabilityProfile(studentId)')
  assert.ok(freshIndex !== -1 && legacyIndex !== -1)
  assert.ok(freshIndex < legacyIndex, 'canonical Projection must be tried before the legacy persisted fallback, never the reverse')
})

test('Guard C: capability match scoring never treats "interest" as a scoring input — interest and capability stay semantically distinct', () => {
  const src = read('lib/career/capabilityMatchEngine.ts')
  assert.doesNotMatch(
    src,
    /interest/i,
    'capabilityMatchEngine.ts now references "interest" — Phase 5 found interest (student_career_interests, learner-entered) and capability (marks-derived CapabilityProfile) are deliberately never blended; a career match score must never be influenced by stated interest'
  )
})

test('Guard B (positive): Career-specific interpretation (hidden strengths / growth barriers / career narrative) still exists — Career has not become a dumb Projection renderer', () => {
  const src = read('lib/career/careerIntelligenceEngine.ts')
  assert.match(src, /buildHiddenStrengths/)
  assert.match(src, /buildGrowthBarriers/)
})

test('Career → Blueprint still reads only the canonical path (getCareerBlueprintSummary -> buildCareerIntelligence -> resolveFreshCapabilityProfile), never the persisted blend', () => {
  const src = read('lib/learnerBlueprint/composeCareer.ts')
  assert.doesNotMatch(src, /getCapabilityProfile\b/, 'Blueprint\'s Career section must never read the persisted capability_profile snapshot directly')
  assert.doesNotMatch(src, /recomputeAndSaveCapabilityProfile/)
})
