// components/parent/ChildContextHeader.tsx
//
// Parent Portal Phase P3 (Home + Child-Context Convergence). Shared header
// used by every `/child/[learnerId]/*` subpage so a parent never loses
// track of WHICH child they're viewing after leaving Home — P3's Step 3
// audit found every subpage (Assignments, Gradebook, Progress, Holiday,
// Journey, History, Full) rendered a generic title ("Assignments",
// "Gradebook", ...) with no child name or school anywhere on the page.
//
// Server component, URL-derived (not client state) per Step 28/29's
// security invariant: re-derives the child's name/school from the
// already-verified `learnerId` (the caller's own `requireParent` check
// has already run before this renders), and re-resolves siblings from
// `resolveParent(user.id)` fresh on every render — never trusts a
// client-supplied child list. A parent with 2+ Core-space children gets a
// small switcher; a parent with exactly one gets a plain "All children"
// link back to `/child` (never hidden, never a dead end).
//
// Deliberately does NOT call `composeBlueprint()` — that call already
// resolves name/school/class more richly for Home, but pulling it into
// every subpage just for a header would multiply Home's own query cost
// across 7 more pages for information this header can get far more
// cheaply (2-3 small reads, bounded by however many Core children this
// parent actually has — realistically 1-3, same bound P1 already
// documented for `/child`'s own list view).
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { resolveParent } from '@/lib/core/identity'
import { repos } from '@/lib/repositories'
import type { LearnerId } from '@/lib/core/identityTypes'

function fullName(l: { first_name: string; middle_name: string | null; last_name: string }): string {
  return [l.first_name, l.middle_name, l.last_name].filter(Boolean).join(' ')
}

export default async function ChildContextHeader({ learnerId }: { learnerId: LearnerId }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let name = 'Your child'
  let schoolName: string | null = null

  try {
    const schoolId = await repos.learners.findSchoolId(learnerId)
    const [learner, school] = await Promise.all([
      repos.learners.findById(learnerId, schoolId),
      repos.schools.findById(schoolId).catch(() => null),
    ])
    name = fullName(learner)
    schoolName = school?.school_name ?? null
  } catch {
    // Non-fatal — the header degrades to just the "All children" link
    // rather than blocking the page the caller already authorized.
  }

  // Fresh, per-request, server-side only — never a client-supplied list.
  const { coreLearnerIds } = await resolveParent(user.id).catch(() => ({ coreLearnerIds: [] as LearnerId[] }))
  const siblingIds = coreLearnerIds.filter(id => id !== learnerId)

  const siblings = siblingIds.length > 0
    ? (await Promise.all(siblingIds.map(async id => {
        try {
          const schoolId = await repos.learners.findSchoolId(id)
          const learner = await repos.learners.findById(id, schoolId)
          return { id, name: fullName(learner) }
        } catch {
          return null
        }
      }))).filter((s): s is { id: LearnerId; name: string } => s !== null)
    : []

  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide truncate">
          Viewing {name}
        </p>
        {schoolName && <p className="text-xs text-gray-400 truncate">{schoolName}</p>}
      </div>

      {siblings.length > 0 ? (
        <details className="relative shrink-0">
          <summary className="list-none cursor-pointer text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none select-none">
            Switch child ▾
          </summary>
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-gray-100 shadow-lg z-10 py-1">
            <Link
              href={`/child/${learnerId}`}
              className="block px-3 py-2 text-xs font-bold text-gray-900 bg-gray-50"
            >
              {name} (current)
            </Link>
            {siblings.map(s => (
              <Link
                key={s.id}
                href={`/child/${s.id}`}
                className="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                {s.name}
              </Link>
            ))}
            <Link
              href="/child"
              className="block px-3 py-2 text-xs text-teal-700 font-bold border-t border-gray-100 mt-1"
            >
              All children →
            </Link>
          </div>
        </details>
      ) : (
        <Link href="/child" className="shrink-0 text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
          All children →
        </Link>
      )}
    </div>
  )
}
