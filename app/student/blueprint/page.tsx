// app/student/blueprint/page.tsx
//
// Sprint 12AB: retired the legacy, independently-computed Blueprint
// (lib/learnerIntelligence/blueprint.ts) from this route. This is the
// self-serve "my own Blueprint" entry point (no [learnerId] in the URL) —
// we resolve the signed-in user's own legacy student record the same way
// /api/learn/student already did (repos.compass.findOwnedStudents), bridge
// it to a Core learners.id (students.external_id, Sprint 9F), and redirect
// into the one canonical Blueprint route (app/student/blueprint/[learnerId]).
// This page performs no composition of its own.

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

export default async function StudentBlueprintPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const owned = await repos.compass.findOwnedStudents(user.id)

  // Same "ask them to disambiguate in Compass first" behaviour the old
  // client-side picker check enforced — this page has never supported a
  // picker UI of its own.
  if (!owned || owned.length === 0 || owned.length >= 2) {
    return <BlueprintStateMessage kind="unavailable" />
  }

  const [row] = await repos.teachers.findExternalIdsByStudentIds([owned[0].id])
  const coreLearnerId = row?.external_id ?? null

  if (!coreLearnerId) {
    return <BlueprintStateMessage kind="unavailable" />
  }

  redirect(`/student/blueprint/${coreLearnerId}`)
}
