// app/(parent)/child/[learnerId]/assignments/page.tsx
// Sprint 5 (Parent Experience Convergence). learnerId here is the Core
// learners.id (this route tree's convention, see the sibling Parent Home
// page); /api/student/assignments is keyed by the legacy students.id —
// bridged via the existing repos.teachers.findLegacyStudentByExternalId
// (Sprint 9F), the same reverse-bridge app/student/blueprint/page.tsx
// already relies on. No new bridging logic.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import ParentAssignmentsClient from './ParentAssignmentsClient'
import { asLearnerId } from '@/lib/core/identityTypes'

export default async function ParentAssignmentsPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  // Route-boundary trust origin: this segment is a Core `learners.id` — proven
  // by the Core-learner queries below, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  try {
    await requireParent(supabase, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) notFound()
    throw err
  }

  const legacyStudent = await repos.teachers.findLegacyStudentByExternalId(learnerId)
  if (!legacyStudent) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <p className="text-sm text-gray-500">Assignments aren&apos;t available for this learner yet.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href={`/child/${learnerId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-black text-gray-900 mt-3">Assignments</h1>
        <p className="text-gray-500 mt-1 text-sm">What&apos;s been assigned, and whether it&apos;s been submitted or marked</p>
      </div>
      <ParentAssignmentsClient studentId={legacyStudent.id} />
    </div>
  )
}
