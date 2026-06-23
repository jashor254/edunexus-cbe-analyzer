export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect, notFound } from 'next/navigation'
import { getCohortDetail } from '@/lib/academy/cohorts'
import CohortView from '@/components/academy/CohortView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CohortDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const cohort = await getCohortDetail(id, teacher.id)
  if (!cohort) notFound()

  return <CohortView cohort={cohort} currentTeacherId={teacher.id} />
}
