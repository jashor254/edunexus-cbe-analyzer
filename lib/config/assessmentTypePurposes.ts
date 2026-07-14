// The one place the Phase B seeded assessment-type names map to a Phase G
// evidence_purposes code (docs/architecture/learner-record-layer-decisions.md
// Decision 2). Mirrors the mapping in
// supabase/migrations/20260713203000_phase_g_evidence_purposes.sql's
// backfill UPDATE exactly — that migration only back-populated rows that
// already existed at migration time, so this is reapplied here for any
// teacher whose assessment_types rows are created afterward (every teacher
// onboarded from now on) via lib/assessments/mutations.ts's
// resolveOrCreateAssessmentType. A name with no entry here (a genuinely
// custom type) stays unmapped — never a guessed purpose.
export const ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE: Record<string, string> = {
  opener:     'diagnostic',
  cat:        'formative',
  midterm:    'summative',
  endterm:    'summative',
  exam:       'summative',
  assignment: 'practice',
}
