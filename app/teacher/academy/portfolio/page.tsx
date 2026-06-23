export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import { getPortfolioData } from '@/lib/academy/portfolio'
import PortfolioView from '@/components/academy/PortfolioView'

export default async function PortfolioPage() {
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

  const portfolio = await getPortfolioData(teacher.id)

  return <PortfolioView portfolio={portfolio} />
}
