// app/(parent)/child/page.tsx
//
// Parent Portal entry point (Sprint 12Q, ADR-0010 Phase 6 navigation:
// Home -> Blueprint -> Snapshot History -> Historical Snapshot). Resolves
// which learner(s) this parent is linked to via the existing canonical
// `resolveParent()` (no new permission system, per mission Phase 7) and
// either redirects straight to that one child's Home, or — for a parent
// with more than one linked child — shows a plain list, never a maze.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveParent } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'

export default async function ParentBlueprintEntryPage() {
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  const { coreLearnerIds } = await resolveParent(userId)

  if (coreLearnerIds.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-2">
        <p className="text-sm font-black text-gray-900">No linked children yet</p>
        <p className="text-xs text-gray-400">Once your school links you as a guardian, your child&apos;s learning journey will appear here.</p>
      </div>
    )
  }

  if (coreLearnerIds.length === 1) {
    redirect(`/child/${coreLearnerIds[0]}`)
  }

  const learners = await Promise.all(
    coreLearnerIds.map(async learnerId => {
      try {
        const schoolId = await repos.learners.findSchoolId(learnerId)
        const learner = await repos.learners.findById(learnerId, schoolId)
        return {
          learnerId,
          name: [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(' '),
        }
      } catch {
        return { learnerId, name: null }
      }
    })
  )

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-3">
      <h1 className="text-lg font-black text-gray-900">Your Children</h1>
      {learners.map(l => (
        <Link
          key={l.learnerId}
          href={`/child/${l.learnerId}`}
          className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
        >
          <p className="text-sm font-bold text-gray-900">{l.name ?? 'View learning journey'}</p>
        </Link>
      ))}
    </div>
  )
}
