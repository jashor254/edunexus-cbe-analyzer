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
