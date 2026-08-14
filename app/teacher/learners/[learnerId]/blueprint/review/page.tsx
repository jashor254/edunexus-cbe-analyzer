// app/teacher/learners/[learnerId]/blueprint/review/page.tsx
//
// Teacher Review Workspace — Phase 2E
// (docs/architecture/blueprint-teacher-review-workspace-phase2e.md).
// Learner-scoped: shows every approved Blueprint action item for one
// learner, lets an authorized teacher inspect its delivery/Evidence/
// Projection picture and record one of the five established Phase 2D
// review decisions. Thin server component: auth + the one read-model call
// (`listReviewableBlueprintActionsForLearner`) — no business logic here.
// Mirrors app/student/blueprint/[learnerId]/page.tsx's own auth-handling
// shape (notFound() for an unresolvable learner, inline permission-denied
// message for ResourceOwnershipError, redirect for unauthenticated).

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { listReviewableBlueprintActionsForLearner, type ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'
import BlueprintReviewWorkspace from '@/components/blueprint/review/BlueprintReviewWorkspace'
import Link from 'next/link'
import { asLearnerId } from '@/lib/core/identityTypes'

function learnerDisplayName(learner: { first_name: string; middle_name: string | null; last_name: string }): string {
  return [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(' ')
}

function latestActivityAcross(items: ReviewableActionListItem[]): string | null {
  return items.reduce<string | null>((latest, item) => {
    const candidate = item.latestReviewAt
    if (!candidate) return latest
    if (!latest || candidate > latest) return candidate
    return latest
  }, null)
}

export default async function BlueprintReviewWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Route-boundary trust origin: a Core `learners.id` — established by the
  // Core-learner queries this page performs, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const query = await searchParams
  // Optional deep-link (Phase 3A) — the Blueprint Action Plan's "Review
  // progress" link passes ?action=<id> so the teacher lands directly on
  // the action they just clicked from, instead of the workspace's default
  // first item. Purely an initial-selection hint, read client-side; it
  // changes no server-side authorization or data — an id for an action
  // this teacher can't manage is handled identically to any other
  // selection (the detail fetch's own authorization still applies).
  const initialActionId = typeof query.action === 'string' ? query.action : null
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    // Mirrors the Blueprint page's own reasoning: at this point we cannot
    // yet distinguish "does not exist" from "you can't see it" without
    // leaking existence to a stranger — notFound() is the conservative
    // choice for both.
    notFound()
  }

  let items: ReviewableActionListItem[]
  try {
    items = await listReviewableBlueprintActionsForLearner(supabase, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) {
      return <BlueprintStateMessage kind="permission-denied" backHref={`/student/blueprint/${learnerId}`} backLabel="← Back to Blueprint" />
    }
    throw err
  }

  const learner = await repos.learners.findById(learnerId, schoolId).catch(() => null)
  const lastReviewActivity = latestActivityAcross(items)

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-4">
      <header className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
        <h1 className="text-lg font-black text-gray-900">
          {learner ? learnerDisplayName(learner) : 'Blueprint Action Review'}
        </h1>
        <p className="text-xs text-gray-500">Teacher Review Workspace — Blueprint action plan</p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs">
          <Link
            href={`/student/blueprint/${learnerId}`}
            className="font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            View full Blueprint →
          </Link>
          {lastReviewActivity && (
            <span className="text-gray-400">
              Last reviewed {new Date(lastReviewActivity).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
            </span>
          )}
        </div>
      </header>

      <BlueprintReviewWorkspace items={items} initialSelectedActionId={initialActionId} />
    </div>
  )
}
