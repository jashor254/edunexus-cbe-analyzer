// lib/repositories/wellbeing.repository.ts
//
// Owns `learner_wellbeing_cases`, `wellbeing_support_team`,
// `learner_wellbeing_updates` exclusively (Sprint 13G, ADR-0017). Only the
// canonical operations the mission named — no business logic (no
// permission checks, no lifecycle validation, no visibility-tightening
// enforcement): that all lives in lib/learnerWellbeing/wellbeing.ts. This
// repository only knows how to read and write rows; the DB's own trigger
// (`enforce_wellbeing_case_immutability`) is the final backstop against a
// terminal-state case ever being edited, and RLS
// (`learner_wellbeing_cases_support_team_read` etc.) is the final
// backstop against a non-support-team member ever reading a row directly.
//
// Per ADR-0017 Phase 6/mission Phase 4 discipline: no generic update()/
// delete()/mutate() on wellbeing cases — every lifecycle transition gets
// its own named method, and there is no delete path at all once a case
// has left `concern_raised`.

import { BaseRepository } from './base'

export type WellbeingCaseType = 'check_in' | 'support_plan'

export type WellbeingStatus =
  | 'concern_raised' | 'initial_assessment' | 'support_plan_active'
  | 'review' | 'outcome_recorded' | 'closed'
  | 'no_action_needed' | 'withdrawn'

export type WellbeingEscalationStatus = 'not_escalated' | 'escalated_school_leadership' | 'escalated_external_authority'

export type WellbeingVisibilityClassification = 'core_team' | 'school_leadership'

export type WellbeingUpdateType = 'status_change' | 'escalation_change' | 'review' | 'conversation' | 'referral' | 'note'

export type SupportTeamRole = 'core_team' | 'school_leadership'

export type LearnerWellbeingCaseRow = {
  id: string
  learner_id: string
  school_id: string
  case_type: WellbeingCaseType
  concern_summary: string
  status: WellbeingStatus
  escalation_status: WellbeingEscalationStatus
  escalated_by: string | null
  escalated_at: string | null
  support_goal: string | null
  support_outcome: string | null
  outcome_recorded_at: string | null
  no_action_reason: string | null
  withdrawn_reason: string | null
  withdrawn_at: string | null
  closed_at: string | null
  default_visibility_classification: WellbeingVisibilityClassification
  raised_by: string | null
  assessed_by: string | null
  version: number
  created_at: string
  updated_at: string
}

export type WellbeingSupportTeamRow = {
  id: string
  case_id: string
  school_user_id: string
  role: SupportTeamRole
  added_by: string | null
  created_at: string
}

export type WellbeingUpdateRow = {
  id: string
  case_id: string
  update_type: WellbeingUpdateType
  from_status: WellbeingStatus | null
  to_status: WellbeingStatus | null
  content: string | null
  visibility_classification: WellbeingVisibilityClassification | null
  actor_school_user_id: string | null
  version: number | null
  created_at: string
}

export type CreateWellbeingCaseInput = {
  learner_id: string
  school_id: string
  case_type: WellbeingCaseType
  concern_summary: string
  default_visibility_classification: WellbeingVisibilityClassification
  raised_by: string | null
}

export type UpdateConcernInput = Partial<
  Pick<LearnerWellbeingCaseRow, 'concern_summary' | 'case_type' | 'default_visibility_classification'>
>

const CASE_COLS =
  'id, learner_id, school_id, case_type, concern_summary, status, escalation_status, escalated_by, ' +
  'escalated_at, support_goal, support_outcome, outcome_recorded_at, no_action_reason, withdrawn_reason, ' +
  'withdrawn_at, closed_at, default_visibility_classification, raised_by, assessed_by, version, ' +
  'created_at, updated_at'

export class WellbeingRepository extends BaseRepository {
  // ── learner_wellbeing_cases ──────────────────────────────────────────────

  async create(input: CreateWellbeingCaseInput): Promise<LearnerWellbeingCaseRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .insert({ ...input, status: 'concern_raised', escalation_status: 'not_escalated', version: 1 })
      .select(CASE_COLS)
      .single()
    if (error) throw new Error(`create: ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow
  }

  /** Only succeeds while the case is still `concern_raised` — the DB trigger rejects any attempt once it has moved on. */
  async updateConcern(id: string, schoolId: string, input: UpdateConcernInput): Promise<LearnerWellbeingCaseRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(CASE_COLS)
      .single()
    if (error) throw new Error(`updateConcern: ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow
  }

  async beginAssessment(id: string, schoolId: string, assessedBy: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'initial_assessment', { version: nextVersion, assessed_by: assessedBy })
  }

  /** Initial Assessment -> No Action Needed, terminal (ADR-0017 Phase 5). */
  async markNoActionNeeded(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'no_action_needed', { version: nextVersion, no_action_reason: reason })
  }

  async activateSupportPlan(id: string, schoolId: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'support_plan_active', { version: nextVersion })
  }

  async reviewCase(id: string, schoolId: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'review', { version: nextVersion })
  }

  /** Support Plan Active or Review -> Withdrawn, terminal, neutral factual reason (ADR-0017 Phase 5/6). */
  async withdrawCase(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'withdrawn', { version: nextVersion, withdrawn_reason: reason, withdrawn_at: new Date().toISOString() })
  }

  async recordOutcome(id: string, schoolId: string, outcome: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'outcome_recorded', { version: nextVersion, support_outcome: outcome, outcome_recorded_at: new Date().toISOString() })
  }

  /** Outcome Recorded -> Closed. No Verification, no Published — ADR-0017 Phase 5's deliberate departure. */
  async closeCase(id: string, schoolId: string, nextVersion: number): Promise<LearnerWellbeingCaseRow> {
    return this.setStatus(id, schoolId, 'closed', { version: nextVersion, closed_at: new Date().toISOString() })
  }

  async setSupportGoal(id: string, schoolId: string, goal: string): Promise<LearnerWellbeingCaseRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .update({ support_goal: goal })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(CASE_COLS)
      .single()
    if (error) throw new Error(`setSupportGoal: ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow
  }

  /** Escalation Status is independent of the main lifecycle (ADR-0017 Phase 5) — callable at any non-terminal status. */
  async setEscalation(id: string, schoolId: string, status: WellbeingEscalationStatus, escalatedBy: string): Promise<LearnerWellbeingCaseRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .update({ escalation_status: status, escalated_by: escalatedBy, escalated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(CASE_COLS)
      .single()
    if (error) throw new Error(`setEscalation: ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow
  }

  private async setStatus(
    id: string, schoolId: string, status: WellbeingStatus, extra: Record<string, unknown>
  ): Promise<LearnerWellbeingCaseRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .update({ status, ...extra })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(CASE_COLS)
      .single()
    if (error) throw new Error(`setStatus(${status}): ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerWellbeingCaseRow | null> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .select(CASE_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerWellbeingCaseRow | null
  }

  /** Every case for a learner, regardless of status — the caller (service layer) is responsible for support-team gating; this repository performs no access control itself (mission Phase 4: "repository owns persistence only"). */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerWellbeingCaseRow[]> {
    const { data, error } = await this.db
      .from('learner_wellbeing_cases')
      .select(CASE_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerWellbeingCaseRow[]
  }

  // ── wellbeing_support_team ───────────────────────────────────────────────

  async addSupportTeamMember(caseId: string, schoolUserId: string, role: SupportTeamRole, addedBy: string | null): Promise<WellbeingSupportTeamRow> {
    const { data, error } = await this.db
      .from('wellbeing_support_team')
      .insert({ case_id: caseId, school_user_id: schoolUserId, role, added_by: addedBy })
      .select('id, case_id, school_user_id, role, added_by, created_at')
      .single()
    if (error) throw new Error(`addSupportTeamMember: ${error.message}`)
    return data as unknown as WellbeingSupportTeamRow
  }

  async removeSupportTeamMember(caseId: string, schoolUserId: string): Promise<void> {
    const { error } = await this.db
      .from('wellbeing_support_team')
      .delete()
      .eq('case_id', caseId)
      .eq('school_user_id', schoolUserId)
    if (error) throw new Error(`removeSupportTeamMember: ${error.message}`)
  }

  async listSupportTeam(caseId: string): Promise<WellbeingSupportTeamRow[]> {
    const { data, error } = await this.db
      .from('wellbeing_support_team')
      .select('id, case_id, school_user_id, role, added_by, created_at')
      .eq('case_id', caseId)
    if (error) throw new Error(`listSupportTeam: ${error.message}`)
    return (data ?? []) as unknown as WellbeingSupportTeamRow[]
  }

  async findSupportTeamMembership(caseId: string, schoolUserId: string): Promise<WellbeingSupportTeamRow | null> {
    const { data, error } = await this.db
      .from('wellbeing_support_team')
      .select('id, case_id, school_user_id, role, added_by, created_at')
      .eq('case_id', caseId)
      .eq('school_user_id', schoolUserId)
      .maybeSingle()
    if (error) throw new Error(`findSupportTeamMembership: ${error.message}`)
    return data as unknown as WellbeingSupportTeamRow | null
  }

  // ── learner_wellbeing_updates (append-only) ──────────────────────────────

  async addUpdate(
    caseId: string, updateType: WellbeingUpdateType,
    content: string | null, visibilityClassification: WellbeingVisibilityClassification | null,
    actorSchoolUserId: string | null,
    fromStatus: WellbeingStatus | null, toStatus: WellbeingStatus | null, version: number | null
  ): Promise<WellbeingUpdateRow> {
    const { data, error } = await this.db
      .from('learner_wellbeing_updates')
      .insert({
        case_id: caseId, update_type: updateType, content, visibility_classification: visibilityClassification,
        actor_school_user_id: actorSchoolUserId, from_status: fromStatus, to_status: toStatus, version,
      })
      .select('id, case_id, update_type, from_status, to_status, content, visibility_classification, actor_school_user_id, version, created_at')
      .single()
    if (error) throw new Error(`addUpdate: ${error.message}`)
    return data as unknown as WellbeingUpdateRow
  }

  /** Every update for a case, unfiltered — the caller (service layer) is responsible for visibility-tier filtering; this repository performs no access control itself. */
  async listUpdates(caseId: string): Promise<WellbeingUpdateRow[]> {
    const { data, error } = await this.db
      .from('learner_wellbeing_updates')
      .select('id, case_id, update_type, from_status, to_status, content, visibility_classification, actor_school_user_id, version, created_at')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`listUpdates: ${error.message}`)
    return (data ?? []) as unknown as WellbeingUpdateRow[]
  }
}
