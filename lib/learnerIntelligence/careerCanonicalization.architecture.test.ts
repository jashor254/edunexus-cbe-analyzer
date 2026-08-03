// lib/learnerIntelligence/careerCanonicalization.architecture.test.ts
//
// Career Contradiction Closure Sprint (2026-08-03) — proves the deprecated,
// AI-generated, persisted-table Career-matching path is fully gone and
// cannot silently come back. Before this sprint, `getMatchesForStudent()`
// (lib/career/careerEngine.ts) read a persisted `career_matches` table
// populated by an AI call (lib/career/matchEngine.ts's
// `generateCareerMatches()`) that could disagree with the deterministic,
// evidence-first `computeCapabilityMatches()` engine every other Career
// surface (Learner Progress Report, Career Explorer, Parent Career
// Intelligence, Holiday Planner) already used — three live routes
// (app/api/career/match, app/api/career/[slug], lib/career/
// clinicReportBuilder.ts) still called it, including one reachable from a
// real parent-facing page. All three now call
// `resolveCanonicalCareerMatches()`/`computeCapabilityMatches()` instead.
//
// Walks the real source tree (no mocks, no DB) — the same method
// lib/learnerWellbeing/wellbeingBoundary.architecture.test.ts already
// established for "prove an absence, tree-wide" — rather than a fixed file
// list, so a reintroduction anywhere (not just the 3 known former call
// sites) is caught.
//
// Run: npx tsx --test lib/learnerIntelligence/careerCanonicalization.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', '_frozen'])

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

const ALL_FILES = walk(ROOT)
// Exclude this file's own header/comments (which name the deprecated
// functions in prose) and any other architecture-doc-shaped comment from
// tripping the "no definition/no import" checks below.
const NON_SELF_FILES = ALL_FILES.filter(f => f !== __filename)

function fileContents(files: string[]): Map<string, string> {
  return new Map(files.map(f => [f, readFileSync(f, 'utf8')]))
}

const CONTENTS = fileContents(NON_SELF_FILES)

// Strips `//` line comments and block comments so a name mentioned only in
// prose (e.g. this test's own doc comments in other files) never counts as
// a real definition/import.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

test('getMatchesForStudent no longer exists anywhere in the source tree', () => {
  const pattern = /\bgetMatchesForStudent\b/
  const hits = [...CONTENTS.entries()].filter(([, src]) => pattern.test(stripComments(src))).map(([f]) => path.relative(ROOT, f))
  assert.deepEqual(hits, [], `getMatchesForStudent() must be fully deleted — found live references in: ${hits.join(', ')}`)
})

test('generateParentSummary no longer exists anywhere in the source tree', () => {
  const pattern = /\bgenerateParentSummary\b/
  const hits = [...CONTENTS.entries()].filter(([, src]) => pattern.test(stripComments(src))).map(([f]) => path.relative(ROOT, f))
  assert.deepEqual(hits, [], `generateParentSummary() must be fully deleted — found live references in: ${hits.join(', ')}`)
})

test('generateCareerMatches / lib/career/matchEngine.ts no longer exists', () => {
  const matchEnginePath = path.join(ROOT, 'lib/career/matchEngine.ts')
  assert.throws(() => statSync(matchEnginePath), 'lib/career/matchEngine.ts must be deleted, not just unreferenced')

  const pattern = /\bgenerateCareerMatches\b/
  const hits = [...CONTENTS.entries()].filter(([, src]) => pattern.test(stripComments(src))).map(([f]) => path.relative(ROOT, f))
  assert.deepEqual(hits, [], `generateCareerMatches() must be fully deleted — found live references in: ${hits.join(', ')}`)
})

test('saveCareerMatches no longer exists anywhere in the source tree', () => {
  const pattern = /\bsaveCareerMatches\b/
  const hits = [...CONTENTS.entries()].filter(([, src]) => pattern.test(stripComments(src))).map(([f]) => path.relative(ROOT, f))
  assert.deepEqual(hits, [], `saveCareerMatches() must be fully deleted — found live references in: ${hits.join(', ')}`)
})

test('the three former deprecated-path consumers now import the canonical Career service', () => {
  const migratedFiles = [
    path.join(ROOT, 'app/api/career/match/route.ts'),
    path.join(ROOT, 'app/api/career/[slug]/route.ts'),
    path.join(ROOT, 'lib/career/clinicReportBuilder.ts'),
  ]
  const canonicalImportPattern = /from ['"]@\/lib\/(learnerIntelligence\/careerIntelligence|career\/capabilityMatchEngine)['"]/

  for (const file of migratedFiles) {
    const src = CONTENTS.get(file)
    assert.ok(src, `expected ${path.relative(ROOT, file)} to still exist`)
    assert.match(
      src!,
      canonicalImportPattern,
      `${path.relative(ROOT, file)} must import from the canonical Career service (lib/learnerIntelligence/careerIntelligence.ts or lib/career/capabilityMatchEngine.ts)`,
    )
  }
})

test('careerModeForGrade grade-mode logic is still defined exactly once', () => {
  const definitionPattern = /export\s+function\s+careerModeForGrade\s*\(/
  const definers = [...CONTENTS.entries()].filter(([, src]) => definitionPattern.test(src)).map(([f]) => f)
  assert.deepEqual(
    definers,
    [path.join(ROOT, 'lib/learnerIntelligence/careerIntelligence.ts')],
    'careerModeForGrade must be defined in exactly one place — the canonical Career Intelligence module',
  )
})

test('no second capability-to-career matching engine has been introduced', () => {
  // Deliberately narrow and named, not a broad "no function with 'match' in
  // its name" scan (that would false-positive on legitimate helpers like
  // `textMentionsSubject`). Catches the specific shape a reintroduced
  // duplicate engine would take: a new exported function computing a
  // 0-100/0-1 alignment score from subject or capability scores, outside
  // the one file that owns this today.
  const CANONICAL_ENGINE_FILE = path.join(ROOT, 'lib/career/capabilityMatchEngine.ts')
  const definitionPattern = /export\s+function\s+computeCapabilityMatches\s*\(/
  const definers = [...CONTENTS.entries()].filter(([, src]) => definitionPattern.test(src)).map(([f]) => f)
  assert.deepEqual(
    definers,
    [CANONICAL_ENGINE_FILE],
    'computeCapabilityMatches must be defined in exactly one place — a second definition anywhere is a second matching engine',
  )
})
