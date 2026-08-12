/**
 * Phase 1 Gate 1 — Compass academic-level shadow comparison (READ ONLY).
 *
 * Compares, for every learner that has a `student_learning_context` row,
 * the academic level Compass uses TODAY:
 *
 *     tierToLevel(student_learning_context.subject_tiers[subject])
 *
 * against the canonical, evidence-derived level Compass would use after
 * the Phase 1 convergence:
 *
 *     learner_projections.academic.value.bySubject[
 *         normalizeSubjectKey(subject)
 *     ].latestLevel
 *
 * This script exists to answer one question before any behaviour changes:
 * "how far apart are the two truths, and is the divergence explainable?"
 *
 * It writes nothing, calls no model, emits no telemetry, and never invokes
 * `recomputeLearnerProjection()` (which has a persistence side effect) —
 * it reads `learner_projections` exactly as the new Compass adapter will,
 * via the read-only repository path. A learner with no persisted
 * projection row is reported as LEGACY_ONLY, which is itself a finding,
 * not an error.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/shadow-compare-compass-levels.ts
 *   npx tsx --env-file=.env.local scripts/shadow-compare-compass-levels.ts --verbose
 *   npx tsx --env-file=.env.local scripts/shadow-compare-compass-levels.ts --limit=200
 */

import { createServiceClient } from '@/utils/supabase/service'
import { tierToLevel } from '@/lib/compass/session'
import { normalizeSubjectKey } from '@/lib/pathwayCalculator'
import type { AcademicValue } from '@/lib/projection/types'

type Category = 'MATCH' | 'CANONICAL_ONLY' | 'LEGACY_ONLY' | 'DISAGREE'

type PairResult = {
  learnerId: string
  rawSubject: string
  normalizedSubject: string
  legacyTier: string | null
  legacyLevel: number | null
  canonicalLevel: number | null
  category: Category
  /** canonical - legacy, only when both exist. */
  delta: number | null
  direction: 'canonical_higher' | 'canonical_lower' | null
}

const args = process.argv.slice(2)
const VERBOSE = args.includes('--verbose')
const LIMIT = (() => {
  const raw = args.find(a => a.startsWith('--limit='))
  if (!raw) return null
  const n = Number(raw.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : null
})()

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

async function main() {
  const db = createServiceClient()

  // ── 1. Every learner Compass currently has a context row for ────────────
  let contextQuery = db
    .from('student_learning_context')
    .select('student_id, subject_tiers, overall_level')
    .order('student_id')
  if (LIMIT) contextQuery = contextQuery.limit(LIMIT)

  const { data: contexts, error: contextError } = await contextQuery
  if (contextError) throw new Error(`read student_learning_context: ${contextError.message}`)

  const rows = contexts ?? []
  if (rows.length === 0) {
    console.log('No student_learning_context rows found — nothing to compare.')
    return
  }

  const learnerIds = rows.map(r => r.student_id as string)

  // ── 2. Their persisted academic projections (read-only, batched) ─────────
  // Chunked so a large pilot roster does not build one oversized `.in()`.
  const CHUNK = 200
  const academicByLearner = new Map<string, AcademicValue>()
  for (let i = 0; i < learnerIds.length; i += CHUNK) {
    const chunk = learnerIds.slice(i, i + CHUNK)
    const { data: projections, error: projectionError } = await db
      .from('learner_projections')
      .select('learner_id, projector_type, value')
      .eq('projector_type', 'academic')
      .in('learner_id', chunk)
    if (projectionError) throw new Error(`read learner_projections: ${projectionError.message}`)
    for (const p of projections ?? []) {
      academicByLearner.set(p.learner_id as string, p.value as AcademicValue)
    }
  }

  // ── 3. Compare, per learner-subject pair ─────────────────────────────────
  const results: PairResult[] = []
  const normalizationChanges = new Map<string, string>()   // rawSubject -> normalized, where they differ
  const normalizationRescues: PairResult[] = []            // pairs that ONLY matched because of normalization
  let learnersWithCanonical = 0
  let learnersWithoutCanonical = 0
  let learnersWithEmptyTiers = 0

  for (const row of rows) {
    const learnerId = row.student_id as string
    const tiers = (row.subject_tiers ?? {}) as Record<string, string>
    const academic = academicByLearner.get(learnerId) ?? null

    if (academic) learnersWithCanonical++
    else learnersWithoutCanonical++

    const tierSubjects = Object.keys(tiers)
    if (tierSubjects.length === 0) learnersWithEmptyTiers++

    const bySubject = academic?.bySubject ?? {}

    // Union of both key spaces so CANONICAL_ONLY subjects are not missed.
    const canonicalSubjects = Object.keys(bySubject)
    const allSubjects = new Set<string>([
      ...tierSubjects.map(s => normalizeSubjectKey(s)),
      ...canonicalSubjects.map(s => normalizeSubjectKey(s)),
    ])

    for (const normalized of allSubjects) {
      // Legacy side: find the raw tier key that normalizes to this subject.
      const rawTierKey = tierSubjects.find(k => normalizeSubjectKey(k) === normalized) ?? null
      const legacyTier = rawTierKey ? (tiers[rawTierKey] ?? null) : null
      const legacyLevel = legacyTier !== null ? tierToLevel(legacyTier) : null

      // Canonical side: same normalization applied to projection keys.
      const canonicalKey = canonicalSubjects.find(k => normalizeSubjectKey(k) === normalized) ?? null
      const canonicalLevel = canonicalKey ? (bySubject[canonicalKey]?.latestLevel ?? null) : null

      if (rawTierKey && normalizeSubjectKey(rawTierKey) !== rawTierKey.toLowerCase()) {
        normalizationChanges.set(rawTierKey, normalized)
      }

      let category: Category
      if (legacyLevel === null && canonicalLevel === null) continue  // nothing to compare
      else if (legacyLevel === null) category = 'CANONICAL_ONLY'
      else if (canonicalLevel === null) category = 'LEGACY_ONLY'
      else if (legacyLevel === canonicalLevel) category = 'MATCH'
      else category = 'DISAGREE'

      const pair: PairResult = {
        learnerId,
        rawSubject: rawTierKey ?? canonicalKey ?? normalized,
        normalizedSubject: normalized,
        legacyTier,
        legacyLevel,
        canonicalLevel,
        category,
        delta: legacyLevel !== null && canonicalLevel !== null ? canonicalLevel - legacyLevel : null,
        direction:
          legacyLevel !== null && canonicalLevel !== null && canonicalLevel !== legacyLevel
            ? (canonicalLevel > legacyLevel ? 'canonical_higher' : 'canonical_lower')
            : null,
      }
      results.push(pair)

      // A pair whose raw keys differ but normalized keys match is a pair the
      // normalization step rescued — without it this would have been a
      // false LEGACY_ONLY/CANONICAL_ONLY split.
      if (rawTierKey && canonicalKey && rawTierKey.toLowerCase() !== canonicalKey.toLowerCase()) {
        normalizationRescues.push(pair)
      }
    }
  }

  // ── 4. Report ────────────────────────────────────────────────────────────
  const total = results.length
  const counts: Record<Category, number> = {
    MATCH: results.filter(r => r.category === 'MATCH').length,
    CANONICAL_ONLY: results.filter(r => r.category === 'CANONICAL_ONLY').length,
    LEGACY_ONLY: results.filter(r => r.category === 'LEGACY_ONLY').length,
    DISAGREE: results.filter(r => r.category === 'DISAGREE').length,
  }

  console.log('')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('  COMPASS ACADEMIC LEVEL — SHADOW COMPARISON (read-only)')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Learners checked (have a student_learning_context row): ${rows.length}`)
  console.log(`  with a persisted academic projection:                 ${learnersWithCanonical} (${pct(learnersWithCanonical, rows.length)})`)
  console.log(`  without any persisted academic projection:            ${learnersWithoutCanonical} (${pct(learnersWithoutCanonical, rows.length)})`)
  console.log(`  with an empty subject_tiers map:                      ${learnersWithEmptyTiers} (${pct(learnersWithEmptyTiers, rows.length)})`)
  console.log('')
  console.log(`Learner-subject pairs compared: ${total}`)
  console.log('')
  console.log(`  MATCH           ${String(counts.MATCH).padStart(6)}  ${pct(counts.MATCH, total)}`)
  console.log(`  DISAGREE        ${String(counts.DISAGREE).padStart(6)}  ${pct(counts.DISAGREE, total)}`)
  console.log(`  CANONICAL_ONLY  ${String(counts.CANONICAL_ONLY).padStart(6)}  ${pct(counts.CANONICAL_ONLY, total)}`)
  console.log(`  LEGACY_ONLY     ${String(counts.LEGACY_ONLY).padStart(6)}  ${pct(counts.LEGACY_ONLY, total)}`)
  console.log('')

  const bothPresent = counts.MATCH + counts.DISAGREE
  console.log(`Of the ${bothPresent} pairs where BOTH sources have a value:`)
  console.log(`  agree:    ${counts.MATCH} (${pct(counts.MATCH, bothPresent)})`)
  console.log(`  disagree: ${counts.DISAGREE} (${pct(counts.DISAGREE, bothPresent)})`)
  console.log('')

  if (counts.DISAGREE > 0) {
    const disagreements = results.filter(r => r.category === 'DISAGREE')
    const higher = disagreements.filter(r => r.direction === 'canonical_higher').length
    const lower = disagreements.filter(r => r.direction === 'canonical_lower').length

    console.log('── DISAGREEMENT DIRECTION ──────────────────────────────────────')
    console.log(`  canonical HIGHER than legacy: ${higher} (${pct(higher, counts.DISAGREE)})`)
    console.log(`  canonical LOWER  than legacy: ${lower} (${pct(lower, counts.DISAGREE)})`)
    console.log('')

    const byDelta = new Map<number, number>()
    for (const d of disagreements) byDelta.set(d.delta!, (byDelta.get(d.delta!) ?? 0) + 1)
    console.log('── DISAGREEMENT MAGNITUDE (canonical - legacy) ─────────────────')
    for (const delta of [...byDelta.keys()].sort((a, b) => a - b)) {
      console.log(`  ${delta > 0 ? '+' : ''}${delta} level(s): ${byDelta.get(delta)} pair(s)`)
    }
    console.log('')

    const bySubject = new Map<string, number>()
    for (const d of disagreements) bySubject.set(d.normalizedSubject, (bySubject.get(d.normalizedSubject) ?? 0) + 1)
    console.log('── DISAGREEMENT BY SUBJECT ─────────────────────────────────────')
    for (const [subject, count] of [...bySubject.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${subject.padEnd(30)} ${count}`)
    }
    console.log('')

    const shown = VERBOSE ? disagreements : disagreements.slice(0, 25)
    console.log(`── DISAGREEING PAIRS ${VERBOSE ? '(all)' : `(first ${shown.length} of ${disagreements.length}; --verbose for all)`} ──`)
    for (const d of shown) {
      console.log(
        `  learner=${d.learnerId}  subject=${d.normalizedSubject}` +
        `${d.rawSubject !== d.normalizedSubject ? ` (raw="${d.rawSubject}")` : ''}` +
        `  legacy=${d.legacyLevel} (tier="${d.legacyTier}")  canonical=${d.canonicalLevel}` +
        `  delta=${d.delta! > 0 ? '+' : ''}${d.delta}  ${d.direction}`
      )
    }
    console.log('')
  }

  console.log('── SUBJECT-KEY NORMALIZATION ───────────────────────────────────')
  if (normalizationChanges.size === 0) {
    console.log('  No tier key required alias normalization.')
  } else {
    for (const [raw, normalized] of normalizationChanges) {
      console.log(`  "${raw}" → "${normalized}"`)
    }
  }
  console.log(`  Pairs that only aligned BECAUSE of normalization: ${normalizationRescues.length}`)
  console.log('  (Without normalization these would have been counted as')
  console.log('   false LEGACY_ONLY + CANONICAL_ONLY splits.)')
  console.log('')

  // Platform-wide canonical availability. Deliberately NOT scoped to the
  // learners above: the comparison set is bounded by who has a
  // `student_learning_context` row (i.e. who Compass can reach today), which
  // systematically under-reports how many learners have canonical academic
  // state. Reporting only the intersection would make canonical coverage
  // look far worse than it is.
  const { count: canonicalLearnersTotal, error: canonicalCountError } = await db
    .from('learner_projections')
    .select('learner_id', { count: 'exact', head: true })
    .eq('projector_type', 'academic')
  if (canonicalCountError) throw new Error(`count academic projections: ${canonicalCountError.message}`)

  console.log('── CANONICAL COVERAGE, PLATFORM-WIDE ───────────────────────────')
  console.log(`  Learners with an academic projection (anywhere):  ${canonicalLearnersTotal ?? 0}`)
  console.log(`  Learners with a student_learning_context row:     ${rows.length}`)
  console.log(`  Learners with BOTH (the comparable set above):    ${learnersWithCanonical}`)
  console.log('')
  console.log('  Learners with canonical academic state but NO Compass context')
  console.log(`  row: ${Math.max(0, (canonicalLearnersTotal ?? 0) - learnersWithCanonical)}. These are learners Compass cannot`)
  console.log('  serve today regardless of this change — that is G-05 (the')
  console.log('  Assessment Needed gate), deliberately out of Phase 1 scope.')
  console.log('')

  console.log('── PROJECTED COMPASS SOURCE DISTRIBUTION AFTER THE SWITCH ──────')
  const wouldBeProjection = counts.MATCH + counts.DISAGREE + counts.CANONICAL_ONLY
  const wouldBeLegacy = counts.LEGACY_ONLY
  console.log(`  source='projection':   ${wouldBeProjection} (${pct(wouldBeProjection, total)})`)
  console.log(`  source='legacy_tier':  ${wouldBeLegacy} (${pct(wouldBeLegacy, total)})`)
  console.log('')
  console.log(`  Learner-subject pairs whose Compass level would CHANGE: ${counts.DISAGREE} (${pct(counts.DISAGREE, total)})`)
  console.log('')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('READ-ONLY: no rows were written. This script changes nothing.')
  console.log('════════════════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('[shadow-compare] failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
