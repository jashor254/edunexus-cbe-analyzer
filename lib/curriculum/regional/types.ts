// lib/curriculum/regional/types.ts
// Interface contract every regional curriculum adapter must satisfy.

export type GradeRange = {
  min: number   // inclusive — e.g. 1 for Grade 1
  max: number   // inclusive — e.g. 9 for Grade 9
  label: string // e.g. 'Junior Secondary'
}

export type GradingDescriptor = {
  code:    string   // e.g. 'EE', 'A', 'P1'
  label:   string   // full label, e.g. 'Exceeding Expectations'
  minPct:  number   // 0–100
  maxPct:  number   // 0–100
  cbcLevel?: 1|2|3|4  // mapped CBC level for cross-system comparison
}

export type SubjectMap = {
  canonicalId: string   // our internal ID, e.g. 'mathematics'
  localName:   string   // as named in this curriculum, e.g. 'Core Mathematics'
  code?:       string   // official curriculum code, e.g. 'CBC-MATH-G7'
}

export type TermCalendar = {
  term:      number
  startMonth: number   // 1-indexed
  endMonth:   number   // 1-indexed
  name:       string   // e.g. 'First Term', 'Spring Semester'
}

export type AssessmentConfig = {
  maxMarks:        number    // out of (e.g. 100)
  passThreshold:   number    // percent needed to pass (e.g. 50)
  formativeWeight: number    // 0–1 — share of final grade from formative tasks
  summativeWeight: number    // 0–1
}

/**
 * Every country/curriculum adapter implements this interface.
 * The platform calls adapters to normalize data across systems.
 */
export type CurriculumAdapter = {
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode: string

  /** Curriculum system identifier */
  curriculumId: string

  /** Human-readable name */
  displayName: string

  /** Supported grade ranges in this curriculum */
  gradeRanges: GradeRange[]

  /** Grading scale descriptors, ordered best → worst */
  gradingScale: GradingDescriptor[]

  /** Term calendar for this curriculum */
  termCalendar: TermCalendar[]

  /** Assessment rules for this curriculum */
  assessmentConfig: AssessmentConfig

  /** Subject canonical mapping */
  subjects: SubjectMap[]

  /**
   * Convert a raw percentage mark to the curriculum's grade descriptor.
   */
  markToGrade(pct: number): GradingDescriptor

  /**
   * Convert a raw percentage to the normalized CBC 1–4 level
   * for cross-system learner model comparison.
   */
  normalizeToCBCLevel(pct: number): 1 | 2 | 3 | 4

  /**
   * Resolve the canonical subject ID for a locally-named subject.
   * Returns null if not found (caller can fall back to the local name).
   */
  resolveSubject(localName: string): string | null

  /**
   * Get the current term number for a given date.
   */
  getCurrentTerm(date?: Date): number
}
