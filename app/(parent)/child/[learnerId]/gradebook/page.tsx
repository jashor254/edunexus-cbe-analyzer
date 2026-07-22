// app/(parent)/child/[learnerId]/gradebook/page.tsx
// Sprint 5 (Parent Experience Convergence). Same Core-learnerId ->
// legacy-studentId bridge as the sibling assignments/progress/holiday pages.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import ParentGradebookClient from './ParentGradebookClient'

export default async function ParentGradebookPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  const { learnerId } = await params
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
        <p className="text-sm text-gray-500">A gradebook isn&apos;t available for this learner yet.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href={`/child/${learnerId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back
        </Link>
        <h1 className="text-2xl font-black text-gray-900 mt-3">Gradebook</h1>
        <p className="text-gray-500 mt-1 text-sm">Assessment and assignment scores, by class</p>
      </div>
      <ParentGradebookClient studentId={legacyStudent.id} />
    </div>
  )
}
