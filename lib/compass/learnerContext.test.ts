// lib/compass/learnerContext.test.ts
//
// Phase 1 / P0-A — pure unit tests for the Compass learner-context adapter.
// No database, no network: synthetic AcademicValue + legacy-context
// fixtures only.
//
// The load-bearing assertion in this file is test 3: a legacy tier can
// never override an available canonical level. Everything else in the
// convergence depends on that being true, and it is the one property a
// future edit is most likely to break by "helpfully" comparing the two
// sources and picking the fresher-looking one.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/learnerContext.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveCompassAcademicLevel,
  resolveCompassSubjectRanking,
  tierToLevel,
  type LegacyAcademicFallback,
} from './learnerContext'
import type { AcademicValue, Trend } from '@/lib/projection/types'

const SOURCE = readFileSync(join(__dirname, 'learnerContext.ts'), 'utf8')

/**
 * The adapter's own doc comments legitimately NAME the things the
 * guardrails below forbid — explaining why `recomputeLearnerProjection()`
 * is not used, and why nothing is written back to
 * `student_learning_context`, is exactly the documentation that should be
 * there. So the guardrails scan executable code only. Stripping comments
 * rather than loosening the assertion keeps the check strict where it
 * matters: a real call would still be caught.
 */
const CODE = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block + JSDoc comments
  .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (not '://' in a URL)

function academic(bySubject: Record<string, { level: 1 | 2 | 3 | 4; trend?: Trend }>): AcademicValue {
  return {
    bySubject: Object.fromEntries(
      Object.entries(bySubject).map(([subject, v]) => [subject, {
        subject,
        latestLevel: v.level,
        trend: v.trend ?? 'stable',
        history: [],
      }]),
    ),
    bySubStrand: {},
  }
}

function legacy(overrides: Partial<LegacyAcademicFallback> = {}): LegacyAcademicFallback {
  return { subjectTiers: {}, overallLevel: null, sessionLevel: null, clientHint: null, ...overrides }
}

// ── 1. Canonical is selected when available ─────────────────────────────────

test('1. canonical projection level is used when available', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ mathematics: { level: 3, trend: 'improving' } }),
    academicConfidence: 92,
    academicFreshnessDays: 4,
    subject: 'mathematics',
    legacy: legacy(),
  })

  assert.equal(result.level, 3)
  assert.equal(result.source, 'projection')
  assert.equal(result.trend, 'improving')
  assert.equal(result.confidence, 92)
  assert.equal(result.freshnessDays, 4)
})

// ── 3. Legacy can NEVER override canonical ──────────────────────────────────

test('3. a conflicting legacy tier cannot override an available canonical level', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ mathematics: { level: 3 } }),
    subject: 'mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'remedial' }, overallLevel: 1, sessionLevel: 1 }),
  })

  assert.equal(result.level, 3, 'canonical (3) must win over the legacy remedial tier (1)')
  assert.equal(result.source, 'projection')
})

test('3b. a client hint cannot override an available canonical level', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ mathematics: { level: 2 } }),
    subject: 'mathematics',
    legacy: legacy({ clientHint: 4 }),
  })

  assert.equal(result.level, 2, 'a client may not assert a level that contradicts the learner\'s evidence')
  assert.equal(result.source, 'projection')
})

test('3c. canonical wins in BOTH directions — higher and lower than legacy', () => {
  const higher = resolveCompassAcademicLevel({
    academic: academic({ english: { level: 4 } }),
    subject: 'english',
    legacy: legacy({ subjectTiers: { english: 'remedial' } }),
  })
  const lower = resolveCompassAcademicLevel({
    academic: academic({ english: { level: 1 } }),
    subject: 'english',
    legacy: legacy({ subjectTiers: { english: 'challenge' } }),
  })

  assert.equal(higher.level, 4)
  assert.equal(lower.level, 1)
  assert.equal(higher.source, 'projection')
  assert.equal(lower.source, 'projection')
})

// ── 4. Without projection, the legacy chain still works, in order ───────────

test('4. without a projection, the legacy tier is used', () => {
  const result = resolveCompassAcademicLevel({
    academic: null,
    subject: 'mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'reinforcement' }, overallLevel: 4 }),
  })
  assert.equal(result.level, 2)
  assert.equal(result.source, 'legacy_tier')
})

test('4b. a projection that lacks THIS subject still falls back for this subject', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ english: { level: 4 } }),
    subject: 'mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'remedial' } }),
  })
  assert.equal(result.level, 1)
  assert.equal(result.source, 'legacy_tier')
})

test('4c. full fallback ordering: client hint > tier > overall > session > default', () => {
  const base = { academic: null, subject: 'mathematics' } as const

  assert.equal(resolveCompassAcademicLevel({ ...base, legacy: legacy({ clientHint: 4, subjectTiers: { mathematics: 'remedial' }, overallLevel: 1, sessionLevel: 1 }) }).source, 'client_hint')
  assert.equal(resolveCompassAcademicLevel({ ...base, legacy: legacy({ subjectTiers: { mathematics: 'standard' }, overallLevel: 1, sessionLevel: 1 }) }).source, 'legacy_tier')
  assert.equal(resolveCompassAcademicLevel({ ...base, legacy: legacy({ overallLevel: 3, sessionLevel: 1 }) }).source, 'legacy_overall')
  assert.equal(resolveCompassAcademicLevel({ ...base, legacy: legacy({ sessionLevel: 3 }) }).source, 'session')

  const fallback = resolveCompassAcademicLevel({ ...base, legacy: legacy() })
  assert.equal(fallback.source, 'default')
  assert.equal(fallback.level, 2, 'the conservative default is unchanged from the pre-Phase-1 behaviour')
})

test('4d. non-canonical sources never fabricate a trend or confidence', () => {
  const result = resolveCompassAcademicLevel({
    academic: null,
    subject: 'mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'standard' } }),
  })
  assert.equal(result.trend, null, 'a tier carries no trend — inventing one would be fake precision')
  assert.equal(result.confidence, null)
  assert.equal(result.freshnessDays, null)
})

test('4e. an out-of-range level in either source is ignored rather than trusted', () => {
  const badProjection = { bySubject: { mathematics: { subject: 'mathematics', latestLevel: 9, trend: 'stable', history: [] } }, bySubStrand: {} } as unknown as AcademicValue
  const result = resolveCompassAcademicLevel({
    academic: badProjection,
    subject: 'mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'standard' } }),
  })
  assert.equal(result.source, 'legacy_tier')
  assert.equal(result.level, 3)

  assert.equal(resolveCompassAcademicLevel({ academic: null, subject: 'x', legacy: legacy({ clientHint: 0 }) }).source, 'default')
  assert.equal(resolveCompassAcademicLevel({ academic: null, subject: 'x', legacy: legacy({ overallLevel: 7 }) }).source, 'default')
})

// ── 15. Subject aliases resolve correctly ───────────────────────────────────

test('15. core_mathematics (legacy tier key) matches mathematics (canonical key)', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ mathematics: { level: 3 } }),
    subject: 'core_mathematics',
    legacy: legacy({ subjectTiers: { core_mathematics: 'remedial' } }),
  })
  assert.equal(result.source, 'projection', 'alias normalization must find the canonical entry')
  assert.equal(result.level, 3)
})

test('15b. geo (legacy tier key) matches geography (canonical key)', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ geography: { level: 4 } }),
    subject: 'geo',
    legacy: legacy({ subjectTiers: { geo: 'remedial' } }),
  })
  assert.equal(result.source, 'projection')
  assert.equal(result.level, 4)
})

test('15c. subject matching is case-insensitive, as the pre-Phase-1 tier lookup was', () => {
  const result = resolveCompassAcademicLevel({
    academic: academic({ mathematics: { level: 3 } }),
    subject: 'Mathematics',
    legacy: legacy(),
  })
  assert.equal(result.source, 'projection')

  const legacyOnly = resolveCompassAcademicLevel({
    academic: null,
    subject: 'Mathematics',
    legacy: legacy({ subjectTiers: { mathematics: 'challenge' } }),
  })
  assert.equal(legacyOnly.source, 'legacy_tier')
  assert.equal(legacyOnly.level, 4)
})

// ── Subject ranking ─────────────────────────────────────────────────────────

test('R1. ranking is weakest-first and prefers canonical levels per subject', () => {
  const ranking = resolveCompassSubjectRanking({
    academic: academic({ mathematics: { level: 4 }, english: { level: 1 } }),
    subjectTiers: { mathematics: 'remedial', english: 'challenge', kiswahili: 'standard' },
  })

  assert.deepEqual(ranking.map(r => r.subject), ['english', 'kiswahili', 'mathematics'])
  assert.deepEqual(ranking.map(r => r.level), [1, 3, 4])
  assert.equal(ranking.find(r => r.subject === 'kiswahili')!.source, 'legacy_tier')
  assert.equal(ranking.find(r => r.subject === 'mathematics')!.source, 'projection')
})

test('R2. a subject with canonical evidence but no legacy tier still appears', () => {
  const ranking = resolveCompassSubjectRanking({
    academic: academic({ biology: { level: 2 } }),
    subjectTiers: { mathematics: 'standard' },
  })
  assert.ok(ranking.some(r => r.subject === 'biology'), 'canonical-only subjects must be offerable')
  assert.equal(ranking.find(r => r.subject === 'biology')!.source, 'projection')
})

test('R3. alias keys are collapsed, not double-counted', () => {
  const ranking = resolveCompassSubjectRanking({
    academic: academic({ mathematics: { level: 3 } }),
    subjectTiers: { core_mathematics: 'remedial' },
  })
  assert.equal(ranking.length, 1, 'core_mathematics and mathematics are one subject, not two')
  assert.equal(ranking[0].subject, 'mathematics')
  assert.equal(ranking[0].level, 3, 'canonical level wins')
})

test('R5. sourceKey preserves the learner\'s existing tier key — normalization matches, it does not rename', () => {
  // Returning 'mathematics' here would silently change which KICD topic
  // set a senior learner's session is grounded in (getGradeTopics is an
  // RPC keyed on the subject string). P0-A changes the LEVEL, not the
  // subject identity.
  const ranking = resolveCompassSubjectRanking({
    academic: academic({ mathematics: { level: 3 } }),
    subjectTiers: { core_mathematics: 'remedial' },
  })
  assert.equal(ranking[0].sourceKey, 'core_mathematics', 'downstream addressing must keep the tier key')
  assert.equal(ranking[0].subject, 'mathematics', 'matching still happens in the normalized space')
})

test('R6. a canonical-only subject uses the projection key, having no tier key to preserve', () => {
  const ranking = resolveCompassSubjectRanking({
    academic: academic({ biology: { level: 2 } }),
    subjectTiers: {},
  })
  assert.equal(ranking[0].sourceKey, 'biology')
  assert.equal(ranking[0].source, 'projection')
})

test('R4. with neither source, the ranking is empty rather than invented', () => {
  assert.deepEqual(resolveCompassSubjectRanking({ academic: null, subjectTiers: {} }), [])
})

// ── tierToLevel is unchanged by the move ────────────────────────────────────

test('T1. tierToLevel semantics are unchanged, including legacy string fallbacks', () => {
  assert.equal(tierToLevel('challenge'), 4)
  assert.equal(tierToLevel('standard'), 3)
  assert.equal(tierToLevel('reinforcement'), 2)
  assert.equal(tierToLevel('remedial'), 1)
  assert.equal(tierToLevel('exceeding_expectations'), 4)
  assert.equal(tierToLevel('meeting_expectations'), 3)
  assert.equal(tierToLevel('approaching_expectations'), 2)
  assert.equal(tierToLevel('anything_else'), 1)
})

test('T2. tierToLevel is still importable from lib/compass/session (existing importers)', async () => {
  const session = await import('./session')
  assert.equal(typeof session.tierToLevel, 'function')
  assert.equal(session.tierToLevel('standard'), 3)
})

// ── 13/14. Static guardrails: the adapter writes nothing, recomputes nothing ─

test('13. the adapter performs no student_learning_context write', () => {
  assert.ok(!CODE.includes(".from('student_learning_context')"), 'adapter must not touch student_learning_context directly')
  assert.ok(!CODE.includes('.from('), 'adapter must not query any table directly — it goes through lib/projection')
  for (const writer of ['.insert(', '.update(', '.upsert(', '.delete(']) {
    assert.ok(!CODE.includes(writer), `adapter must contain no ${writer} — it is a read adapter`)
  }
})

test('14. the adapter never calls recomputeLearnerProjection()', () => {
  assert.ok(
    !CODE.includes('recomputeLearnerProjection'),
    'recomputeLearnerProjection() upserts projection rows — a learner sending a chat message must never trigger a write',
  )
  assert.ok(CODE.includes('getPersistedProjections'), 'the adapter must read via the read-only projection accessor')
})

test('14b. no Projection value is ever synchronized back into student_learning_context', () => {
  assert.ok(
    !/subject_tiers\s*[:=]/.test(CODE.replace(/subjectTiers/g, '')),
    'the adapter must never assign to subject_tiers — one truth, not two synchronized copies',
  )
})

test('14c. the comment-stripping guardrail helper actually works (it must not silently pass everything)', () => {
  // A guardrail that can never fail protects nothing. Prove CODE still
  // contains real code and that the stripper removed only prose.
  assert.ok(CODE.includes('export function resolveCompassAcademicLevel'), 'CODE must retain executable declarations')
  assert.ok(SOURCE.includes('recomputeLearnerProjection'), 'the doc comment does mention it — that is the case being handled')
  assert.ok(!CODE.includes('not a synchronizer'), 'prose should have been stripped')
})
