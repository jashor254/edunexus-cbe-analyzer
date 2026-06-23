export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import { getTeacherCohorts } from '@/lib/academy/cohorts'
import CohortSetupClient from '@/components/academy/CohortSetupClient'

export default async function CohortSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name, school')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const cohorts = await getTeacherCohorts(teacher.id)

  return (
    <CohortSetupClient
      teacherSchool={teacher.school}
      existingCohorts={cohorts}
    />
  )
}
