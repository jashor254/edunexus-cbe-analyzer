import { z } from 'zod'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'

// Sprint PO-1 (Pilot Acquisition Engine) — the Research Workflow's three
// capture fields. Free text, same shape/limits as `notes` — no scoring,
// no enum, no required value (a school can be added with none of these
// filled in yet and completed later).
const researchFields = {
  contactSource: z.string().max(500).nullable().optional(),
  existingIctActivity: z.string().max(2000).nullable().optional(),
  selectionReason: z.string().max(2000).nullable().optional(),
}

export const createSchoolSchema = z.object({
  name: z.string().trim().min(1).max(200),
  county: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  studentsCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  ...researchFields,
})

export const updateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  county: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  studentsCount: z.number().int().min(0).nullable().optional(),
  status: z.enum(['active', 'dormant', 'lost']).optional(),
  nextAction: z.string().max(500).nullable().optional(),
  nextActionDate: z.string().date().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  ...researchFields,
  // Sprint PE-6 (Pilot Targeting Engine) — Manual Boost. The only field on
  // this schema that isn't free-text research data; a plain boolean toggle.
  starred: z.boolean().optional(),
})

export const changeStageSchema = z.object({
  stage: z.enum(GROWTH_PIPELINE_STAGES as [string, ...string[]]),
})
