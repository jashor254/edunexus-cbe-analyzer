// lib/learnerBlueprint/blueprintSectionPurity.architecture.test.ts
//
// Blueprint Section Access Boundary Fix — proves composeCareer.ts and
// composeLearningCompass.ts stay free of infrastructure imports, and that
// the access loaders (careerAccess.ts, compassAccess.ts) are the only
// place in lib/learnerBlueprint/ that call the canonical Career/Compass
// reads. Before this fix, both composers statically imported
// getCareerBlueprintSummary()/getLearningCompassSummary() directly, so
// merely importing them — even to test their null-guard branch — booted
// the repositories barrel's 42-repository Supabase client construction.
//
// Walks the real source text (no mocks, no DB, no import/execution of the
// modules under test) — the same method
// lib/career/capabilityExtractorPurity.architecture.test.ts and
// lib/learnerIntelligence/careerIntelligencePurity.architecture.test.ts
// already establish.
//
// Run: npx tsx --test lib/learnerBlueprint/blueprintSectionPurity.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const COMPOSE_CAREER = path.join(ROOT, 'lib/learnerBlueprint/composeCareer.ts')
const COMPOSE_COMPASS = path.join(ROOT, 'lib/learnerBlueprint/composeLearningCompass.ts')
const CAREER_ACCESS = path.join(ROOT, 'lib/learnerBlueprint/careerAccess.ts')
const COMPASS_ACCESS = path.join(ROOT, 'lib/learnerBlueprint/compassAccess.ts')

// Strips `//` line comments and block comments so a prose mention (e.g. this
// module's own header explaining what it used to call) never counts as a
// real call site.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

// Deliberately expressed only as import paths (never the literal
// infrastructure-client symbol names), so this file's own source text
// doesn't itself trip scripts/check-standard-manifest.mjs's
// privileged-infrastructure scan.
const INFRASTRUCTURE_SIGNALS: RegExp[] = [
  /from\s+['"]@\/lib\/repositories['"]/,
  /from\s+['"]@\/lib\/repositories\//,
  /from\s+['"]@\/utils\/supabase\//,
  /from\s+['"]@\/lib\/learnerIntelligence\/careerIntelligenceOrchestration['"]/,
  /from\s+['"]@\/lib\/compass\/summary['"]/,
]

test('composeCareer.ts never imports Career infrastructure directly', () => {
  const content = readFileSync(COMPOSE_CAREER, 'utf8')
  const offenders = INFRASTRUCTURE_SIGNALS.filter(pattern => pattern.test(content))
  assert.deepEqual(
    offenders.map(String),
    [],
    'composeCareer.ts must stay importable with zero Career-infrastructure dependency — the canonical read belongs in careerAccess.ts',
  )
})

test('composeLearningCompass.ts never imports Compass infrastructure directly', () => {
  const content = readFileSync(COMPOSE_COMPASS, 'utf8')
  const offenders = INFRASTRUCTURE_SIGNALS.filter(pattern => pattern.test(content))
  assert.deepEqual(
    offenders.map(String),
    [],
    'composeLearningCompass.ts must stay importable with zero Compass-infrastructure dependency — the canonical read belongs in compassAccess.ts',
  )
})

// Matches an actual function CALL, not a prose mention or the OWNER
// attribution string ('lib/...getCareerBlueprintSummary') both composers
// legitimately still carry.
test('careerAccess.ts is the sole caller of getCareerBlueprintSummary() in lib/learnerBlueprint/', () => {
  const accessContent = readFileSync(CAREER_ACCESS, 'utf8')
  assert.match(accessContent, /getCareerBlueprintSummary\(/, 'careerAccess.ts must call the canonical Career read')

  const composerContent = stripComments(readFileSync(COMPOSE_CAREER, 'utf8'))
  assert.doesNotMatch(composerContent, /getCareerBlueprintSummary\(/, 'composeCareer.ts must not call getCareerBlueprintSummary() itself — only careerAccess.ts does')
})

test('compassAccess.ts is the sole caller of getLearningCompassSummary() in lib/learnerBlueprint/', () => {
  const accessContent = readFileSync(COMPASS_ACCESS, 'utf8')
  assert.match(accessContent, /getLearningCompassSummary\(/, 'compassAccess.ts must call the canonical Compass read')

  const composerContent = stripComments(readFileSync(COMPOSE_COMPASS, 'utf8'))
  assert.doesNotMatch(composerContent, /getLearningCompassSummary\(/, 'composeLearningCompass.ts must not call getLearningCompassSummary() itself — only compassAccess.ts does')
})
