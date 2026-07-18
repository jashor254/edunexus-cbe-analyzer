// lib/learnerWellbeing/wellbeingBoundary.architecture.test.ts
//
// Sprint 13G regression test — proves, by walking the real source tree
// (no mocks), the mission's explicit Phase 7/8/9 boundary requirements:
// Blueprint has zero dependency on Wellbeing, Parent Experience has zero
// dependency on Wellbeing, and Wellbeing has zero dependency on Blueprint,
// Parent Experience, or any behaviour/discipline concept (which does not
// exist in this codebase, verified here rather than assumed). Also proves
// no "Wellbeing Status"/"Support Needed"/"Risk Level" indicator exists
// anywhere in Blueprint's own type shape.
//
// Run: npx tsx --test lib/learnerWellbeing/wellbeingBoundary.architecture.test.ts

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

const WELLBEING_IMPORT_PATTERN = /learnerWellbeing|wellbeing\.repository|repos\.wellbeing/i

test('no file under lib/learnerBlueprint/ imports or references Wellbeing', () => {
  const offenders = filesUnder('lib/learnerBlueprint')
    .filter(f => WELLBEING_IMPORT_PATTERN.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('composeBlueprint\'s own LearnerBlueprint type has no wellbeing-shaped field, and no "Wellbeing Status"/"Support Needed"/"Risk Level" string exists anywhere in lib/learnerBlueprint/', () => {
  const typesFile = path.join(ROOT, 'lib/learnerBlueprint/types.ts')
  const content = readFileSync(typesFile, 'utf8')
  assert.doesNotMatch(content, /wellbeing/i)

  const forbiddenPhrases = ['Wellbeing Status', 'Support Needed', 'Risk Level']
  for (const file of filesUnder('lib/learnerBlueprint')) {
    const fileContent = readFileSync(file, 'utf8')
    for (const phrase of forbiddenPhrases) {
      assert.doesNotMatch(fileContent, new RegExp(phrase, 'i'), `${path.relative(ROOT, file)} must never mention "${phrase}"`)
    }
  }
})

test('no file under lib/parentExperience/ imports or references Wellbeing', () => {
  const offenders = filesUnder('lib/parentExperience')
    .filter(f => WELLBEING_IMPORT_PATTERN.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('no file anywhere outside lib/learnerWellbeing/ and its own migration/docs imports repos.wellbeing or the WellbeingRepository', () => {
  const allSourceFiles = walk(ROOT)
  const offenders = allSourceFiles.filter(f => {
    const rel = path.relative(ROOT, f)
    if (rel.startsWith('lib/learnerWellbeing' + path.sep)) return false
    if (rel === 'lib/repositories/wellbeing.repository.ts') return false
    if (rel === 'lib/repositories/index.ts') return false // registers, does not use, the repository
    return /repos\.wellbeing|WellbeingRepository/.test(readFileSync(f, 'utf8'))
  })
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('lib/learnerWellbeing/ itself imports nothing from Blueprint, Parent Experience, Teacher Reflection, Portfolio, Achievement, Projects, Competitions, or Leadership', () => {
  const forbiddenImportPattern = /from ['"]@\/lib\/(learnerBlueprint|parentExperience|teacherReflection|learnerPortfolio|learnerAchievement|learnerProjects|learnerCompetitions|learnerLeadership|career|compass)/

  const files = filesUnder('lib/learnerWellbeing').filter(f => !f.endsWith('.test.ts'))
  const offenders = files.filter(f => forbiddenImportPattern.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders.map(f => path.relative(ROOT, f)), [])
})

test('no behaviour/discipline module exists in the codebase for Wellbeing to accidentally couple to (ADR-0017 Phase 7 — verified, not assumed)', () => {
  const behaviourDirs = ['lib/learnerBehaviour', 'lib/behaviour', 'lib/discipline']
  for (const dir of behaviourDirs) {
    assert.deepEqual(filesUnder(dir), [], `${dir} should not exist — if it now does, ADR-0017's "no relationship, ever" boundary must be re-verified against it before this test is updated`)
  }
})

test('composeBlueprint.ts\'s own import list contains no learnerWellbeing entry', () => {
  const composeBlueprintFile = path.join(ROOT, 'lib/learnerBlueprint/composeBlueprint.ts')
  const content = readFileSync(composeBlueprintFile, 'utf8')
  assert.doesNotMatch(content, /wellbeing/i)
})
