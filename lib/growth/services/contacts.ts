import { growthRepos } from '@/lib/growth/repositories'
import type { GrowthContact, NewGrowthContact } from '@/lib/growth/types'

export async function listContactsForSchool(schoolId: string): Promise<GrowthContact[]> {
  return growthRepos.contacts.listBySchool(schoolId)
}

export async function createContact(input: NewGrowthContact): Promise<GrowthContact> {
  await growthRepos.schools.findById(input.schoolId).then((school) => {
    if (!school) throw new Error(`School ${input.schoolId} not found`)
  })
  return growthRepos.contacts.insert({
    school_id: input.schoolId,
    full_name: input.fullName,
    role: input.role ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    preferred_contact: input.preferredContact ?? null,
    relationship_score: input.relationshipScore ?? null,
    notes: input.notes ?? null,
  })
}
