// lib/events/types.ts

export type EventPayload = Record<string, unknown>

export type PlatformEventRecord = {
  id: string
  event_type: string
  event_version: string
  organization_id: string | null
  actor_id: string | null
  resource_type: string
  resource_id: string
  payload: EventPayload
  idempotency_key: string | null
  published_at: string
}

export type PublishEventInput = {
  event_type: string
  event_version?: string
  organization_id?: string
  actor_id?: string
  resource_type: string
  resource_id: string
  payload?: EventPayload
  idempotency_key?: string
}

// Well-known event types — extend as the platform grows
export type WellKnownEventType =
  // Teacher events
  | 'teacher.sow.generated'
  | 'teacher.lesson_plan.generated'
  | 'teacher.row.submitted'
  | 'teacher.assessment.created'
  | 'teacher.assessment.published'
  | 'teacher.assessment.graded'
  | 'teacher.assignment.created'
  | 'teacher.assignment.graded'
  // Student events
  | 'student.session.completed'
  | 'student.assessment.submitted'
  | 'student.assignment.submitted'
  | 'student.milestone.achieved'
  | 'student.knowledge_graph.updated'
  | 'student.career_recommendation.updated'
  | 'student.career_pathway.changed'
  // Parent events
  | 'parent.observation.submitted'
  | 'parent.pulse.generated'
  // Organization events
  | 'organization.created'
  | 'organization.member.invited'
  | 'organization.member.joined'
  | 'organization.member.removed'
  | 'organization.member.reinstated'
  | 'organization.member.role_changed'
  | 'organization.subscription.upgraded'
  | 'organization.subscription.canceled'
  // School institutional entitlement (lib/core/schoolEntitlement.ts) — granted
  // by the EduNexus platform-admin path after payment is confirmed OUT OF BAND,
  // never by the school itself and never by a payment provider callback.
  | 'school.entitlement.activated'
  | 'school.entitlement.suspended'
  // API events
  | 'api.key.created'
  | 'api.key.revoked'
  | 'api.quota.exceeded'
  // Billing events
  | 'billing.payment.succeeded'
  | 'billing.payment.failed'
  | 'billing.trial.ending'
  // System events
  | 'system.job.failed'
  | 'system.job.completed'
  | 'system.research.completed'
  | 'system.intelligence.updated'
  | 'system.ai_provider.switched'
  | string   // allow arbitrary types

export type DeliveryStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter'

// ── Typed payload interfaces ──────────────────────────────────────────────────

export type TeacherSowGeneratedPayload = {
  sow_id: string
  title: string
  subject: string
  grade: string
  term: string
  weeks: number
  curriculum_type: string
  generation_time_ms?: number
}

export type TeacherLessonPlanGeneratedPayload = {
  lesson_plan_id: string
  sow_id?: string
  title: string
  subject: string
  grade: string
  week_number?: number
  generation_time_ms?: number
}

export type TeacherAssessmentCreatedPayload = {
  assessment_id: string
  class_id: string
  title: string
  assessment_type: string
  term: string
  year: number
  subjects: string[]
  curriculum_type: string
}

export type TeacherAssessmentPublishedPayload = {
  assessment_id: string
  class_id?: string
  title?: string
}

export type TeacherAssessmentGradedPayload = {
  assessment_id: string
  class_id: string
  marks_count: number
}

export type TeacherAssignmentCreatedPayload = {
  assignment_id: string
  class_id: string
  title: string
  due_date: string
}

export type TeacherAssignmentGradedPayload = {
  assignment_id: string
  submission_id: string
  student_id: string
  score?: number
}

export type StudentSessionCompletedPayload = {
  session_id: string
  student_id: string
  subject: string
  exchanges: number
  duration_seconds?: number
}

export type StudentAssessmentSubmittedPayload = {
  assessment_id: string
  student_id: string
  class_id: string
  mean_score?: number
}

export type StudentAssignmentSubmittedPayload = {
  assignment_id: string
  student_id: string
  class_id: string
}

export type StudentMilestoneAchievedPayload = {
  mission_id: string
  student_id?: string
  teacher_id?: string
  module_id: string
  xp_earned?: number
}

export type StudentCareerRecommendationUpdatedPayload = {
  student_id: string
  top_career_slug: string
  match_count: number
}

export type BillingPaymentSucceededPayload = {
  reference: string
  amount_kobo: number
  currency: string
  plan?: string
  tokens_granted?: number
}

export type BillingPaymentFailedPayload = {
  reference: string
  reason?: string
}

export type OrganizationMemberInvitedPayload = {
  school_user_id: string
  user_id: string
  role: string
  school_id: string
}

export type OrganizationMemberJoinedPayload = {
  organization_id: string
  user_id: string
  role: string
}

export type OrganizationMemberRoleChangedPayload = {
  organization_id: string
  user_id: string
  old_role: string
  new_role: string
}

export type OrganizationMemberRemovedPayload = {
  organization_id: string
  user_id: string
}

export type SystemIntelligenceUpdatedPayload = {
  student_id: string
  trigger: string
  layers_updated: string[]
}

// ── Version helper ────────────────────────────────────────────────────────────

export function eventType(base: WellKnownEventType, version = 1): string {
  return `${base}.v${version}`
}
