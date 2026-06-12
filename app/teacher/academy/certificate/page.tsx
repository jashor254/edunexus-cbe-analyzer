export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import { getAcademyStats } from '@/lib/academy/queries'
import CertificateClient from './CertificateClient'

export default async function CertificatePage() {
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

  const stats = await getAcademyStats(teacher.id)

  if (!stats.allComplete) redirect('/teacher/academy')

  const issuedDate = new Date().toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <CertificateClient
      teacherName={teacher.full_name ?? 'Mwalimu'}
      school={teacher.school ?? ''}
      issuedDate={issuedDate}
      totalLessons={stats.totalLessons}
    />
  )
}
