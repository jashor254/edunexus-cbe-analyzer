// app/(parent)/child/page.tsx
//
// Parent Portal entry point (Sprint 12Q, ADR-0010 Phase 6 navigation:
// Home -> Blueprint -> Snapshot History -> Historical Snapshot). Resolves
// which learner(s) this parent is linked to via the existing canonical
// `resolveParent()` (no new permission system, per mission Phase 7) and
// either redirects straight to that one child's Home, or — for a parent
// with more than one linked child — shows a plain list, never a maze.
//
// Parent Portal Phase P1 (Parent Entry Convergence): this is now the
// canonical entry for EVERY parent (`getRoleRedirect('parent')` ->
// `/child`, lib/auth/roleRedirect.ts), not only guardians who happened to
// find the old mislabeled "Assignments" nav item. That means this page must
// now also do right by a guardian whose linked child(ren) exist ONLY in the
// legacy `students` space (`resolveParent().studentIds`) — previously this
// page silently ignored that array entirely and showed "No linked children"
// to a parent who very much had one. Handling, in order:
//   - zero children in EITHER space -> honest empty state with a real path
//     forward (the existing self-serve "Add Student" flow already lives on
//     /dashboard — this does not invent a new linking flow, just points at
//     the one that exists)
//   - Core children only, exactly one -> redirect straight to it (unchanged)
//   - legacy children only, none in Core -> redirect to /dashboard, which
//     already renders legacy children correctly (Blueprint's `/child/{id}`
//     has no legacy-space equivalent to redirect a single legacy child
//     into — /dashboard IS that page for this space)
//   - anything else (2+ Core children, or a MIXED family with both spaces)
//     -> list every linked child, Core cards routing into this Blueprint
//     flow as before, legacy children surfaced too (never hidden) with a
//     link into the legacy home that already renders them
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

  const { coreLearnerIds, studentIds } = await resolveParent(userId)

  if (coreLearnerIds.length === 0 && studentIds.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-3">
        <p className="text-sm font-black text-gray-900">No linked children yet</p>
        <p className="text-xs text-gray-400">Once your school links you as a guardian, your child&apos;s learning journey will appear here.</p>
        <Link
          href="/dashboard"
          className="inline-block text-sm font-bold text-teal-600 hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none rounded"
        >
          Add a child yourself &rarr;
        </Link>
      </div>
    )
  }

  // Legacy-only guardian: no Core-space linkage at all. /dashboard is the
  // correctly-working home for this space (P0 §26 confirms it renders
  // legacy children correctly) — there is no legacy-space equivalent of
  // `/child/{id}` to send a single legacy child into, so redirecting here
  // is the honest choice, not a new dead end.
  if (coreLearnerIds.length === 0) {
    redirect('/dashboard')
  }

  if (coreLearnerIds.length === 1 && studentIds.length === 0) {
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
      {studentIds.length > 0 && (
        <Link
          href="/dashboard"
          className="block bg-white rounded-2xl border border-dashed border-gray-200 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
        >
          <p className="text-sm font-bold text-gray-900">
            {studentIds.length === 1 ? 'You also have 1 child on your school’s legacy portal' : `You also have ${studentIds.length} children on your school’s legacy portal`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">View on your Dashboard &rarr;</p>
        </Link>
      )}
    </div>
  )
}
