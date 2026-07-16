// lib/assessments/assessmentTypeCatalog.ts
//
// Sprint 5I (docs/engineering/sprint-5i-assessment-type-consolidation.md):
// the single canonical source for the 6 platform-seeded, teacher-facing
// assessment labels — their display metadata and their default
// educational-purpose mapping (Sprint 5H-P's ratified Hybrid model:
// teacher label → canonical educational purpose). Consolidates what were
// previously 4 independently-spelled label dictionaries
// (lib/repositories/assessment.repository.ts, lib/assessments/pdfRenderer.ts,
// and two in app/teacher/classes/[classId]/assessments/page.tsx) plus one
// separate purpose-mapping file (lib/config/assessmentTypePurposes.ts) into
// one module.
//
// Deliberately excludes: DB access, repositories, Supabase, routes,
// Intelligence imports. Pure data and pure functions only. A teacher's own
// custom-registered type name (via resolveOrCreateAssessmentType) is never
// in this catalog — this module only knows the 6 platform-seeded defaults,
// exactly as ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE did before it. Every
// lookup function falls back to the raw input for an unknown/custom name,
// matching each prior call site's own pre-existing fallback behavior
// exactly — never a guess, never a thrown error for a valid-but-custom name.

export const KNOWN_ASSESSMENT_TYPES = ['opener', 'cat', 'midterm', 'endterm', 'exam', 'assignment'] as const

export type AssessmentType = typeof KNOWN_ASSESSMENT_TYPES[number]

export type AssessmentTypeMeta = {
  /** Display label used in report/PDF *titles* ("Term 2 Mid-Term 2026") — matches assessment.repository.ts's and the frontend's prior title-building spelling exactly. */
  titleLabel: string
  /** Display label used in UI badges/chips and the PDF metadata row ("Midterm"/"End Term") — matches pdfRenderer.ts's and the frontend's prior badge spelling exactly. */
  badgeLabel: string
  /** Tailwind color classes for the teacher-dashboard UI badge. */
  badgeClass: string
  /** Default educational-purpose code (Sprint 5H-P), or null if none is mapped. */
  purposeCode: string | null
}

const CATALOG: Record<AssessmentType, AssessmentTypeMeta> = {
  opener:     { titleLabel: 'Opener',     badgeLabel: 'Opener',     badgeClass: 'bg-teal-100 text-teal-700',     purposeCode: 'diagnostic' },
  cat:        { titleLabel: 'CAT',        badgeLabel: 'CAT',        badgeClass: 'bg-violet-100 text-violet-700', purposeCode: 'formative'  },
  midterm:    { titleLabel: 'Mid-Term',   badgeLabel: 'Midterm',    badgeClass: 'bg-orange-100 text-orange-700', purposeCode: 'summative'  },
  endterm:    { titleLabel: 'End-Term',   badgeLabel: 'End Term',   badgeClass: 'bg-red-100 text-red-700',       purposeCode: 'summative'  },
  exam:       { titleLabel: 'Exam',       badgeLabel: 'Exam',       badgeClass: 'bg-blue-100 text-blue-700',     purposeCode: 'summative'  },
  assignment: { titleLabel: 'Assignment', badgeLabel: 'Assignment', badgeClass: 'bg-green-100 text-green-700',   purposeCode: 'practice'   },
}

export function isKnownAssessmentType(value: string): value is AssessmentType {
  return Object.prototype.hasOwnProperty.call(CATALOG, value)
}

export function getAssessmentTypeMeta(type: string): AssessmentTypeMeta | null {
  return isKnownAssessmentType(type) ? CATALOG[type] : null
}

/** Falls back to the raw input for a custom/unknown type name — matches every prior call site's own `?? value`/`|| value` fallback exactly. */
export function getTitleLabel(type: string): string {
  return getAssessmentTypeMeta(type)?.titleLabel ?? type
}

/** Falls back to the raw input for a custom/unknown type name — matches pdfRenderer.ts's prior `|| assessment.assessment_type` fallback exactly. */
export function getBadgeLabel(type: string): string {
  return getAssessmentTypeMeta(type)?.badgeLabel ?? type
}

export function getBadgeClass(type: string): string | undefined {
  return getAssessmentTypeMeta(type)?.badgeClass
}

/** Default educational-purpose code for a known type, or null for a custom/unmapped name — never guessed, matching ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE's prior `?? null` behavior exactly. */
export function getDefaultPurposeCode(type: string): string | null {
  return getAssessmentTypeMeta(type)?.purposeCode ?? null
}

/** "Term {term} {titleLabel} {year}" — the exact format both assessment.repository.ts's getAssessmentAnalytics and the frontend's buildTitle produced independently before consolidation. */
export function buildAssessmentTitle(type: string, term: string, year: number): string {
  return `Term ${term} ${getTitleLabel(type)} ${year}`
}

/**
 * Comparator sorting known types in KNOWN_ASSESSMENT_TYPES order (Opener →
 * CAT → Midterm → End-Term → Exam → Assignment). Matches
 * app/teacher/analytics/page.tsx's prior `aTypeSort` exactly, including its
 * pre-existing quirk: `Array.prototype.indexOf` never returns a nullish
 * value, so an unrecognized type gets -1 (sorts first), not the `?? 99`
 * fallback the original code's author likely intended (`?? 99` is
 * unreachable dead code in both the original and here) — preserved
 * verbatim rather than "fixed," since this sprint changes no behavior.
 */
export function compareAssessmentTypes(a: string, b: string): number {
  return (KNOWN_ASSESSMENT_TYPES.indexOf(a as AssessmentType) ?? 99) - (KNOWN_ASSESSMENT_TYPES.indexOf(b as AssessmentType) ?? 99)
}
