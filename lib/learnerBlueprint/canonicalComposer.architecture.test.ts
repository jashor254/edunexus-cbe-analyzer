// lib/learnerBlueprint/canonicalComposer.architecture.test.ts
//
// Sprint 12AB regression test — proves the Guardian Audit's Critical
// finding (two independently-computed Blueprint engines reachable from
// live routes) cannot silently reappear. Walks the real source tree (no
// mocks, no DB) and asserts:
//
//   1. The legacy composer (lib/learnerIntelligence/blueprint.ts) is
//      imported ONLY by its own module and the two named, offline,
//      non-route diagnostic/demo scripts kept alive on purpose (see
//      docs/architecture/sprint-12ab-blueprint-canonicalization.md).
//   2. No app/**/page.tsx or app/api/**/route.ts file imports it — i.e.
//      no live route can reach the legacy composer, directly or via a
//      component.
//   3. composeBlueprint() itself is still defined exactly once.
//
// Run: npx tsx --test lib/learnerBlueprint/canonicalComposer.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const ALL_SOURCE_FILES = walk(ROOT)

// Files explicitly authorized to still call the legacy composer — offline
// tooling with zero live route/component reachability, documented in the
// Sprint 12AB migration decision table. Any new entry here must be a
// deliberate, reviewed decision, not a silent accretion.
const LEGACY_COMPOSER_WHITELIST = new Set([
  path.join(ROOT, 'lib/learnerIntelligence/blueprint.ts'),
  path.join(ROOT, 'scripts/generate-learner-blueprints.ts'),
  path.join(ROOT, 'scripts/trace-consistency-audit.ts'),
])

const LEGACY_IMPORT_PATTERN = /from\s+['"](@\/lib\/learnerIntelligence\/blueprint|\.\.?\/.*learnerIntelligence\/blueprint)['"]|import\(['"](\.\.\/lib\/learnerIntelligence\/blueprint)['"]\)/

test('legacy Blueprint composer has no importers outside the documented whitelist', () => {
  const offenders: string[] = []
  for (const file of ALL_SOURCE_FILES) {
    if (LEGACY_COMPOSER_WHITELIST.has(file)) continue
    const content = readFileSync(file, 'utf8')
    if (LEGACY_IMPORT_PATTERN.test(content)) offenders.push(path.relative(ROOT, file))
  }
  assert.deepEqual(offenders, [], `Unexpected importers of the legacy Blueprint composer: ${offenders.join(', ')}`)
})

test('no live route (app/**/page.tsx, app/**/route.ts) imports the legacy Blueprint composer', () => {
  const routeFiles = ALL_SOURCE_FILES.filter(f => {
    const rel = path.relative(ROOT, f)
    return rel.startsWith('app' + path.sep) && (rel.endsWith('page.tsx') || rel.endsWith('route.ts'))
  })
  const offenders = routeFiles.filter(f => LEGACY_IMPORT_PATTERN.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('composeBlueprint is defined exactly once in the whole repository', () => {
  const definitionPattern = /export\s+(async\s+)?function\s+composeBlueprint\s*\(/
  const definers = ALL_SOURCE_FILES.filter(f => definitionPattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(
    definers.map(f => path.relative(ROOT, f)),
    ['lib/learnerBlueprint/composeBlueprint.ts'],
  )
})

test('the two former legacy-consumer routes now redirect into the canonical route instead of composing anything themselves', () => {
  const migratedPages = [
    path.join(ROOT, 'app/teacher/reports/blueprint/[studentId]/page.tsx'),
    path.join(ROOT, 'app/student/blueprint/page.tsx'), // moved from app/(student)/blueprint (Sprint 3, Blocker #5)
  ]
  for (const file of migratedPages) {
    const content = readFileSync(file, 'utf8')
    assert.match(content, /redirect\(`\/student\/blueprint\//, `${path.relative(ROOT, file)} should redirect into the canonical Blueprint route`)
    assert.doesNotMatch(content, /composeBlueprint\(\{/, `${path.relative(ROOT, file)} should not compose Blueprint itself`)
  }
})

test('the canonical Blueprint PDF route stays on the live route/view path and never imports the legacy PDF generator', () => {
  const route = path.join(ROOT, 'app/api/student/blueprint/[learnerId]/pdf/route.ts')
  const helper = path.join(ROOT, 'lib/learnerBlueprint/pdfExport.ts')

  const routeContent = readFileSync(route, 'utf8')
  const helperContent = readFileSync(helper, 'utf8')
  const canonicalRouteMatcher = /new URL\(\s*['"`]\/student\/blueprint\/\$\{learnerId\}['"`]\s*,\s*origin\s*\)/
  const pdfModeMatcher = /searchParams\.set\(\s*BLUEPRINT_EXPORT_QUERY_KEY\s*,\s*BLUEPRINT_EXPORT_QUERY_VALUE\s*\)/
  const legacyPdfMatcher = /lib\/learnerIntelligence\/pdfGenerator\.tsx|generateLearnerBlueprintPDF|buildLearnerBlueprint/

  assert.match(routeContent, /renderBlueprintPdf/, 'the PDF route should delegate browser rendering to the canonical export helper')
  assert.doesNotMatch(routeContent, legacyPdfMatcher, 'the PDF route must not call or import the legacy learnerIntelligence PDF stack')
  assert.match(helperContent, canonicalRouteMatcher, 'the export helper should target the canonical live Blueprint route')
  assert.match(helperContent, pdfModeMatcher, 'the export helper should force PDF mode through the export query parameter')
  assert.doesNotMatch(helperContent, legacyPdfMatcher, 'the export helper must not import or reference the legacy learnerIntelligence PDF stack')
})

// Career Intelligence Canonicalization / Blueprint premium redesign sprint —
// the redesign was explicitly instructed never to restore the legacy
// Academic Clinic computation pipeline (lib/academicClinic/*) or read the
// legacy `assessments` table directly, even though its PDF was used as a
// visual reference. These tests prove the whole Blueprint PDF surface
// (view, export helper, route) stays clean of that pipeline.
test('the Blueprint PDF surface (view, export helper, route) never imports the legacy Academic Clinic pipeline', () => {
  const files = [
    path.join(ROOT, 'components/blueprint/BlueprintView.tsx'),
    path.join(ROOT, 'lib/learnerBlueprint/pdfExport.ts'),
    path.join(ROOT, 'app/api/student/blueprint/[learnerId]/pdf/route.ts'),
    path.join(ROOT, 'app/student/blueprint/[learnerId]/page.tsx'),
  ]
  // Matches only a real import/require path (quoted), never a prose mention
  // of "lib/academicClinic" in a comment — several of these files already
  // carry an honest "we don't import this" comment that would otherwise
  // false-positive against a naive substring match.
  const academicClinicMatcher = /from\s+['"][^'"]*academicClinic[^'"]*['"]|require\(\s*['"][^'"]*academicClinic[^'"]*['"]\s*\)/

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    assert.doesNotMatch(content, academicClinicMatcher, `${path.relative(ROOT, file)} must not import lib/academicClinic`)
  }
})

test('BlueprintView is presentation-only — it never calls composeBlueprint itself, only the live page composes once', () => {
  const viewContent = readFileSync(path.join(ROOT, 'components/blueprint/BlueprintView.tsx'), 'utf8')
  assert.doesNotMatch(viewContent, /composeBlueprint\(/, 'BlueprintView must receive an already-composed blueprint as a prop, never compose its own')

  const pageContent = readFileSync(path.join(ROOT, 'app/student/blueprint/[learnerId]/page.tsx'), 'utf8')
  const composeCalls = pageContent.match(/composeBlueprint\(\{/g) ?? []
  assert.equal(composeCalls.length, 1, 'the live Blueprint page must call composeBlueprint() exactly once per render — no duplicate composition tree')
})
