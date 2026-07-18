// lib/learnerInnovation/innovationBoundary.architecture.test.ts
//
// Sprint 13I regression test — proves, by walking the real source tree
// (no mocks), the mission's explicit Phase 9 requirement: Innovation
// never computes Achievements/Portfolio/Projects/Competitions/Career/
// Blueprint/Parent actions, only exposes references, and never duplicates
// ownership. Mirrors the discipline already proven for Competitions/
// Leadership/Wellbeing.
//
// Run: npx tsx --test lib/learnerInnovation/innovationBoundary.architecture.test.ts

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

function filesUnder(relDir: string): string[] {
  const dir = path.join(ROOT, relDir)
  try {
    statSync(dir)
  } catch {
    return []
  }
  return walk(dir)
}

test('lib/learnerInnovation/ itself imports nothing from Blueprint, Portfolio, Achievement, Projects, Career, Parent Experience, or Learning Compass', () => {
  const forbiddenImportPattern = /from ['"]@\/lib\/(learnerBlueprint|learnerPortfolio|learnerAchievement|learnerProjects|career|parentExperience|compass)/

  const files = filesUnder('lib/learnerInnovation').filter(f => !f.endsWith('.test.ts'))
  const offenders = files.filter(f => forbiddenImportPattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('no file under lib/learnerBlueprint/ (other than composeInnovation.ts and its wiring) references Innovation beyond the sanctioned summary composer', () => {
  const allowed = new Set([
    path.join(ROOT, 'lib/learnerBlueprint/composeInnovation.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/composeBlueprint.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/types.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/validation.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/composeBlueprint.pure.test.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/canonicalComposer.architecture.test.ts'),
  ])
  const offenders = filesUnder('lib/learnerBlueprint')
    .filter(f => !allowed.has(f))
    .filter(f => /learnerInnovation|repos\.innovations|InnovationRepository/i.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('composeInnovation() reads only getInnovationsSummary — never the repository or raw tables directly', () => {
  const content = readFileSync(path.join(ROOT, 'lib/learnerBlueprint/composeInnovation.ts'), 'utf8')
  assert.doesNotMatch(content, /repos\.innovations|from ['"]@\/lib\/repositories\/innovation\.repository['"]/)
  assert.match(content, /getInnovationsSummary/)
})

test('no file anywhere outside lib/learnerInnovation/ imports repos.innovations or the InnovationRepository, except its own registration in repositories/index.ts and the sanctioned Blueprint composer', () => {
  const allowed = new Set([
    path.join(ROOT, 'lib/repositories/innovation.repository.ts'),
    path.join(ROOT, 'lib/repositories/index.ts'),
    path.join(ROOT, 'lib/learnerBlueprint/composeInnovation.ts'), // false-positive guard only; the prior test proves this file never actually references repos.innovations
  ])
  const allSourceFiles = walk(ROOT)
  const offenders = allSourceFiles.filter(f => {
    const rel = path.relative(ROOT, f)
    if (rel.startsWith('lib/learnerInnovation' + path.sep)) return false
    if (allowed.has(f)) return false
    return /repos\.innovations|InnovationRepository/.test(readFileSync(f, 'utf8'))
  })
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('Innovation never computes Achievement/Portfolio/Projects/Competitions summaries itself — only stores reference id columns (project_id, competition_id), never their own fields', () => {
  const repoContent = readFileSync(path.join(ROOT, 'lib/repositories/innovation.repository.ts'), 'utf8')
  // Confirms the repository only ever names the two sanctioned reference
  // columns, never a field belonging to Achievement/Portfolio's own shape
  // (title/category/publishedAt of a *different* domain's row).
  assert.match(repoContent, /project_id/)
  assert.match(repoContent, /competition_id/)
  assert.doesNotMatch(repoContent, /achievement_type|portfolio_id|leadership_id/i)
})
