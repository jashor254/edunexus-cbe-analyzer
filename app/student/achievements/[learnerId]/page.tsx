// app/student/achievements/[learnerId]/page.tsx
//
// Sprint 6 — the "View all Achievements" destination the Blueprint's
// Achievement section links to (composeAchievement.ts's `profileUrl`,
// unset until this page existed). Same shape as the sibling Portfolio
// page: auth via `requireLearnerAccess`, then `listPublished()` — the one
// function `lib/learnerAchievement/achievement.ts` already designates the
// non-staff-safe read surface.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { getUserRoles } from '@/lib/auth/getRole'
import { listPublished } from '@/lib/learnerAchievement/achievement'
import Link from 'next/link'
import JourneyLinks from '@/components/student/JourneyLinks'
import { asLearnerId } from '@/lib/core/identityTypes'

export default async function StudentAchievementsPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  // Route-boundary trust origin: a Core `learners.id` — established by the
  // Core-learner queries this page performs, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    notFound()
  }

  try {
    await requireLearnerAccess(supabase, schoolId, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) {
      return (
        <div className="max-w-2xl mx-auto py-6 px-4">
          <div role="alert" className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-2">
            <p className="text-sm font-black text-gray-900">You do not have access to these Achievements</p>
            <p className="text-xs text-gray-400">Contact your school administrator if you believe this is an error.</p>
          </div>
        </div>
      )
    }
    throw err
  }

  const achievements = await listPublished(learnerId, schoolId)
  const isSelfView = (await getUserRoles(userId)).primary === 'student'

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <div className="mb-2">
        <h1 className="text-lg font-black text-gray-900">Achievements</h1>
        <Link href={`/student/blueprint/${learnerId}`} className="text-xs font-bold text-teal-700 hover:underline">
          ← Back to Blueprint
        </Link>
      </div>

      {achievements.length === 0 ? (
        <p className="text-sm text-gray-400">No published achievements yet.</p>
      ) : (
        <div className="space-y-3">
          {achievements.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-gray-900 text-sm">{a.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-teal-50 text-teal-700 border-teal-100">
                  {a.achievementType}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-gray-100 text-gray-500 border-gray-200">
                  {a.category}
                </span>
              </div>
              {a.description && <p className="text-sm text-gray-700">{a.description}</p>}
              {a.awardingOrganization && (
                <p className="text-xs text-gray-500">Awarded by {a.awardingOrganization}</p>
              )}
              <p className="text-[11px] text-gray-300">
                {new Date(a.awardDate).toLocaleDateString('en-KE', { dateStyle: 'long' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {isSelfView && <JourneyLinks current="achievements" />}
    </div>
  )
}
