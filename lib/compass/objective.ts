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
}

export async function setTeacherSuggestedTopic(input: SetTeacherSuggestedTopicInput): Promise<void> {
  await repos.compass.mergeTeacherSuggestedTopic(input.studentId, {
    firstSubject: input.subject,
    firstConcept: input.concept,
    strandName: input.strandName ?? null,
    teacherSuggested: true,
    teacherSuggestedAt: new Date().toISOString(),
  })
}
