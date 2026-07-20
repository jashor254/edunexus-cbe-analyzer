// app/student/portfolio/page.tsx
//
// Sprint 6 — self-serve "my own Portfolio" entry point, no [learnerId] in
// the URL, mirroring app/student/blueprint/page.tsx exactly (same shared
// resolveOwnCoreLearnerId lookup, same "no owned / ambiguous" empty state).

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { resolveOwnCoreLearnerId } from '@/lib/core/identity'

export default async function StudentPortfolioIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const coreLearnerId = await resolveOwnCoreLearnerId(user.id)
  if (!coreLearnerId) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div role="alert" className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-2">
          <p className="text-sm font-black text-gray-900">Portfolio unavailable</p>
          <p className="text-xs text-gray-400">We couldn&rsquo;t find your own learner record. Contact your school administrator.</p>
        </div>
      </div>
    )
  }

  redirect(`/student/portfolio/${coreLearnerId}`)
}
