// lib/learnerWellbeing/wellbeing.ts
//
// The canonical Learner Wellbeing service (Sprint 13G, ADR-0017). Owns:
// lifecycle validation, transition rules, ownership enforcement, and
// evidence-free field validation. No Supabase client is ever used
// directly here — every read/write goes through `repos.wellbeing`
// (lib/repositories/wellbeing.repository.ts), which owns the tables
// exclusively.
//
// This is the ONLY canonical domain in this series whose access control
// is NOT "any school staff member" (`requireSchoolStaff`). ADR-0017 Phase
// 8/mission Phase 6 mandate Support-Team-scoped access: `requireSchoolStaff`
// is used only to gate *raising a new concern* (case_type-independent —
// any legitimate staff member may raise one); every other read or write
// on an existing case requires `requireSupportTeamMembership`, defined
// below, which is stricter than, and layered on top of, ordinary school
// membership.
//
// No AI, no diagnosis, no scoring, no emotional inference, no behaviour
// logic, no attendance logic anywhere in this module (ADR-0017 Phase 4/9,
// Stop Condition). This module imports nothing from lib/learnerBlueprint/,
// lib/parentExperience/, lib/teacherReflection/, lib/attendance*, or any
// future behaviour/discipline module — verified by
// wellbeingBoundary.architecture.test.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff, requireSchoolMembership } from '@/lib/core/permissions'
import { PermissionDeniedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import type { LearnerWellbeingCaseRow, WellbeingStatus, WellbeingVisibilityClassification, WellbeingUpdateType, SupportTeamRole } from '@/lib/repositories/wellbeing.repository'
import { validateWellbeingCaseFields, validateUpdateContent, validateVisibilityOverride } from './validation'
import {
  toWellbeingCase, toSupportTeamMember, toWellbeingUpdate,
  type WellbeingCase, type WellbeingCaseFields, type WellbeingSupportTeamMember, type WellbeingUpdate,
} from './types'

const TERMINAL_STATUSES: WellbeingStatus[] = ['closed', 'no_action_needed', 'withdrawn']
const WITHDRAWABLE_STATUSES: WellbeingStatus[] = ['support_plan_active', 'review']

/**
 * The domain's own, stricter-than-standard authorization gate (ADR-0017
 * Phase 8, mission Phase 6). Requires the caller to be a school staff
 * member AND a named member of this specific case's Support Team — not
 * merely a member of the school. Returns the caller's own school_users id
 * and their team role.
 */
async function requireSupportTeamMembership(
  client: SupabaseClient, schoolId: string, caseId: string
): Promise<{ schoolUserId: string; role: SupportTeamRole }> {
  const membership = await requireSchoolMembership(client, schoolId)
  const staff = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!staff) throw new PermissionDeniedError('This action requires a recognized school staff record.')

  const teamRow = await repos.wellbeing.findSupportTeamMembership(caseId, staff.id)
  if (!teamRow) {
    throw new PermissionDeniedError('You are not on this case\'s Support Team — Wellbeing access is Support-Team-scoped, not school-staff-wide (ADR-0017 Phase 8).')
  }
  return { schoolUserId: staff.id, role: teamRow.role }
}

async function withRelated(row: LearnerWellbeingCaseRow): Promise<WellbeingCase> {
  return toWellbeingCase(row)
}

async function logUpdate(
  caseId: string, updateType: WellbeingUpdateType, content: string | null,
  visibilityClassification: WellbeingVisibilityClassification | null, actorSchoolUserId: string | null,
  fromStatus: WellbeingStatus | null, toStatus: WellbeingStatus | null, version: number | null
): Promise<void> {
  await repos.wellbeing.addUpdate(caseId, updateType, content, visibilityClassification, actorSchoolUserId, fromStatus, toStatus, version)
}

/** Raises a new concern — the earliest, editable state (ADR-0017 Phase 5). The raiser is automatically added to the case's own Support Team as `core_team` (they must be able to see the case they just raised). */
export async function raiseConcern(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: WellbeingCaseFields
): Promise<WellbeingCase> {
  await requireSchoolStaff(client, schoolId)
  validateWellbeingCaseFields(fields)

  const raiser = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.wellbeing.create({
    learner_id: learnerId,
    school_id: schoolId,
    case_type: fields.caseType,
    concern_summary: fields.concernSummary,
    default_visibility_classification: fields.defaultVisibilityClassification,
    raised_by: raiser?.id ?? null,
  })

  if (raiser) {
    await repos.wellbeing.addSupportTeamMember(row.id, raiser.id, 'core_team', raiser.id)
  }
  await logUpdate(row.id, 'status_change', null, null, raiser?.id ?? null, null, 'concern_raised', row.version)

  return withRelated(row)
}

/** Edits an existing Concern Raised case. Throws a clean error once it has moved on — the DB trigger is the final backstop. */
export async function updateConcern(
  client: SupabaseClient,
  schoolId: string,
  caseId: string,
  fields: Partial<WellbeingCaseFields>
): Promise<WellbeingCase> {
  await requireSupportTeamMembership(client, schoolId, caseId)

  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'concern_raised') throw new Error('This case has moved past concern_raised and can no longer be edited directly.')

  const merged: WellbeingCaseFields = {
    caseType: fields.caseType ?? existing.case_type,
    concernSummary: fields.concernSummary ?? existing.concern_summary,
    defaultVisibilityClassification: fields.defaultVisibilityClassification ?? existing.default_visibility_classification,
  }
  validateWellbeingCaseFields(merged)

  const row = await repos.wellbeing.updateConcern(caseId, schoolId, {
    case_type: merged.caseType,
    concern_summary: merged.concernSummary,
    default_visibility_classification: merged.defaultVisibilityClassification,
  })
  return withRelated(row)
}

/** Concern Raised -> Initial Assessment. */
export async function beginAssessment(client: SupabaseClient, schoolId: string, caseId: string): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'concern_raised') throw new Error('Only a newly-raised concern can move to initial assessment.')

  const row = await repos.wellbeing.beginAssessment(caseId, schoolId, schoolUserId, existing.version + 1)
  await logUpdate(caseId, 'status_change', null, null, schoolUserId, 'concern_raised', 'initial_assessment', row.version)
  return withRelated(row)
}

/** Initial Assessment -> No Action Needed, terminal (ADR-0017 Phase 5) — a real, honest outcome, never silently dropped. */
export async function markNoActionNeeded(client: SupabaseClient, schoolId: string, caseId: string, reason: string): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (!reason || !reason.trim()) throw new Error('A reason is required.')

  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'initial_assessment') throw new Error('Only a case in initial assessment can be marked no action needed.')

  const row = await repos.wellbeing.markNoActionNeeded(caseId, schoolId, reason, existing.version + 1)
  await logUpdate(caseId, 'status_change', reason, null, schoolUserId, 'initial_assessment', 'no_action_needed', row.version)
  return withRelated(row)
}

/** Initial Assessment -> Support Plan Active. */
export async function activateSupportPlan(client: SupabaseClient, schoolId: string, caseId: string, goal: string | null): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'initial_assessment') throw new Error('Only a case in initial assessment can activate a support plan.')

  let row = await repos.wellbeing.activateSupportPlan(caseId, schoolId, existing.version + 1)
  if (goal) row = await repos.wellbeing.setSupportGoal(caseId, schoolId, goal)
  await logUpdate(caseId, 'status_change', null, null, schoolUserId, 'initial_assessment', 'support_plan_active', row.version)
  return withRelated(row)
}

/** Support Plan Active -> Review. */
export async function reviewCase(client: SupabaseClient, schoolId: string, caseId: string, reviewNote: string | null): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'support_plan_active') throw new Error('Only an active support plan can move to review.')

  const row = await repos.wellbeing.reviewCase(caseId, schoolId, existing.version + 1)
  await logUpdate(caseId, 'status_change', null, null, schoolUserId, 'support_plan_active', 'review', row.version)
  if (reviewNote) {
    validateUpdateContent(reviewNote)
    await logUpdate(caseId, 'review', reviewNote, null, schoolUserId, null, null, null)
  }
  return withRelated(row)
}

/** Support Plan Active or Review -> Withdrawn, terminal, neutral factual reason, never framed as failure (ADR-0017 Phase 5/6). */
export async function withdrawCase(client: SupabaseClient, schoolId: string, caseId: string, reason: string): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (!reason || !reason.trim()) throw new Error('A withdrawal reason is required.')

  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (!WITHDRAWABLE_STATUSES.includes(existing.status)) {
    throw new Error('Only a case in Support Plan Active or Review can be withdrawn.')
  }

  const row = await repos.wellbeing.withdrawCase(caseId, schoolId, reason, existing.version + 1)
  await logUpdate(caseId, 'status_change', reason, null, schoolUserId, existing.status, 'withdrawn', row.version)
  return withRelated(row)
}

/** Review -> Outcome Recorded. */
export async function recordOutcome(client: SupabaseClient, schoolId: string, caseId: string, outcome: string): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (!outcome || !outcome.trim()) throw new Error('An outcome is required.')

  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'review') throw new Error('Only a case in review can have its outcome recorded.')

  const row = await repos.wellbeing.recordOutcome(caseId, schoolId, outcome, existing.version + 1)
  await logUpdate(caseId, 'status_change', null, null, schoolUserId, 'review', 'outcome_recorded', row.version)
  return withRelated(row)
}

/** Outcome Recorded -> Closed. No Verification, no Published (ADR-0017 Phase 5) — the domain's terminal state. */
export async function closeCase(client: SupabaseClient, schoolId: string, caseId: string): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (existing.status !== 'outcome_recorded') throw new Error('Only a case with a recorded outcome can be closed.')

  const row = await repos.wellbeing.closeCase(caseId, schoolId, existing.version + 1)
  await logUpdate(caseId, 'status_change', null, null, schoolUserId, 'outcome_recorded', 'closed', row.version)
  return withRelated(row)
}

/** Escalation Status — independent of the main lifecycle (ADR-0017 Phase 5), callable at any non-terminal status. */
export async function setEscalation(
  client: SupabaseClient, schoolId: string, caseId: string,
  status: 'not_escalated' | 'escalated_school_leadership' | 'escalated_external_authority'
): Promise<WellbeingCase> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (TERMINAL_STATUSES.includes(existing.status)) throw new Error('Cannot change escalation status on a closed/terminal case.')

  const row = await repos.wellbeing.setEscalation(caseId, schoolId, status, schoolUserId)
  await logUpdate(caseId, 'escalation_change', `Escalation status changed to ${status}.`, null, schoolUserId, null, null, null)
  return withRelated(row)
}

/** Only an existing `core_team`-role member may grant access to a new member — the more trusted tier controls who else can see confidential content (ADR-0017 Phase 8). */
export async function addSupportTeamMember(
  client: SupabaseClient, schoolId: string, caseId: string, newMemberSchoolUserId: string, role: SupportTeamRole
): Promise<WellbeingSupportTeamMember> {
  const { schoolUserId, role: actorRole } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (actorRole !== 'core_team') throw new Error('Only a core_team Support Team member can add new members to this case.')

  const row = await repos.wellbeing.addSupportTeamMember(caseId, newMemberSchoolUserId, role, schoolUserId)
  return toSupportTeamMember(row)
}

export async function removeSupportTeamMember(client: SupabaseClient, schoolId: string, caseId: string, memberSchoolUserId: string): Promise<void> {
  const { role: actorRole } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (actorRole !== 'core_team') throw new Error('Only a core_team Support Team member can remove members from this case.')
  await repos.wellbeing.removeSupportTeamMember(caseId, memberSchoolUserId)
}

export async function listSupportTeam(client: SupabaseClient, schoolId: string, caseId: string): Promise<WellbeingSupportTeamMember[]> {
  await requireSupportTeamMembership(client, schoolId, caseId)
  const rows = await repos.wellbeing.listSupportTeam(caseId)
  return rows.map(toSupportTeamMember)
}

/** Support Review, Support Conversation, External Referral, or Confidential Note — every type is append-only from the moment it is written (ADR-0017 Phase 3). Blocked once the case is terminal (Closure means no further content is logged). */
export async function addUpdate(
  client: SupabaseClient, schoolId: string, caseId: string,
  updateType: 'conversation' | 'referral' | 'note',
  content: string, visibilityClassification: WellbeingVisibilityClassification | null
): Promise<WellbeingUpdate> {
  const { schoolUserId } = await requireSupportTeamMembership(client, schoolId, caseId)
  if (!content || !content.trim()) throw new Error('Update content is required.')
  validateUpdateContent(content)

  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')
  if (TERMINAL_STATUSES.includes(existing.status)) throw new Error('Cannot add an update to a closed/terminal case.')

  validateVisibilityOverride(existing.default_visibility_classification, visibilityClassification)

  const row = await repos.wellbeing.addUpdate(caseId, updateType, content, visibilityClassification, schoolUserId, null, null, null)
  return toWellbeingUpdate(row)
}

export async function findCaseById(client: SupabaseClient, schoolId: string, caseId: string): Promise<WellbeingCase | null> {
  await requireSupportTeamMembership(client, schoolId, caseId)
  const row = await repos.wellbeing.findById(caseId, schoolId)
  return row ? withRelated(row) : null
}

/**
 * Every update for a case, filtered by the caller's own Support Team
 * role (ADR-0017 Phase 8's two-tier visibility model) — a
 * `school_leadership`-role caller never sees `core_team`-classified
 * content, even though the repository itself returns every row
 * unfiltered (mission Phase 4: "repository owns persistence only").
 */
export async function listUpdates(client: SupabaseClient, schoolId: string, caseId: string): Promise<WellbeingUpdate[]> {
  const { role } = await requireSupportTeamMembership(client, schoolId, caseId)
  const existing = await repos.wellbeing.findById(caseId, schoolId)
  if (!existing) throw new Error('Wellbeing case not found.')

  const rows = await repos.wellbeing.listUpdates(caseId)
  const visible = role === 'core_team'
    ? rows
    : rows.filter(r => (r.visibility_classification ?? existing.default_visibility_classification) !== 'core_team')

  return visible.map(toWellbeingUpdate)
}
