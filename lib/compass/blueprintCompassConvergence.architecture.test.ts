// lib/compass/blueprintCompassConvergence.architecture.test.ts
//
// PHASE 4 — Blueprint/Compass Intelligence Convergence (architecture guards).
//
// This phase deliberately wired Compass's persistent-intelligence context
// to the canonical Projection Engine only — never Career Intelligence's
// separately-fragmented capability blend (Phase 3 audit), and never
// Blueprint's own composed output (traced this phase and found to add no
// safe, non-redundant, non-audience-tainted field beyond Projection
// itself — see the Phase 4 closeout). These guards prove that boundary
// holds, tree-wide, so a future edit cannot silently reintroduce either.
//
// Run: npx tsx --test lib/compass/blueprintCompassConvergence.architecture.test.ts

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
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

// Every Compass module this phase could plausibly touch — the entire
// lib/compass/ directory plus the /learn API routes. Walked, not
// hardcoded to the two files this phase actually edited, so a NEW Compass
// file importing Career/Blueprint is caught too.
const COMPASS_DIRS = [path.join(ROOT, 'lib/compass'), path.join(ROOT, 'app/api/learn')]
const COMPASS_FILES = COMPASS_DIRS.flatMap(d => walk(d))

const CAREER_MODULE_PATTERNS = [
  /@\/lib\/career\/capabilityExtractor/,
  /@\/lib\/career\/careerEngine/,
  /@\/lib\/career\/recomputeCapabilityProfile/,
  /@\/lib\/learnerIntelligence\/careerIntelligenceOrchestration/,
  /@\/lib\/learnerIntelligence\/canonicalCapability/, // the Career-adjacent Monday Panel/Attention Feed adapter — a DIFFERENT consumer's shim, not for Compass
  /@\/lib\/academicClinic\//,
]

const BLUEPRINT_MODULE_PATTERNS = [
  /@\/lib\/learnerBlueprint\//,
  /composeBlueprint/,
]

test('Guard B: no Compass module imports Career Intelligence\'s capability blend or the legacy Academic Clinic pipeline', () => {
  for (const file of COMPASS_FILES) {
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const pattern of CAREER_MODULE_PATTERNS) {
      assert.doesNotMatch(
        src,
        pattern,
        `${path.relative(ROOT, file)} imports a Career Intelligence / Academic Clinic module (${pattern}) — Phase 4 deliberately excluded Career's separately-fragmented capability blend from Compass; this must wait for its own convergence phase`
      )
    }
  }
})

test('Guard A: no Compass module imports Blueprint\'s composer output directly', () => {
  for (const file of COMPASS_FILES) {
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const pattern of BLUEPRINT_MODULE_PATTERNS) {
      assert.doesNotMatch(
        src,
        pattern,
        `${path.relative(ROOT, file)} imports Blueprint's composer (${pattern}) — Phase 4's audit found no safe, non-redundant field Blueprint adds beyond Projection itself; Compass must consume Projection directly, not via Blueprint recomputation`
      )
    }
  }
})

test('Guard A (positive): Compass\'s persistent-intelligence extraction reads only from lib/projection/types', () => {
  const src = stripComments(readFileSync(path.join(ROOT, 'lib/compass/learnerContext.ts'), 'utf8'))
  assert.match(src, /from ['"]@\/lib\/projection\/types['"]/, 'learnerContext.ts must import its persistent-intelligence value types from the canonical Projection domain')
  assert.match(src, /export function extractCompassSubjectIntelligence/)
})

test('Guard C: the persistent-context prompt block always states it is non-binding — the override rule cannot be silently removed', () => {
  const src = readFileSync(path.join(ROOT, 'lib/compass/prompt.ts'), 'utf8')
  assert.match(
    src,
    /trust what they show you now and adjust immediately/,
    'the explicit "session overrides history" instruction is missing from prompt.ts — persistent intelligence must never be allowed to hard-lock Compass\'s tutoring behavior'
  )
  assert.match(src, /starting point, not a constraint/)
})

test('the persistent-intelligence prompt block never renders a raw categorical risk label ("HIGH RISK"/"CRITICAL") as text a learner or the model could quote back', () => {
  const src = stripComments(readFileSync(path.join(ROOT, 'lib/compass/prompt.ts'), 'utf8'))
  assert.doesNotMatch(src, /HIGH RISK/i)
  assert.doesNotMatch(src, /overallRiskLevel/, 'prompt.ts must consume only per-subject flag reasons, never the raw categorical overallRiskLevel field')
})
