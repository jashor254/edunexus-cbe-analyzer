// lib/assessments/createAssessmentRequest.ts
//
// SEC-02A — the request contract and provenance rule for the (deprecated)
// `POST /api/assessments/create` route, kept in lib/ so the route stays a thin
// handler and the rule is unit-testable (Next.js route modules may not export
// arbitrary names).
//
// Provenance is assigned by the SERVER from the authenticated workflow, never
// from the request. This route is reachable only by the learner/parent who owns
// the student record (`requireStudent`), so everything it stores is reported by
// that owner: it is stamped `'parent'`, the platform's existing label for
// "reported by the family, not teacher-authored". A client may still send
// `source: 'parent'` (accepted for compatibility, ignored); any other value —
// notably `'teacher'` — is rejected rather than silently downgraded, so a
// request that tries to claim teacher authority fails visibly.

import { z } from 'zod'

/** The only provenance this route can ever assign. */
export const CREATED_ASSESSMENT_SOURCE = 'parent' as const

export const CreateAssessmentSchema = z.object({
  student_id:              z.string().uuid(),
  grade:                   z.number().int().optional(),
  term:                    z.number().int().min(1).max(3),
  year:                    z.number().int(),
  grade_level:             z.enum(['junior', 'senior']).optional(),
  subject_scores:          z.record(z.string(), z.unknown()).refine(s => Object.keys(s).length >= 5, {
    message: 'At least 5 subject scores are required',
  }),
  curriculum_type:         z.string().optional(),
  assessment_style:        z.string().optional(),
  mathematics_type:        z.string().optional(),
  pathway_electives:       z.unknown().optional(),
  pathway_recommendations: z.unknown().optional(),
  /**
   * Accepted only as the literal `'parent'`, and never used: provenance is
   * assigned server-side (CREATED_ASSESSMENT_SOURCE). `'teacher'` and every
   * other value fail validation (400) instead of being stored or downgraded.
   */
  source:                  z.literal(CREATED_ASSESSMENT_SOURCE).optional(),
  raw_marks:               z.record(z.string(), z.unknown()).optional(),
})

export type CreateAssessmentRequest = z.infer<typeof CreateAssessmentSchema>
