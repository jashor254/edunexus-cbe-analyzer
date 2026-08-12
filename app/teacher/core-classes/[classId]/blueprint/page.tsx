// app/teacher/core-classes/[classId]/blueprint/page.tsx
//
// The Class Blueprint — the teacher's way into the Blueprint for a whole class
// rather than one learner at a time. Thin server component: resolve who the
// caller is, one read (`getClassBlueprint`), render. No business logic.
//
// Why `core-classes/` and not `classes/`
// --------------------------------------
// `/teacher/classes/[classId]` is the LEGACY class screen, and its `classId` is
// a `teacher_classes.id`. This view is built on Core (`classes` +
// `learner_enrollments`), whose ids live in a different space entirely. Nesting
// it under the legacy route would have put two different entities behind one
// path parameter, so a teacher arriving from the legacy screen would have
// handed a `teacher_classes.id` to a route expecting a `classes.id`. The
// `core-*` prefix matches the convention the other Core screens already use
// (core-admissions, core-office, core-readiness, core-team, core-term).
//
// Authorization: the school is resolved from the CALLER's own membership, never
// from the URL, and `getClassBlueprint` then resolves the class school-scoped
// and throws if it does not belong to that school. A class in another school is
// therefore unreachable regardless of what id is supplied.

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { getClassBlueprint } from '@/lib/learnerBlueprint/classBlueprint'
import ClassBlueprintTable from '@/components/blueprint/ClassBlueprintTable'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">{children}</p>
    </div>
  )
}

export default async function ClassBlueprintPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  // Same self-scoped membership lookup /api/core/my-membership already uses —
  // the school comes from who the caller is, not from anything they can supply.
  const membership = await repos.schools.findSchoolUserByUserId(userId)
  if (!membership || !membership.is_active) {
    return <BlueprintStateMessage kind="permission-denied" backHref="/teacher/dashboard" backLabel="← Back to dashboard" />
  }

  const term = await repos.schools.findCurrentTerm(membership.school_id)
  if (!term) {
    return (
      <Notice>
        This school has no current term open, so a class list cannot be built yet. Ask your school administrator to
        open the term.
      </Notice>
    )
  }

  let data
  try {
    data = await getClassBlueprint({ classId, termId: term.id, schoolId: membership.school_id })
  } catch {
    // Covers both "no such class" and "class belongs to another school" — the
    // two are deliberately indistinguishable to the caller, so a wrong id never
    // confirms that some other school's class exists.
    return <BlueprintStateMessage kind="permission-denied" backHref="/teacher/dashboard" backLabel="← Back to dashboard" />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ClassBlueprintTable data={data} />
    </div>
  )
}
