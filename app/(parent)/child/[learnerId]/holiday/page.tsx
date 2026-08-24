// app/(parent)/child/[learnerId]/holiday/page.tsx
// Sprint 5 (Parent Experience Convergence). Reuses components/student/
// StudentHolidayPlan.tsx verbatim (extended, not forked) — /api/holiday/mine
// is already parent-accessible via resolveCompassStudentAccess. The plan
// data itself already carries a per-week "parent_action" field that no
// parent-facing surface has ever shown until now.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import StudentHolidayPlan from '@/components/student/StudentHolidayPlan'
import { asLearnerId } from '@/lib/core/identityTypes'
import ChildContextHeader from '@/components/parent/ChildContextHeader'

export default async function ParentHolidayPage({
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
        <p className="text-sm text-gray-500">A holiday plan isn&apos;t available for this learner yet.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ChildContextHeader learnerId={learnerId} />
      <Link href={`/child/${learnerId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
        ← Back
      </Link>
      <StudentHolidayPlan studentId={legacyStudent.id} theme="light" />
    </div>
  )
}
