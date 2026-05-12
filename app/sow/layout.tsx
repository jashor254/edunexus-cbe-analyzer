import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function SOWLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Must have a teacher record to use the SOW generator
  if (!teacher) redirect('/teacher/setup')

  return <>{children}</>
}
