// Growth Engine — shared domain types. Mirrors supabase/migrations/20260723110000_growth_engine_sprint_c0.sql column-for-column.

export type GrowthPipelineStage =
  | 'research'
  | 'contacted'
  | 'discovery'
  | 'demo_scheduled'
  | 'demo_completed'
  | 'pilot_offered'
  | 'pilot_running'
  | 'pilot_won'
  | 'deferred'
  | 'lost'

export const GROWTH_PIPELINE_STAGES: GrowthPipelineStage[] = [
  'research', 'contacted', 'discovery', 'demo_scheduled', 'demo_completed',
  'pilot_offered', 'pilot_running', 'pilot_won', 'deferred', 'lost',
]

export type GrowthSchoolStatus = 'active' | 'dormant' | 'lost'

export type GrowthSchool = {
  id: string
  name: string
  county: string | null
  category: string | null
  students_count: number | null
  status: GrowthSchoolStatus
  pipeline_stage: GrowthPipelineStage
  next_action: string | null
  next_action_date: string | null
  owner_id: string | null
  notes: string | null
  last_contact_at: string | null
  // Sprint PO-1 (Pilot Acquisition Engine) — the Research Workflow's three
  // capture fields (docs/growth-os/pilot-acquisition-engine.md §1). All
  // nullable free text, no scoring, no enum.
  contact_source: string | null
  existing_ict_activity: string | null
  selection_reason: string | null
  // Sprint PE-2 (Pilot Discovery Engine) — captured by the Google Places
  // discovery workflow (scripts/growth/discover-schools.ts) and carried
  // through by the importer (scripts/growth/import-schools-csv.ts). All
  // nullable — a school added by hand through the UI has none of these.
  phone: string | null
  website: string | null
  email: string | null
  google_place_id: string | null
  google_maps_url: string | null
  google_rating: number | null
  google_review_count: number | null
  business_status: string | null
  // Sprint PE-6 (Pilot Targeting Engine) — whatsapp_number is PE-5v2's
  // enrichment finding, finally given a column; discovery_score/
  // contact_quality are PE-4's CSV-only fields, now persisted because the
  // Founder Priority Score needs them post-import. `starred` is the one
  // genuinely new piece of state this sprint adds — a manual founder
  // override, not derived from anything else.
  whatsapp_number: string | null
  discovery_score: number | null
  contact_quality: string | null
  starred: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type NewGrowthSchool = {
  name: string
  county?: string | null
  category?: string | null
  studentsCount?: number | null
  notes?: string | null
  contactSource?: string | null
  existingIctActivity?: string | null
  selectionReason?: string | null
  phone?: string | null
  website?: string | null
  email?: string | null
  googlePlaceId?: string | null
  googleMapsUrl?: string | null
  googleRating?: number | null
  googleReviewCount?: number | null
  businessStatus?: string | null
  whatsappNumber?: string | null
  discoveryScore?: number | null
  contactQuality?: string | null
}

export type GrowthSchoolPatch = Partial<{
  name: string
  county: string | null
  category: string | null
  studentsCount: number | null
  status: GrowthSchoolStatus
  nextAction: string | null
  nextActionDate: string | null
  notes: string | null
  contactSource: string | null
  existingIctActivity: string | null
  selectionReason: string | null
  starred: boolean
}>

export type GrowthContactRole = 'principal' | 'deputy' | 'dos' | 'ict_teacher' | 'other'
export type GrowthPreferredContact = 'call' | 'whatsapp' | 'email'

export type GrowthContact = {
  id: string
  school_id: string
  role: GrowthContactRole | null
  full_name: string
  phone: string | null
  email: string | null
  preferred_contact: GrowthPreferredContact | null
  relationship_score: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewGrowthContact = {
  schoolId: string
  fullName: string
  role?: GrowthContactRole | null
  phone?: string | null
  email?: string | null
  preferredContact?: GrowthPreferredContact | null
  relationshipScore?: number | null
  notes?: string | null
}

export type GrowthActivityType =
  | 'called' | 'visited' | 'whatsapp' | 'email' | 'meeting' | 'demo' | 'training' | 'support'

export type GrowthActivity = {
  id: string
  school_id: string
  contact_id: string | null
  type: GrowthActivityType
  notes: string | null
  occurred_at: string
  created_by: string | null
  created_at: string
}

export type NewGrowthActivity = {
  schoolId: string
  type: GrowthActivityType
  contactId?: string | null
  notes?: string | null
  occurredAt?: string
}

export type GrowthFollowUpPriority = 'low' | 'normal' | 'high'

export type GrowthFollowUp = {
  id: string
  school_id: string
  task: string
  due_date: string
  priority: GrowthFollowUpPriority
  completed: boolean
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type NewGrowthFollowUp = {
  schoolId: string
  task: string
  dueDate: string
  priority?: GrowthFollowUpPriority
}

// Sprint PO-5 (Founder Mission Control) — replaces the four-section
// FounderDashboard (Must Do / Waiting For / At Risk / Wins) with the five
// sections the mission specifies. Same underlying tables, no new entity —
// this is a read-model reshape, not a schema change. `waitingFor` is
// deliberately retired: its information (schools mid-conversation, days
// since contact) is now folded into `atRisk` (only surfaced once it's
// actually a risk, per the mission's "everything must answer what should I
// do next") rather than shown at every distance-from-contact value.

export type MissionUrgency = 'overdue' | 'today' | 'this_week'

export type MissionTodayItem = {
  kind: 'follow_up' | 'demo' | 'first_contact' | 'research_incomplete' | 'first_week_review'
  schoolId: string
  schoolName: string
  label: string
  urgency: MissionUrgency
}

export type PipelineHealth = {
  research: number
  contacted: number
  discovery: number
  demo: number
  pilot: number
}

export type AtRiskItem = {
  schoolId: string
  schoolName: string
  reason: string
}

export type RecentWin = {
  kind: 'demo_completed' | 'pilot_accepted' | 'testimonial' | 'referral' | 'new_school'
  schoolId: string
  schoolName: string
  at: string
}

export type ThisWeekCounters = {
  schoolsResearched: number
  schoolsContacted: number
  discoveryMeetings: number
  demos: number
  pilotAgreements: number
  // Sprint PE-3 — Section 6 explicitly names this as one of the six factual
  // counters; derived from the same growth_schools rows already fetched,
  // no new table.
  activePilots: number
}

// Sprint PE-3 (Mission Control refinement) — Section 2 "Mission Progress."
// `goal` is a fixed sprint constant (docs/growth-os/pilot-discovery-engine's
// August objective: 10 pilot schools), not a stored/configurable value —
// deliberately not a new table per this sprint's "no new entities" mandate.
// `progress` counts schools that have actually become a pilot (pipeline_stage
// pilot_running or pilot_won), the same definition getMissionControl() already
// uses for the "pilot_accepted" Recent Win.
export type PilotAcquisitionProgress = {
  goal: number
  progress: number
}

export type MissionControlData = {
  missionToday: MissionTodayItem[]
  pilotAcquisition: PilotAcquisitionProgress
  pipelineHealth: PipelineHealth
  atRisk: AtRiskItem[]
  recentWins: RecentWin[]
  thisWeek: ThisWeekCounters
}
