import { growthRepos } from '@/lib/growth/repositories'
import type { GrowthSchool, GrowthPipelineStage, NewGrowthSchool, GrowthSchoolPatch } from '@/lib/growth/types'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'

export async function listSchools(): Promise<GrowthSchool[]> {
  return growthRepos.schools.list()
}

export async function getSchool(id: string): Promise<GrowthSchool> {
  const school = await growthRepos.schools.findById(id)
  if (!school) throw new Error(`School ${id} not found`)
  return school
}

/**
 * Fuzzy dedup at creation (Spec §2.1) — a duplicate school silently splits
 * activity history and the "first contact" date, which is worse than a
 * founder occasionally re-checking a near-miss name themselves.
 */
export async function createSchool(input: NewGrowthSchool, createdBy: string): Promise<GrowthSchool> {
  const existing = await growthRepos.schools.findByNameFuzzy(input.name)
  if (existing) {
    throw new Error(`A school named "${existing.name}" already exists — use it instead of creating a duplicate.`)
  }
  return growthRepos.schools.insert({
    name: input.name,
    county: input.county ?? null,
    category: input.category ?? null,
    students_count: input.studentsCount ?? null,
    notes: input.notes ?? null,
    contact_source: input.contactSource ?? null,
    existing_ict_activity: input.existingIctActivity ?? null,
    selection_reason: input.selectionReason ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    email: input.email ?? null,
    google_place_id: input.googlePlaceId ?? null,
    google_maps_url: input.googleMapsUrl ?? null,
    google_rating: input.googleRating ?? null,
    google_review_count: input.googleReviewCount ?? null,
    business_status: input.businessStatus ?? null,
    whatsapp_number: input.whatsappNumber ?? null,
    discovery_score: input.discoveryScore ?? null,
    contact_quality: input.contactQuality ?? null,
    created_by: createdBy,
  })
}

export async function updateSchool(id: string, patch: GrowthSchoolPatch): Promise<GrowthSchool> {
  return growthRepos.schools.update(id, {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.county !== undefined && { county: patch.county }),
    ...(patch.category !== undefined && { category: patch.category }),
    ...(patch.studentsCount !== undefined && { students_count: patch.studentsCount }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.nextAction !== undefined && { next_action: patch.nextAction }),
    ...(patch.nextActionDate !== undefined && { next_action_date: patch.nextActionDate }),
    ...(patch.notes !== undefined && { notes: patch.notes }),
    ...(patch.contactSource !== undefined && { contact_source: patch.contactSource }),
    ...(patch.existingIctActivity !== undefined && { existing_ict_activity: patch.existingIctActivity }),
    ...(patch.selectionReason !== undefined && { selection_reason: patch.selectionReason }),
    ...(patch.starred !== undefined && { starred: patch.starred }),
  })
}

/**
 * The single writer for pipeline stage (Blueprint §4.2) — Kanban drag-drop,
 * the API route, and (later) any automation action must all call this, never
 * write `pipeline_stage` directly, so every stage change stays guaranteed to
 * be valid and to update `last_contact_at` consistently.
 */
export async function changeStage(schoolId: string, toStage: GrowthPipelineStage): Promise<GrowthSchool> {
  if (!GROWTH_PIPELINE_STAGES.includes(toStage)) {
    throw new Error(`Invalid pipeline stage: ${toStage}`)
  }
  return growthRepos.schools.update(schoolId, { pipeline_stage: toStage })
}
