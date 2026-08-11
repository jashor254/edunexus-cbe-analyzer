// lib/compass/endingLevelSource.test.ts
//
// Adaptive Remediation Phase 1, Stage 5 — a static guardrail against the
// legacy Compass contamination returning.
//
// The audit found that `/api/learn/end` derived a session's `endingLevel`
// from `student_learning_context.subject_tiers` via `tierToLevel()`. That
// tier map is written only by the Academic Clinic pipeline and is never
// refreshed when evidence changes — the exact stale snapshot
// `lib/compass/learnerContext.ts` was built to bypass at session START.
// Reading it at session END laundered it back into the canonical Evidence
// Domain as the `cbc_level` of the session's mastery claim, and made
// `levelGained` compare a Projection-derived start against a tier-derived
// end.
//
// A behavioural test of this route would need a full authenticated Compass
// session over HTTP; the property that actually matters is structural and
// permanent — that this route resolves its level through the one canonical
// resolver and through nothing else. So it is asserted structurally, in the
// same style as lib/learnerBlueprint/actionPlan/review.mapping.test.ts's
// own static guardrail scan.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/endingLevelSource.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROUTE_PATH = join(process.cwd(), 'app/api/learn/end/route.ts')
const SOURCE = readFileSync(ROUTE_PATH, 'utf8')

/** Comment-stripped source — a guardrail must not be satisfied (or tripped) by prose. */
const CODE = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(line => !line.trim().startsWith('//'))
  .join('\n')

test('static: the end-of-session route resolves its level through the canonical Projection resolver', () => {
  assert.match(CODE, /import\s*\{[^}]*resolveCompassAcademicLevelFor[^}]*\}\s*from\s*'@\/lib\/compass\/learnerContext'/,
    'the route must import the one canonical resolver')
  assert.match(CODE, /const\s+endingLevel\s*=[\s\S]{0,400}?resolveCompassAcademicLevelFor\(/,
    'endingLevel must be derived from that resolver')
})

test('static: the end-of-session route never converts a legacy Clinic tier into a level', () => {
  assert.doesNotMatch(CODE, /tierToLevel/,
    'tierToLevel() reintroduces the stale Academic Clinic snapshot into canonical Compass evidence')
})

test('static: subject_tiers may still be READ, but only to hand to the resolver as its documented fallback', () => {
  // The resolver's own precedence is projection -> client hint -> legacy
  // tier -> overall_level -> session -> floor. Passing the tier map in is
  // correct and expected; deriving a level from it here is not.
  const tierReads = CODE.match(/subject_tiers/g) ?? []
  assert.ok(tierReads.length > 0, 'the map is still passed through as the resolver\'s last-resort fallback')
  assert.match(CODE, /subjectTiers,?\s*$|subjectTiers,/m,
    'it reaches the resolver as `subjectTiers`, rather than being converted locally')
})

test('static: the mastery claim\'s cbcLevel comes from that same resolved endingLevel, not a second source', () => {
  assert.match(CODE, /recordCompassSessionEvidence\(\{[\s\S]*?endingLevel,[\s\S]*?\}\)/,
    'the Evidence producer must be handed the resolved endingLevel verbatim')
})
