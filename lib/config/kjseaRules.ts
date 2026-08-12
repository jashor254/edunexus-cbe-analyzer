// lib/config/kjseaRules.ts
//
// KNEC's junior-school assessment and senior-school placement rules, as a
// VERSIONED, SOURCED, EXPLICITLY-PROVISIONAL rule set — never as constants
// scattered through the codebase.
//
// Why this file exists at all
// ---------------------------
// KJSEA is new (first sitting 2025) and its grading bands, pathway
// composite minimums and placement weighting have already moved once and
// will move again. Anything that hardcodes "STEM needs 20" or "EE is 7
// points" is a statement about ONE cycle that silently becomes a lie the
// following year. Every such number therefore lives here, attached to the
// cycle it belongs to, with the source it came from and whether that
// source has been verified.
//
// The verification contract (read before using this)
// --------------------------------------------------
// A rule set carries `status`:
//
//   'provisional' — the numbers come from secondary reporting (press,
//                   explainer sites), not a primary KNEC circular. They may
//                   be right; they are not confirmed. **No learner-facing
//                   surface may present a placement projection derived from
//                   a provisional rule set as a statement of fact.** Label
//                   it, caveat it, or withhold it — the platform's
//                   evidence-first rule ("never assert beyond the evidence")
//                   applies to the RULES as much as to a learner's marks.
//   'verified'    — checked against a primary KNEC/Ministry document, whose
//                   reference is recorded in `sources`.
//   'superseded'  — kept for reading historical snapshots correctly. A
//                   Blueprint snapshot taken under the 2025 rules must keep
//                   being interpreted under the 2025 rules forever.
//
// Nothing in this file is a constant to be imported directly by a feature.
// Call `getKjseaRuleSet()` / `getActiveKjseaRuleSet()` so the cycle is always
// an explicit, inspectable choice.
//
// Moving this to the database later is deliberately mechanical: the shape
// below is already row-shaped, so a `kjsea_rule_sets` table plus a loader
// replaces the literal array without touching a single consumer.

export type KjseaRuleStatus = 'provisional' | 'verified' | 'superseded'

export type KjseaPathway = 'STEM' | 'Social Sciences' | 'Arts' | 'Languages'

/** One performance band. `cbcLevel` is the coarse 1-4 descriptor level the platform stores today; several bands can share one. */
export type KjseaBand = {
  code: string
  points: number
  minPct: number
  maxPct: number
  descriptor: string
  cbcLevel: 1 | 2 | 3 | 4
}

export type KjseaRuleSourceRef = {
  label: string
  url: string | null
  /** ISO date this reference was consulted — so a later reader knows how stale the check is. */
  retrievedAt: string
  /** True only for a primary KNEC/Ministry document, never for press reporting. */
  primary: boolean
}

export type KjseaRuleSet = {
  /** The assessment cycle these rules governed, e.g. '2025'. */
  cycle: string
  status: KjseaRuleStatus
  /** Bands ordered highest to lowest. Ranges are inclusive and must tile 0-100 without gaps or overlap. */
  bands: readonly KjseaBand[]
  /** Minimum composite required to be eligible for each pathway, or null where the cycle published none. */
  pathwayMinimums: Readonly<Partial<Record<KjseaPathway, number>>>
  /** How the placement score is weighted across its components; values are percentages summing to 100. */
  placementWeighting: Readonly<{ kjsea: number; kpsea: number; sba: number }>
  sources: readonly KjseaRuleSourceRef[]
  /** Anything a reader must know that the numbers alone don't say. */
  notes: readonly string[]
}

// ─── Cycles ───────────────────────────────────────────────────────────────────
//
// PROVISIONAL. Assembled 2026-08-12 from convergent Kenyan press and CBE
// explainer reporting on the inaugural (2025) KJSEA. Six independent outlets
// agreed on the band table, which is why it is recorded at all — but not one
// of them is a primary KNEC circular, so `status` stays 'provisional' until
// somebody checks a real KNEC document and flips it.
//
// DO NOT flip `status` to 'verified' without adding a `primary: true` source.

const CYCLE_2025: KjseaRuleSet = {
  cycle: '2025',
  status: 'provisional',
  bands: [
    { code: 'EE1', points: 8, minPct: 90, maxPct: 100, descriptor: 'Exceptional',         cbcLevel: 4 },
    { code: 'EE2', points: 7, minPct: 75, maxPct: 89,  descriptor: 'Very Good',           cbcLevel: 4 },
    { code: 'ME1', points: 6, minPct: 58, maxPct: 74,  descriptor: 'Good',                cbcLevel: 3 },
    { code: 'ME2', points: 5, minPct: 41, maxPct: 57,  descriptor: 'Fair',                cbcLevel: 3 },
    { code: 'AE1', points: 4, minPct: 31, maxPct: 40,  descriptor: 'Needs Improvement',   cbcLevel: 2 },
    { code: 'AE2', points: 3, minPct: 21, maxPct: 30,  descriptor: 'Below Average',       cbcLevel: 2 },
    { code: 'BE1', points: 2, minPct: 11, maxPct: 20,  descriptor: 'Well Below Average',  cbcLevel: 1 },
    { code: 'BE2', points: 1, minPct: 0,  maxPct: 10,  descriptor: 'Minimal',             cbcLevel: 1 },
  ],
  pathwayMinimums: {
    'STEM': 20,
    'Social Sciences': 25,
    'Arts': 25,
  },
  placementWeighting: { kjsea: 60, kpsea: 20, sba: 20 },
  sources: [
    { label: 'Daily Nation — KJSEA: Inside criteria for placing learners in senior schools', url: 'https://nation.africa/kenya/news/education/kjsea-inside-criteria-for-placing-learners-in-senior-schools--5302338', retrievedAt: '2026-08-12', primary: false },
    { label: 'Daily Nation — How to interpret KJSEA scores', url: 'https://nation.africa/kenya/news/education/how-to-interpret-kjsea-scores--5295992', retrievedAt: '2026-08-12', primary: false },
    { label: 'Tuko — How 2025 KJSEA results were graded', url: 'https://www.tuko.co.ke/editorial/explainer/612391-kjsea-results-understanding-grading-system-senior-secondary-placement-criteria/', retrievedAt: '2026-08-12', primary: false },
    { label: 'EduPoa — KNEC’s KJSEA grading system and senior school placement explained', url: 'https://www.edupoa.com/blog/knecs-kjsea-grading-system-and-senior-school-placement-explained/', retrievedAt: '2026-08-12', primary: false },
  ],
  notes: [
    'No primary KNEC circular has been checked. Treat every number here as reported, not confirmed.',
    'The "Languages & Literature" pathway is named in Ministry reporting but no composite minimum for it was found — absent rather than guessed.',
    'Sources describe BE2 as "1-10%"; the floor is recorded as 0 so that a genuine zero still lands in a band instead of falling through.',
    'Pathway minimums are eligibility gates, not placement guarantees — actual placement also applied hybrid/CRA capacity formulas that are not modelled here.',
  ],
}

const RULE_SETS: readonly KjseaRuleSet[] = [CYCLE_2025]

/** The cycle used when a caller does not name one. Bump this when a newer cycle's rules are added. */
const DEFAULT_CYCLE = '2025'

// ─── Accessors ────────────────────────────────────────────────────────────────

export function listKjseaCycles(): string[] {
  return RULE_SETS.map(r => r.cycle)
}

/**
 * The rule set for one named cycle. Throws on an unknown cycle rather than
 * silently falling back — reading a snapshot under the wrong year's rules is
 * exactly the failure this module exists to prevent.
 */
export function getKjseaRuleSet(cycle: string = DEFAULT_CYCLE): KjseaRuleSet {
  const found = RULE_SETS.find(r => r.cycle === cycle)
  if (!found) {
    throw new Error(
      `No KJSEA rule set for cycle '${cycle}'. Known cycles: ${listKjseaCycles().join(', ')}. ` +
      `Add the cycle to lib/config/kjseaRules.ts rather than reusing another year's rules.`,
    )
  }
  return found
}

/** The rule set a new computation should use today. */
export function getActiveKjseaRuleSet(): KjseaRuleSet {
  return getKjseaRuleSet(DEFAULT_CYCLE)
}

/**
 * Whether this rule set may back a confident, learner-facing placement claim.
 * A surface that projects a learner's pathway MUST branch on this — see the
 * verification contract at the top of this file.
 */
export function isKjseaRuleSetVerified(ruleSet: KjseaRuleSet): boolean {
  return ruleSet.status === 'verified'
}

/**
 * One line a UI can show next to any number derived from these rules, or null
 * when the rules are verified and no caveat is owed.
 */
export function kjseaRuleCaveat(ruleSet: KjseaRuleSet): string | null {
  if (isKjseaRuleSetVerified(ruleSet)) return null
  return `Based on reported ${ruleSet.cycle} KJSEA criteria, not yet confirmed against an official KNEC publication. Placement rules change between cycles.`
}

// ─── Band lookup ──────────────────────────────────────────────────────────────

/** The band a raw percentage falls in, under the given cycle's rules. */
export function kjseaBandFromScore(percentage: number, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): KjseaBand {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`Percentage must be 0-100, got ${percentage}`)
  }
  const band = ruleSet.bands.find(b => percentage >= b.minPct && percentage <= b.maxPct)
  if (!band) {
    // Only reachable if a cycle's bands fail to tile 0-100 — a data bug in this file.
    throw new Error(`KJSEA ${ruleSet.cycle} bands do not cover ${percentage}%`)
  }
  return band
}

/** Exact points for a raw percentage. Prefer this over `cbcLevelToKjseaPoints` whenever a real mark exists. */
export function kjseaPointsFromScore(percentage: number, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): number {
  return kjseaBandFromScore(percentage, ruleSet).points
}

/**
 * Points when only the coarse 1-4 level is known.
 *
 * This is a LOWER BOUND, not a conversion: each 1-4 level spans two bands
 * (level 4 is EE1=8 or EE2=7), and with only the level there is no way to
 * tell which. Returning the lower of the two under-states a strong learner
 * rather than over-promising a placement — the safe direction to be wrong in.
 *
 * The previous version of this function returned these same values while
 * describing itself as "Official mapping from KNEC KJSEA 2025", which made a
 * deliberately conservative estimate look like an exact figure, and left the
 * top of each band unreachable even when the real mark was on file.
 */
export function cbcLevelToKjseaPointsFloor(level: number, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): number {
  const rounded = Math.round(level)
  const candidates = ruleSet.bands.filter(b => b.cbcLevel === rounded)
  if (candidates.length === 0) return 0
  return Math.min(...candidates.map(b => b.points))
}

/** True when the level alone cannot determine points — i.e. a real mark would change the answer. */
export function isKjseaPointsAmbiguousForLevel(level: number, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): boolean {
  const rounded = Math.round(level)
  const points = new Set(ruleSet.bands.filter(b => b.cbcLevel === rounded).map(b => b.points))
  return points.size > 1
}

/** Composite minimum for a pathway under this cycle, or null when the cycle published none. */
export function getPathwayMinimum(pathway: KjseaPathway, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): number | null {
  return ruleSet.pathwayMinimums[pathway] ?? null
}
