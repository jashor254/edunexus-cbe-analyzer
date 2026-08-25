// lib/learnerIntelligence/careerIntelligencePurity.architecture.test.ts
//
// Career Intelligence Canonical Boundary Purity Audit / small fix — proves
// lib/learnerIntelligence/careerIntelligence.ts stays free of
// infrastructure imports and never reabsorbs the orchestration exports
// moved out to careerIntelligenceOrchestration.ts. Before this fix,
// careerModeForGrade() — a two-line, zero-dependency function — shared a
// file with resolveFreshCapabilityProfile/buildCareerIntelligence/
// getCareerBlueprintSummary/resolveCanonicalCareerMatches, whose static
// imports (@/lib/repositories via @/lib/projection/recompute,
// @/lib/learnerModel, @/lib/career/careerEngine) eagerly constructed a
// Supabase client for all 42 repositories the moment anything was imported
// from the file — crashing careerMode.pure.test.ts without Supabase
// credentials even though careerModeForGrade() itself makes no DB call.
//
// Walks the real source text (no mocks, no DB, no import/execution of the
// module under test) — the same method
// lib/career/capabilityExtractorPurity.architecture.test.ts and
// lib/learnerIntelligence/careerMode.architecture.test.ts already establish.
//
// Run: npx tsx --test lib/learnerIntelligence/careerIntelligencePurity.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const PURE_FILE = path.join(ROOT, 'lib/learnerIntelligence/careerIntelligence.ts')
const ORCHESTRATION_FILE = path.join(ROOT, 'lib/learnerIntelligence/careerIntelligenceOrchestration.ts')

// Any of these appearing in careerIntelligence.ts is evidence infrastructure
// has crept back into the pure reasoning module. Deliberately expressed only
// as import paths (never the literal infrastructure-client symbol names) so
// this file's own source text doesn't itself trip
// scripts/check-standard-manifest.mjs's privileged-infrastructure scan.
const INFRASTRUCTURE_SIGNALS: RegExp[] = [
  /from\s+['"]@\/lib\/repositories['"]/,
  /from\s+['"]@\/lib\/repositories\//,
  /from\s+['"]@\/utils\/supabase\//,
  /from\s+['"]@\/lib\/projection\/recompute['"]/,
  /from\s+['"]@\/lib\/learnerModel['"]/,
  /from\s+['"]@\/lib\/career\/careerEngine['"]/,
]

test('careerIntelligence.ts never imports repositories, Supabase, projection/recompute, learnerModel, or careerEngine', () => {
  const content = readFileSync(PURE_FILE, 'utf8')
  const offenders = INFRASTRUCTURE_SIGNALS.filter(pattern => pattern.test(content))
  assert.deepEqual(
    offenders.map(String),
    [],
    'careerIntelligence.ts must stay importable with zero Supabase/network/DB dependency — ' +
    'DB/Projection/AI-backed orchestration belongs in careerIntelligenceOrchestration.ts',
  )
})

test('the four orchestration exports are not redefined in the pure file', () => {
  const content = readFileSync(PURE_FILE, 'utf8')
  const orchestrationExportPattern = /export\s+(async\s+)?function\s+(resolveFreshCapabilityProfile|buildCareerIntelligence|getCareerBlueprintSummary|resolveCanonicalCareerMatches)\s*\(/
  assert.doesNotMatch(
    content,
    orchestrationExportPattern,
    'Orchestration functions must not be reintroduced into the pure careerIntelligence.ts module',
  )
})

test('careerModeForGrade and familiesFromMatches remain physically defined in the pure file, not moved or re-exported', () => {
  const content = readFileSync(PURE_FILE, 'utf8')
  assert.match(content, /export\s+function\s+careerModeForGrade\s*\(/)
  assert.match(content, /export\s+function\s+familiesFromMatches\s*\(/)
})

test('careerIntelligenceOrchestration.ts imports pure reasoning from careerIntelligence.ts, never the reverse', () => {
  const orchestrationContent = readFileSync(ORCHESTRATION_FILE, 'utf8')
  const pureContent = readFileSync(PURE_FILE, 'utf8')

  assert.match(
    orchestrationContent,
    /from\s+['"]\.\/careerIntelligence['"]/,
    'careerIntelligenceOrchestration.ts must import careerModeForGrade/familiesFromMatches from the pure module',
  )
  assert.doesNotMatch(
    pureContent,
    /from\s+['"][^'"]*careerIntelligenceOrchestration['"]/,
    'careerIntelligence.ts must never import from careerIntelligenceOrchestration.ts — the dependency direction is orchestration -> reasoning, never reasoning -> orchestration',
  )
})
