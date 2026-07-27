import { createClient }        from '@/utils/supabase/server'
import { redirect }            from 'next/navigation'
import { headers }             from 'next/headers'
import DashboardNavbar         from '@/app/dashboard/components/DashboardNavbar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'
import { getUserRoles }        from '@/lib/auth/getRole'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Single canonical role lookup — see lib/auth/getRole.ts. Do not re-derive
  // this here; a second, disagreeing implementation (a raw profiles.role
  // query, previously right here) is exactly what caused Blocker #5 — this
  // layout could never actually be reached by a real student because
  // nothing, anywhere, treated 'student' as a real destination.
  const roles = await getUserRoles(user.id)

  // Phase 3A carve-out (docs/architecture/blueprint-execution-experience-
  // phase3a.md): `/student/blueprint/[learnerId]` is the one shared
  // Blueprint render for teacher/parent/student/admin viewers alike,
  // gated by its own page-level `requireLearnerAccess` — a strictly
  // finer-grained, already-authoritative check than this layout's coarse
  // role redirect. `proxy.ts` (middleware) already cleared this specific
  // request for a teacher/admin-tier viewer of that one path and marks it
  // with this header — this layout has no direct pathname access
  // otherwise, so it trusts that upstream signal rather than re-deriving
  // routing logic here. Every other `/student/**` page keeps the
  // unconditional redirect below, unchanged.
  const isAuthorizedTeacherBlueprintView = (await headers()).get('x-blueprint-teacher-viewer') === '1'
  if (roles.primary === 'teacher' && !isAuthorizedTeacherBlueprintView) redirect('/teacher/dashboard')
  if (roles.primary === 'parent')  redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div data-blueprint-hide-in-pdf="true">
        <DashboardNavbar isStudent />
      </div>
      <main>{children}</main>
      <div data-blueprint-hide-in-pdf="true">
        <VideoOnboardingModal userId={user.id} role="student" />
      </div>
    </div>
  )
}
