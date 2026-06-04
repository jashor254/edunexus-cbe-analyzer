import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardNavbar from '@/app/dashboard/components/DashboardNavbar'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <DashboardNavbar />
      <main>{children}</main>
    </div>
  )
}
