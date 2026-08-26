// lib/curriculum/evidenceSubjectResolution.ts
//
// A controlled, read-side boundary between free-text `learner_evidence.subject`
// strings and canonical `subjects.code` identities — for the Senior School
// Programme-aware Blueprint path only (Phase 2). This is NOT a general
// evidence-canonicalization engine: no fuzzy matching, no Levenshtein
// distance, no "looks similar enough." Every entry below is either (a)
// directly audited from real production evidence (see the Grade 10 Blueprint
// audit, 2026-08-26 — Brenda Kiprop's actual `learner_evidence.subject`
// values), or (b) an exact match to a raw key already treated as canonical
// elsewhere in the codebase (lib/pathwayCalculator.ts's SUBJECT_KEY_ALIASES:
// 'core_mathematics' / 'essential_mathematics' / 'csl' -> 'community_service_learning').
//
// Deliberately absent, on purpose:
//   - generic 'mathematics' is NOT aliased to SS-MATH-CORE or SS-MATH-ESS.
//     Mapping it to either would fabricate a Mathematics-variant attribution
//     this codebase has no way to prove (see docs/architecture — Grade 10
//     Foundation Gate audit, 2026-08-26, §4/§7). It IS aliased to the
//     generic `SS-MATH` canonical subject, which is a legitimate,
//     unambiguous 1:1 mapping (no variant decision required).
//   - Any senior_secondary subject with no audited raw-evidence string
//     (Agriculture, Art & Design, CRE, Computer Studies, Music, Sports
//     Science) is intentionally left unmapped rather than guessed from its
//     name — evidence for these subjects, if any exists, surfaces as
//     unattributed rather than silently misattributed.
//
// Adding a new entry here is a deliberate, auditable decision — trace the
// raw string to real evidence or an existing canonical alias table before
// adding it, exactly as the ones below were.

export const DETERMINISTIC_SENIOR_SUBJECT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // Audited directly from production learner_evidence (Brenda Kiprop trace,
  // Grade 10 Blueprint audit 2026-08-26) — one raw string per subject,
  // except Kiswahili.
  'SS-BIO': ['biology'],
  'SS-BUS': ['business_studies'],
  'SS-CHEM': ['chemistry'],
  'SS-ENG': ['english'],
  'SS-GEO': ['geography'],
  'SS-HIST': ['history_citizenship'],
  'SS-PHY': ['physics'],

  // Kiswahili — deliberately TWO aliases. Traced (same audit) to a single
  // evidence row whose raw_input_ref pointed at a class_assessments row
  // titled "Kiswahili Term 2 CAT 1" — a teacher-gradebook slug
  // inconsistency, not a second real subject. `public.subjects` has never
  // had a "Kiswahili Lugha" row. Both aliases resolve to the one canonical
  // Kiswahili identity for THIS Senior School context specifically. Note:
  // other modules (lib/knowledgeGraph/careerReadiness.ts) treat
  // `kiswahili_lugha` as a deliberately distinct key elsewhere in the
  // platform (KCSE-era Language/Literature split) — that is a different
  // context and this alias table does not attempt to reconcile it; see the
  // audit's Kiswahili Duplication Verdict for the full reasoning.
  'SS-KIS': ['kiswahili', 'kiswahili_lugha'],

  // Generic Mathematics — legitimate 1:1 mapping. Only valid when the
  // programme subject itself IS generic Mathematics (not Core/Essential),
  // in which case there is no variant ambiguity to resolve.
  'SS-MATH': ['mathematics'],

  // Explicit-variant evidence — only ever created by a producer that
  // already knew which Mathematics variant it meant. Matches
  // lib/pathwayCalculator.ts's own SUBJECT_KEY_ALIASES raw-key vocabulary.
  'SS-MATH-CORE': ['core_mathematics'],
  'SS-MATH-ESS': ['essential_mathematics'],

  // Matches lib/pathwayCalculator.ts's `csl` -> `community_service_learning` alias.
  'SS-CSL': ['community_service_learning'],
}

export function getDeterministicAliasesForCode(subjectCode: string): readonly string[] {
  return DETERMINISTIC_SENIOR_SUBJECT_ALIASES[subjectCode] ?? []
}
