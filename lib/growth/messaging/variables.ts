import type { GrowthSchool, GrowthContact } from '@/lib/growth/types'
import { PILOT_ACQUISITION_GOAL } from '@/lib/growth/constants'

/**
 * Sprint PE-8 Part 3 — Dynamic Personalization. Every value here is either
 * a real stored column (school/contact/founder) or a value the founder
 * types in for that one draft (meetingDate/meetingTime) — never guessed,
 * never AI-invented. A variable with no real value resolves to `null` and
 * is left as an unresolved {{token}} in the draft (see render.ts) rather
 * than silently blanked, so the founder always notices and fills it in.
 */
export type TemplateVariableInput = {
  school: GrowthSchool
  contact: GrowthContact | null
  founderName: string
  /** How many schools are already pilot_running/pilot_won — same definition as Mission Control's pilotAcquisition.progress (lib/growth/services/dashboard.ts). */
  pilotSchoolsCount: number
  meetingDate?: string
  meetingTime?: string
}

export function buildTemplateVariables(input: TemplateVariableInput): Record<string, string | null> {
  const { school, contact, founderName, pilotSchoolsCount, meetingDate, meetingTime } = input
  const contactName = contact?.full_name ?? null
  const slotsRemaining = Math.max(0, PILOT_ACQUISITION_GOAL - pilotSchoolsCount)

  return {
    school_name: school.name,
    county: school.county,
    contact_name: contactName,
    // Derived, not a literal spec variable — turns "Dear {{contact_name}}," into "Dear," gracefully
    // when no contact is on file, instead of leaving a bare unresolved token in a greeting line.
    contact_name_greeting: contactName ? ` ${contactName}` : null,
    contact_role: contact?.role ?? null,
    founder_name: founderName,
    phone: contact?.phone ?? school.phone,
    email: contact?.email ?? school.email,
    website: school.website,
    pilot_slots_remaining: String(slotsRemaining),
    meeting_date: meetingDate ?? null,
    meeting_time: meetingTime ?? null,
  }
}
