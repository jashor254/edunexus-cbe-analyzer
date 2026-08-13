// lib/career/provisionalPreview.ts
//
// Reducing an unreviewed, AI-generated career profile to only what we are
// willing to show a learner before a human has checked it.
//
// Kept in its own module, free of any database or AI import, for two reasons:
// it is the single safety boundary between generated text and a family's
// decision, so it should be readable in one screen with nothing else in it; and
// it stays directly unit-testable without a Supabase client, which is what lets
// the leak test below run on every change.
//
// See lib/career/knowledgeRequests.ts for the orchestration that calls this.

import type { Career, CareerPathway } from './types'

/**
 * A career we do not yet know, described only as far as we can stand behind.
 *
 * Deliberately carries no salary_range_kes, no cost_to_qualify, no
 * kcse_minimum, no required_capabilities, no kenya_demand and no difficulty.
 * Those are exactly the fields a language model produces fluently and wrongly,
 * and exactly the fields a Kenyan family will act on. Adding a figure here is a
 * decision to show unreviewed numbers to families and should be argued for
 * explicitly rather than slipped in — `provisionalPreview.test.ts` will fail
 * first if it is.
 */
export type ProvisionalCareerPreview = {
  title: string
  slug: string
  pathway: CareerPathway
  description: string
  requiredSubjects: string[]
  /** Rendered verbatim. Never softened — the reader must know this is unverified. */
  provisionalNotice: string
}

export const PROVISIONAL_NOTICE =
  'We do not have a verified profile for this career yet. What you see here is a starting outline only — '
  + 'we have deliberately left out salary figures, entry grades and course costs until a person has checked them. '
  + 'Your request has been logged, and this career moves up our list each time someone asks for it.'

export function buildProvisionalPreview(
  generated: Omit<Career, 'id' | 'created_at' | 'updated_at'>,
): ProvisionalCareerPreview {
  return {
    title:             generated.title,
    slug:              generated.slug,
    pathway:           generated.pathway,
    description:       generated.description,
    requiredSubjects:  generated.required_subjects,
    provisionalNotice: PROVISIONAL_NOTICE,
  }
}
