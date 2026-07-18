// app/teacher/reports/blueprint/[studentId]/page.tsx
//
// Sprint 12AB: retired the legacy, independently-computed Blueprint
// (lib/learnerIntelligence/blueprint.ts) from this route. `studentId` here
// is the legacy `students.id` (this page is linked from the legacy class
// roster — see app/teacher/classes/[classId]/page.tsx). We resolve it to
// the bridged Core learners.id (students.external_id, Sprint 9F) and
// redirect into the one canonical Blueprint route
// (app/student/blueprint/[learnerId]), which composes exclusively via
// lib/learnerBlueprint/composeBlueprint() and owns its own auth check
// (requireSchoolStaff). This page performs no composition of its own.

import { redirect } from 'next/navigation'
import { repos } from '@/lib/repositories'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

export default async function LearnerBlueprintPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  const [row] = await repos.teachers.findExternalIdsByStudentIds([studentId])
  const coreLearnerId = row?.external_id ?? null

  if (!coreLearnerId) {
    // This legacy student was never bridged to a Core learner record, so
    // there is no canonical Blueprint to redirect to.
    return <BlueprintStateMessage kind="unavailable" />
  }

  redirect(`/student/blueprint/${coreLearnerId}`)
}
