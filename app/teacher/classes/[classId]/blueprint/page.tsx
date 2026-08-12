// app/teacher/classes/[classId]/blueprint/page.tsx
//
// The Class Blueprint — the teacher's way into the Blueprint for a whole class
// rather than one learner at a time. Thin server component: auth, resolve the
// current term, one read (`getClassBlueprint`), render. No business logic.
//
// Authorization: school staff only, and `getClassBlueprint` resolves the class
// through `getClass(classId, schoolId)`, so a class outside the caller's school
// cannot be reached even with a valid id. Deliberately NOT `requireClassTeacher`
// — that helper checks the legacy `teacher_classes` table, while this view is
// built on Core classes and `learner_enrollments`.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { getCurrentTerm } from '@/lib/core/school'
import { getClassBlueprint } from '@/lib/learnerBlueprint/classBlueprint'
import ClassBlueprintTable from '@/components/blueprint/ClassBlueprintTable'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

export default async function ClassBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { classId } = await params
  const query = await searchParams
  const schoolId = typeof query.schoolId === 'string' ? query.schoolId : null

  if (!schoolId) notFound()

  const supabase = await createClient()

  try {
    await requireSchoolStaff(supabase, schoolId)
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    if (err instanceof ResourceOwnershipError) {
      return <BlueprintStateMessage kind="permission-denied" backHref="/teacher/dashboard" backLabel="← Back to dashboard" />
    }
    throw err
  }

  const term = await getCurrentTerm(schoolId)
  if (!term) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          This school has no current term set, so a class list cannot be built yet. Ask your school administrator to
          open the term.
        </p>
      </div>
    )
  }

  let data
  try {
    data = await getClassBlueprint({ classId, termId: term.id, schoolId })
  } catch {
    return <BlueprintStateMessage kind="unavailable" backHref="/teacher/dashboard" backLabel="← Back to dashboard" />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ClassBlueprintTable data={data} />
    </div>
  )
}
