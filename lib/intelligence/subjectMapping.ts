// lib/intelligence/subjectMapping.ts
// Subject mapping stage of the ingestion pipeline — the boundary that
// produces `learner_evidence.subject` (canonical identity) from whatever a
// source called the subject (`raw_subject`, preserved separately).
//
// Phase 2A finding (Grade 10 Blueprint audit lineage): this module used to
// call `lib/pathwayCalculator.ts`'s `normalizeSubjectKey()` directly — the
// SAME function that intentionally collapses `core_mathematics` -> generic
// `mathematics` for KJSEA/STEM-gate pathway scoring
// (`SUBJECT_KEY_ALIASES['core_mathematics'] = 'mathematics' // core =
// mathematics for STEM gate`). That collapse is correct for pathway
// analysis and wrong for Evidence identity: reusing it here meant a Senior
// School Core Mathematics assessment lost its curriculum identity before
// Evidence was ever written, permanently and silently, for every caller of
// `mapSubject()` (lib/assessments/evidence.ts, lib/assessments/
// reportCardEvidence.ts, lib/intelligence/pipeline.ts). Reproduced live
// against a real assessment before this fix: input `core_mathematics`
// produced stored `learner_evidence.subject = 'mathematics'`.
//
// The fix is NOT to change `normalizeSubjectKey()` — every one of its
// existing analytical callers (pathway/KJSEA scoring, capabilityExtractor's
// career-signal grouping, clinicReportBuilder's subject map) intentionally
// wants Core and Essential Mathematics treated as one broader "Mathematics"
// family, and that is correct for those purposes. Two different questions
// need two different functions:
//
//   normalizeSubjectKey()          (pathwayCalculator.ts, unchanged)
//     "which analytical subject FAMILY does this belong to?" — may be lossy.
//   normalizeSubjectKeyForIdentity() (this file, new)
//     "what did the source call this, safely tidied?" — must be lossless
//     for any two genuinely distinct curriculum subjects.
//
// IDENTITY_SAFE_SUBJECT_ALIASES below is SUBJECT_KEY_ALIASES minus exactly
// the one entry that collapses two distinct real subjects into one
// (`core_mathematics -> mathematics`). Every other entry is a lossless
// shortcode/punctuation normalization (a shortcode or spelling variant of
// ONE subject, never a merge of two), so those are safe to keep for
// identity purposes too — e.g. `emat`/`essential maths` still becomes
// `essential_mathematics` here, because that's the correct, undiminished
// identity, just spelled differently by the source.

const IDENTITY_SAFE_SUBJECT_ALIASES: Record<string, string> = {
  // Mathematics — 'emat'/'essential maths' are safe: distinct shortcodes
  // for the SAME subject (Essential Mathematics), not a merge of two
  // subjects. 'core_mathematics' is deliberately ABSENT here — that is the
  // one alias pathwayCalculator.ts uses to intentionally MERGE Core
  // Mathematics into generic Mathematics for STEM-gate scoring, and doing
  // that at Evidence-write time is exactly the defect this boundary exists
  // to prevent. Absent from this table, 'core_mathematics' passes through
  // the fallback below unchanged, preserving its own identity.
  emat:               'essential_mathematics',
  essential_maths:    'essential_mathematics',
  'essential maths':  'essential_mathematics',
  // Subject shortcodes used by some schools — lossless expansions.
  geo:                'geography',
  csl:                'community_service_learning',
  hisc:               'home_science',
  // Religion abbreviations.
  ire:                'islamic_religious_education',
  // Technical / Arts aliases.
  pre_technical:      'pre_technical_studies',
  creative_arts:      'creative_arts_sports',
  agriculture:        'agriculture_nutrition',
  // 8-4-4/KCSE punctuation/spacing variants of one subject each.
  'business studies':          'business_studies',
  'history & government':      'history_and_government',
  'history and government':    'history_and_government',
  'history_&_government':      'history_and_government',
}

/**
 * Identity-preserving subject-key normalization for Evidence ingestion.
 * Only ever expands a shortcode/spelling variant to its own full identity —
 * never merges two genuinely distinct curriculum subjects into one. Use
 * this (via `mapSubject()`) anywhere the result becomes stored curriculum
 * identity (Evidence, programme matching, canonical projection identity).
 * For analytical grouping (pathway scoring, career capability families,
 * broad Mathematics competence), use `normalizeSubjectKey()` from
 * lib/pathwayCalculator.ts instead — do not use this function there, and
 * do not use that one here.
 *
 * Phase 2B — canonical FORM only, never meaning: trims, lowercases, and
 * collapses internal whitespace runs to a single space before alias
 * lookup. Without this, ' Mathematics ' (leading/trailing space) or
 * 'Business  Studies' (double space) would silently miss both the alias
 * table and equality with their tidy counterpart, fragmenting one real
 * subject into two Evidence identities purely on formatting — the same
 * class of defect Phase 2A fixed for Core/Essential Mathematics, just at
 * the whitespace layer instead of the semantic-alias layer. Case,
 * whitespace and the existing 1:1 aliases are the only transformations
 * here; nothing here ever merges two curriculum-distinct subjects (that
 * remains lib/pathwayCalculator.ts's job, deliberately).
 */
export function normalizeSubjectKeyForIdentity(key: string): string {
  const tidied = key.trim().toLowerCase().replace(/\s+/g, ' ')
  return IDENTITY_SAFE_SUBJECT_ALIASES[tidied] ?? tidied
}

export type SubjectMappingResult = {
  canonicalSubject: string
  wasMapped: boolean   // true if the input differed from the canonical key (worth surfacing, not an issue)
}

export function mapSubject(rawSubject: string): SubjectMappingResult {
  const canonical = normalizeSubjectKeyForIdentity(rawSubject)
  return {
    canonicalSubject: canonical,
    wasMapped: canonical !== rawSubject.trim().toLowerCase(),
  }
}
