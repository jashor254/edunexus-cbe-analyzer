// lib/compass/objective.ts
//
// The canonical "queue a Compass topic for this learner's next session"
// operation. Extracted from app/api/teacher/students/[studentId]/
// compass-topic/route.ts (Blueprint Living Action Plan Phase 2C — see
// docs/architecture/blueprint-compass-delivery-phase2c.md) so that route and
// the new Blueprint Compass-delivery adapter
// (lib/learnerBlueprint/actionPlan/delivery/compass.ts) share one writer
// instead of the adapter reaching around it.
//
// Writes only `student_learning_context.compass_bridge` — never
// `compass_sessions`. No AI/model call happens here or anywhere downstream
// of this write; `compass_bridge` is read later, server-side, by
// `getNextSubject()` (lib/compass/session.ts) the next time this specific
// learner starts or resumes a session through the existing, unmodified
// Compass flow. Teacher delivery and learner tutoring remain two separate
// events by construction — this function cannot create a session or
// generate a tutoring response.

import { repos } from '@/lib/repositories'

export type SetTeacherSuggestedTopicInput = {
  studentId: string
  subject: string
  concept: string
  strandName?: string | null
  /**
   * Phase 2 — the canonical curriculum anchor (`sow_substrands.id`) this
   * objective targets, when the approved action had one.
   *
   * Carried in the existing `compass_bridge` jsonb rather than a new column:
   * the bridge is already the channel teacher intent travels on, and adding
   * a key to it needs no migration. Compass reads it back when the session's
   * evidence is written, so a targeted session's mastery claim returns with
   * the same identity the teacher aimed at. Never guessed — omitted entirely
   * for a subject-level objective.
   */
  subStrandId?: string | null
  /**
   * Phase 2.6 — the `blueprint_compass_deliveries.id` this objective came
   * from, when it came from a Blueprint delivery.
   *
   * A REFERENCE only: the bridge stays ephemeral handoff state and may be
   * cleared once consumed, while the delivery row is the durable provenance
   * ledger. Absent for the plain teacher topic-picker route, which creates
   * no delivery row — such an objective is still honoured, it just has no
   * delivery to bind.
   */
  deliveryId?: string | null
}

export async function setTeacherSuggestedTopic(input: SetTeacherSuggestedTopicInput): Promise<void> {
  await repos.compass.mergeTeacherSuggestedTopic(input.studentId, {
    firstSubject: input.subject,
    firstConcept: input.concept,
    strandName: input.strandName ?? null,
    subStrandId: input.subStrandId ?? null,
    deliveryId: input.deliveryId ?? null,
    teacherSuggested: true,
    teacherSuggestedAt: new Date().toISOString(),
  })
}
